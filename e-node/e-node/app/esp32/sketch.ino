/*
  E-NODE — ESP32-C3 SuperMini Firmware
  Energy-Aware Self-Powered Predictive Maintenance Node

  Sensors:
    - ADXL335       -> vibration (X/Y/Z analog outputs)
    - ACS712/SCT-013 -> machine current (analog)
    - Supercapacitor voltage -> analog, via resistor divider

  Behavior:
    - Samples vibration + current locally, computes RMS, variance,
      standard deviation, Z-score and kurtosis on-device (training-free,
      threshold-based statistics — no ML model required).
    - Reads supercapacitor voltage and derives an energy state, which
      adapts sensing rate, Wi-Fi activity and transmission interval.
    - Sends telemetry to the Next.js /api/telemetry endpoint over Wi-Fi,
      authenticated with a device-specific API key header.
    - Prioritizes emergency transmission when panic conditions are met,
      even in energy-saving mode (subject to available power/network).

  IMPORTANT: this firmware never fabricates values — every field sent to
  the server is derived from actual ADC samples taken during this cycle.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <math.h>

// ---------------------------------------------------------------
// USER CONFIGURATION
// ---------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* API_ENDPOINT       = "https://your-deployment.vercel.app/api/telemetry";
const char* DEVICE_API_KEY     = "REPLACE_WITH_ESP32_DEVICE_API_KEY"; // must match server env ESP32_DEVICE_API_KEY

// ---------------------------------------------------------------
// PIN CONFIGURATION (ESP32-C3 SuperMini analog-capable GPIOs)
// ---------------------------------------------------------------
const int PIN_ADXL_X   = 0;  // ADC1_CH0
const int PIN_ADXL_Y   = 1;  // ADC1_CH1
const int PIN_ADXL_Z   = 2;  // ADC1_CH2
const int PIN_CURRENT  = 3;  // ADC1_CH3 — ACS712 / SCT-013 output
const int PIN_SUPERCAP = 4;  // ADC1_CH4 — via voltage divider

// ---------------------------------------------------------------
// CALIBRATION CONSTANTS — measure and replace for your hardware
// ---------------------------------------------------------------
const float ADC_VREF        = 3.3f;
const int   ADC_RESOLUTION  = 4095; // 12-bit ADC

// ADXL335: ~330 mV/g sensitivity, 1.65V zero-g bias (typical; verify per unit)
const float ADXL_ZERO_G_V   = 1.65f;
const float ADXL_MV_PER_G   = 0.330f;

// ACS712 (example: 30A variant, 66 mV/A) — replace with your sensor's spec
// For SCT-013 non-invasive CTs, replace this conversion with your burden-resistor calibration.
const float CURRENT_ZERO_V  = ADC_VREF / 2.0f;
const float CURRENT_MV_PER_A = 0.066f;

// Supercapacitor voltage divider ratio: Vcap = Vadc * DIVIDER_RATIO
// e.g. R1=100k (top) / R2=100k (bottom) -> ratio 2.0 for a 0-5V cap read on a 0-3.3V ADC path
const float SUPERCAP_DIVIDER_RATIO = 2.0f;

const int   SAMPLE_COUNT      = 256;   // samples per telemetry cycle
const int   SAMPLE_DELAY_US   = 500;   // spacing between samples

// ---------------------------------------------------------------
// ENERGY-AWARE THRESHOLDS (must mirror lib/config.ts on the server)
// ---------------------------------------------------------------
const float ENERGY_HIGH_MIN_V     = 3.7f;
const float ENERGY_NORMAL_MIN_V   = 3.4f;
const float ENERGY_SAVING_MIN_V   = 3.1f;
// below ENERGY_SAVING_MIN_V => CRITICAL

// ---------------------------------------------------------------
// EMERGENCY THRESHOLDS (must mirror lib/config.ts on the server)
// ---------------------------------------------------------------
const float EMERGENCY_VIBRATION_RMS = 4.5f;
const float EMERGENCY_PEAK_CURRENT  = 15.0f;

enum EnergyState { HIGH_ENERGY, NORMAL, ENERGY_SAVING, CRITICAL_ENERGY };

// ---------------------------------------------------------------
// Interval per energy state (ms) — HIGH/NORMAL send often, SAVING/CRITICAL
// throttle transmission unless an emergency condition is detected.
// ---------------------------------------------------------------
unsigned long intervalForState(EnergyState s) {
  switch (s) {
    case HIGH_ENERGY:     return 5000UL;
    case NORMAL:          return 10000UL;
    case ENERGY_SAVING:   return 30000UL;
    case CRITICAL_ENERGY: return 60000UL;
  }
  return 10000UL;
}

EnergyState deriveEnergyState(float vcap) {
  if (vcap >= ENERGY_HIGH_MIN_V)   return HIGH_ENERGY;
  if (vcap >= ENERGY_NORMAL_MIN_V) return NORMAL;
  if (vcap >= ENERGY_SAVING_MIN_V) return ENERGY_SAVING;
  return CRITICAL_ENERGY;
}

const char* energyStateName(EnergyState s) {
  switch (s) {
    case HIGH_ENERGY:     return "HIGH_ENERGY";
    case NORMAL:          return "NORMAL";
    case ENERGY_SAVING:   return "ENERGY_SAVING";
    case CRITICAL_ENERGY: return "CRITICAL_ENERGY";
  }
  return "NORMAL";
}

unsigned long lastSendMillis = 0;

// ---------------------------------------------------------------
// Read real ADC samples, convert to physical vibration magnitude (g)
// ---------------------------------------------------------------
float readVibrationSample() {
  int rawX = analogRead(PIN_ADXL_X);
  int rawY = analogRead(PIN_ADXL_Y);
  int rawZ = analogRead(PIN_ADXL_Z);

  float vx = (rawX / (float)ADC_RESOLUTION) * ADC_VREF;
  float vy = (rawY / (float)ADC_RESOLUTION) * ADC_VREF;
  float vz = (rawZ / (float)ADC_RESOLUTION) * ADC_VREF;

  float gx = (vx - ADXL_ZERO_G_V) / ADXL_MV_PER_G;
  float gy = (vy - ADXL_ZERO_G_V) / ADXL_MV_PER_G;
  float gz = (vz - ADXL_ZERO_G_V) / ADXL_MV_PER_G;

  return sqrtf(gx * gx + gy * gy + gz * gz);
}

float readCurrentSample() {
  int raw = analogRead(PIN_CURRENT);
  float v = (raw / (float)ADC_RESOLUTION) * ADC_VREF;
  return (v - CURRENT_ZERO_V) / CURRENT_MV_PER_A;
}

float readSupercapVoltage() {
  int raw = analogRead(PIN_SUPERCAP);
  float v = (raw / (float)ADC_RESOLUTION) * ADC_VREF;
  return v * SUPERCAP_DIVIDER_RATIO;
}

// ---------------------------------------------------------------
// Statistical computation over a real sample buffer
// ---------------------------------------------------------------
struct Stats {
  float rms;
  float mean;
  float variance;
  float stddev;
  float zScoreOfLastSample;
  float kurtosis;
  float peak;
};

Stats computeStats(float* samples, int n) {
  Stats s = {0};
  float sum = 0, sumSq = 0;
  s.peak = 0;
  for (int i = 0; i < n; i++) {
    sum += samples[i];
    sumSq += samples[i] * samples[i];
    if (fabsf(samples[i]) > s.peak) s.peak = fabsf(samples[i]);
  }
  s.mean = sum / n;
  s.rms = sqrtf(sumSq / n);

  float varAccum = 0, fourthAccum = 0;
  for (int i = 0; i < n; i++) {
    float d = samples[i] - s.mean;
    varAccum += d * d;
    fourthAccum += d * d * d * d;
  }
  s.variance = varAccum / n;
  s.stddev = sqrtf(s.variance);

  s.zScoreOfLastSample = s.stddev > 0.0001f ? (samples[n - 1] - s.mean) / s.stddev : 0;
  s.kurtosis = (s.variance > 0.0001f) ? (fourthAccum / n) / (s.variance * s.variance) : 0;

  return s;
}

// ---------------------------------------------------------------
// Send one real telemetry packet to the API
// ---------------------------------------------------------------
bool sendTelemetry(float vibrationRms, float peakCurrent, float supercapV,
                    float kurtosis, float zScore, float variance, bool panic) {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  http.begin(API_ENDPOINT);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-api-key", DEVICE_API_KEY);

  StaticJsonDocument<512> doc;
  doc["vibration_rms"]    = vibrationRms;
  doc["peak_current"]     = peakCurrent;
  doc["supercap_voltage"] = supercapV;
  doc["kurtosis"]         = kurtosis;
  doc["z_score"]          = zScore;
  doc["variance"]         = variance;
  doc["panic"]            = panic;
  doc["wifi_rssi"]        = WiFi.RSSI();
  doc["firmware_version"] = "1.0.0";
  doc["uptime_seconds"]   = millis() / 1000;

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  http.end();
  return code == 200;
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(250);
  }
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  connectWifi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }

  static float vibBuffer[SAMPLE_COUNT];
  static float curBuffer[SAMPLE_COUNT];

  for (int i = 0; i < SAMPLE_COUNT; i++) {
    vibBuffer[i] = readVibrationSample();
    curBuffer[i] = readCurrentSample();
    delayMicroseconds(SAMPLE_DELAY_US);
  }

  Stats vibStats = computeStats(vibBuffer, SAMPLE_COUNT);
  Stats curStats = computeStats(curBuffer, SAMPLE_COUNT);
  float supercapV = readSupercapVoltage();

  EnergyState energyState = deriveEnergyState(supercapV);

  bool panic = (vibStats.rms > EMERGENCY_VIBRATION_RMS) || (curStats.peak > EMERGENCY_PEAK_CURRENT);

  unsigned long now = millis();
  unsigned long interval = intervalForState(energyState);

  // Emergency priority: transmit immediately regardless of energy-saving interval.
  bool dueForSend = (now - lastSendMillis >= interval);
  if (panic || dueForSend) {
    bool ok = sendTelemetry(
      vibStats.rms,
      curStats.peak,
      supercapV,
      vibStats.kurtosis,
      vibStats.zScoreOfLastSample,
      vibStats.variance,
      panic
    );
    if (ok) lastSendMillis = now;
  }

  // Energy-saving states reduce active sensing/Wi-Fi duty cycle between cycles.
  if (energyState == ENERGY_SAVING) {
    delay(2000);
  } else if (energyState == CRITICAL_ENERGY) {
    if (!panic) {
      WiFi.mode(WIFI_OFF);
      delay(8000);
      WiFi.mode(WIFI_STA);
      connectWifi();
    }
  }
}
