/**
 * Central, single-source configuration for every threshold and timeout
 * used across the dashboard, API routes and health calculations.
 *
 * IMPORTANT: nothing in this file invents data — these are *interpretation*
 * thresholds applied to real telemetry, not fallback/sample values.
 */

function num(envVal: string | undefined, fallback: number): number {
  const n = Number(envVal);
  return Number.isFinite(n) && envVal !== undefined && envVal !== "" ? n : fallback;
}

export const NODE_ONLINE_TIMEOUT_SECONDS = num(process.env.NODE_ONLINE_TIMEOUT_SECONDS, 30);

export const ANOMALY_THRESHOLDS = {
  zScore: 3.0,
  kurtosis: 4.2,
};

export const EMERGENCY_THRESHOLDS = {
  vibrationRms: 4.5,
  peakCurrent: 15,
};

export const ENERGY_THRESHOLDS = {
  highEnergyMinV: 3.7,
  normalMinV: 3.4,
  energySavingMinV: 3.1,
  // below energySavingMinV => CRITICAL ENERGY
};

export const ENERGY_STATES = {
  HIGH_ENERGY: "HIGH_ENERGY",
  NORMAL: "NORMAL",
  ENERGY_SAVING: "ENERGY_SAVING",
  CRITICAL_ENERGY: "CRITICAL_ENERGY",
} as const;

export type EnergyState = (typeof ENERGY_STATES)[keyof typeof ENERGY_STATES];

export function deriveEnergyState(supercapVoltage: number | null | undefined): EnergyState | null {
  if (supercapVoltage === null || supercapVoltage === undefined || Number.isNaN(supercapVoltage)) {
    return null;
  }
  if (supercapVoltage >= ENERGY_THRESHOLDS.highEnergyMinV) return ENERGY_STATES.HIGH_ENERGY;
  if (supercapVoltage >= ENERGY_THRESHOLDS.normalMinV) return ENERGY_STATES.NORMAL;
  if (supercapVoltage >= ENERGY_THRESHOLDS.energySavingMinV) return ENERGY_STATES.ENERGY_SAVING;
  return ENERGY_STATES.CRITICAL_ENERGY;
}

export const ALERT_COOLDOWN_SECONDS = num(process.env.ALERT_COOLDOWN_SECONDS, 300);

// Minimum number of real telemetry records required before a health
// score / trend is computed, instead of showing INSUFFICIENT DATA.
export const MIN_RECORDS_FOR_HEALTH_SCORE = 3;

export const NODE_ID = process.env.NEXT_PUBLIC_NODE_ID || "EN-ESP32C3-001";
export const MACHINE_ID = process.env.NEXT_PUBLIC_MACHINE_ID || "MTR-001";
