# E-NODE — Energy-Aware Self-Powered Predictive Maintenance Platform

> Harvest Energy. Detect Anomalies. Predict Failure.

E-NODE is the operator dashboard for a real, hardware-connected predictive-maintenance
node built on an **ESP32-C3 SuperMini**, ADXL335 vibration sensor, ACS712/SCT-013 current
sensor, an LTC3588-1 energy-harvesting circuit and a 0.5F supercapacitor.

**This application never displays fabricated telemetry.** Every number on every page comes
from a row actually written to Supabase by the `/api/telemetry` endpoint after the ESP32-C3
sends it. If the node has never connected, or has gone offline, the UI says so explicitly
instead of inventing a value — see "No-fake-data policy" below.

---

## 1. Project structure

```
app/
├── login/              Operator sign-in
├── dashboard/           Overview
├── telemetry/           Live Telemetry
├── health/               Predictive Health
├── energy/               Energy Intelligence
├── history/              Historical Analytics
├── alerts/                Alerts & Anomalies
├── settings/              Settings + diagnostics
├── api/telemetry/       POST ingest endpoint (device-authenticated)
├── api/chat/              EVA assistant endpoint (Gemini Flash)
├── api/alerts/acknowledge/ Alert acknowledgement endpoint
├── esp32/sketch.ino     ESP32-C3 firmware
components/               UI shell, cards, AI assistant widget
hooks/                    Realtime telemetry + node-online hooks
lib/                      Config/thresholds, health scoring, anomaly logic, i18n, Supabase clients
supabase/schema.sql        Full DB schema + RLS policies
```

## 2. Web app setup

```bash
npm install
cp .env.example .env.local   # fill in real values, see section 4
npm run dev
```

Build for production:

```bash
npm run build
npm run start
```

## 3. Supabase setup

1. Create a project at https://supabase.com.
2. Open the SQL editor and run `supabase/schema.sql`. This creates:
   - `machines`, `nodes`, `maintenance_logs`, `alerts`
   - indexes on timestamp / node_id / machine_id / severity
   - Row Level Security policies (authenticated operators can read; only the
     service-role key used by `/api/telemetry` can insert/upsert telemetry, nodes and alerts)
   - Adds the four tables to the `supabase_realtime` publication
   - Seeds one `machines` row (`MTR-001`) and one `nodes` row (`EN-ESP32C3-001`) — edit these
     to match your real hardware identifiers.
3. In **Authentication → Providers**, enable Email/Password.
4. In **Authentication → Users**, create your operator account(s).
5. Confirm **Database → Replication** shows Realtime enabled for the four tables above.
6. Copy your Project URL, anon key and service-role key into `.env.local`.

## 4. Environment variables

| Variable | Purpose | Exposed to browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (RLS-protected) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used by the telemetry ingest route to bypass RLS | **No** |
| `NEXT_PUBLIC_NODE_ID` / `NEXT_PUBLIC_MACHINE_ID` | Default node/machine identifiers shown across the UI | Yes |
| `ESP32_DEVICE_API_KEY` | Shared secret the firmware sends in `x-device-api-key`; the API rejects requests without it | **No** |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini Flash key for the EVA assistant | **No** |
| `RESEND_API_KEY` / `ALERT_RECIPIENT_EMAIL` | Email alerting via Resend | **No** |
| `SMS_ALERT_WEBHOOK_URL` | Your SMS/webhook provider for emergency alerts | **No** |
| `NODE_ONLINE_TIMEOUT_SECONDS` | How many seconds without telemetry before a node is shown OFFLINE | Server-evaluated |
| `ALERT_COOLDOWN_SECONDS` | Minimum gap between duplicate alerts for the same trigger reason | Server-evaluated |

Never move `SUPABASE_SERVICE_ROLE_KEY`, `ESP32_DEVICE_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`
or `RESEND_API_KEY` into `NEXT_PUBLIC_*` variables or client components.

## 5. ESP32-C3 firmware setup (`app/esp32/sketch.ino`)

1. Install the ESP32 board package in Arduino IDE (or PlatformIO) and select **ESP32C3 Dev Module**.
2. Install the `ArduinoJson` library.
3. Wiring:
   - ADXL335 X/Y/Z → GPIO0/1/2 (analog)
   - ACS712/SCT-013 output → GPIO3 (analog)
   - Supercapacitor → resistor divider → GPIO4 (analog)
4. Edit the top of the sketch:
   - `WIFI_SSID`, `WIFI_PASSWORD`
   - `API_ENDPOINT` → your deployed `/api/telemetry` URL
   - `DEVICE_API_KEY` → must exactly match `ESP32_DEVICE_API_KEY` on the server
5. Calibrate the constants for your specific sensors:
   - `ADXL_ZERO_G_V`, `ADXL_MV_PER_G` — measure your ADXL335's actual bias/sensitivity
   - `CURRENT_ZERO_V`, `CURRENT_MV_PER_A` — per your ACS712 variant, or your SCT-013 burden resistor
   - `SUPERCAP_DIVIDER_RATIO` — computed from your resistor divider (R1+R2)/R2
6. Set `NODE_ONLINE_TIMEOUT_SECONDS`, energy thresholds and emergency thresholds to match
   `lib/config.ts` — they intentionally mirror each other; change both sides together.
7. Flash the ESP32-C3 and open the Serial Monitor at 115200 baud to confirm Wi-Fi connects.

## 6. No-fake-data policy (read before modifying UI code)

This project follows a hard rule: **the UI only renders values that trace back to a real row
in `maintenance_logs`, `nodes`, or `alerts`.**

- No telemetry ever → show **NO TELEMETRY RECEIVED**, not a placeholder chart.
- Node offline → show **NODE OFFLINE** with real "last telemetry Xs/m/h ago", never a live-looking gauge.
- Insufficient records for a health score → show **INSUFFICIENT DATA**, never a guessed score.
- No raw waveform samples are sent by the firmware → the Live Telemetry page shows a
  **Vibration RMS Trend** from real RMS values, not a fabricated sine wave.
- Harvested power is not measured by the current hardware → the Energy page says
  "Harvested power measurement unavailable" instead of showing a number.
- Diagnostics fields the firmware doesn't send (RSSI, firmware version, uptime) show
  **"Not reported by device"** until the firmware actually reports them.
- The EVA assistant is grounded exclusively in a server-built context string derived from
  the same three tables and is instructed to say "No hardware telemetry is currently
  available" rather than infer a plausible-sounding answer.

If you extend the app, keep this contract: add a new field only after it exists in the
telemetry payload and the database schema — never synthesize it in the UI layer.

## 7. Authentication

Handled by Supabase Auth (email/password). `middleware.ts` + `lib/supabase/middleware.ts`
enforce server-side session checks on every route except `/login` and the public
`/api/telemetry` ingest endpoint (which uses device-key auth instead of user auth).
Unauthenticated visitors are redirected to `/login`.

## 8. Deployment (Vercel)

1. Push this repository to GitHub/GitLab/Bitbucket.
2. Import the repo in Vercel.
3. Add all environment variables from section 4 in Vercel's Project Settings → Environment Variables.
4. Deploy. Update `API_ENDPOINT` in the firmware to your production URL
   (e.g. `https://your-project.vercel.app/api/telemetry`) and reflash the ESP32-C3.
5. Confirm the Supabase Realtime tables are enabled — it is what makes the dashboard update
   without polling or manual refresh.

## 9. Multi-language & theme

- Language: `lib/i18n/{en,ta,hi}.json`, selected in the top bar, persisted to `localStorage`.
  Add a new locale by creating another JSON dictionary and registering it in `lib/i18n/index.tsx`.
- Theme: light / dark / system, persisted to `localStorage`, applied via a `.dark` class on `<html>`
  (`lib/theme.tsx`). Both palettes are defined as CSS variables in `app/globals.css`.

## 10. What's intentionally out of scope for this build

- A full production-grade distributed rate limiter (the sample uses a simple per-process
  in-memory limiter — swap in Redis/Upstash for multi-instance deployments).
- Password reset email templates (Supabase's default flow is used as-is).
- Raw waveform capture/visualization (the firmware currently sends RMS + statistics only —
  see section 6 for why the UI doesn't fake this).
