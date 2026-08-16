export type Severity = "info" | "warning" | "critical";

export interface MaintenanceLog {
  id: string;
  created_at: string;
  node_id: string;
  machine_id: string;
  vibration_rms: number;
  peak_current: number;
  supercap_voltage: number;
  kurtosis: number;
  z_score: number;
  variance: number | null;
  panic: boolean;
  severity: Severity;
  anomaly_detected: boolean;
  trigger_reason: string | null;
  energy_state: string | null;
}

export interface AlertRecord {
  id: string;
  created_at: string;
  node_id: string;
  machine_id: string;
  severity: Severity;
  title: string;
  message: string;
  trigger_reason: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
}

export interface NodeRecord {
  id: string;
  node_id: string;
  machine_id: string;
  firmware_version: string | null;
  last_seen: string | null;
  status: string | null;
  energy_state: string | null;
  wifi_rssi?: number | null;
  uptime_seconds?: number | null;
}

export interface MachineRecord {
  id: string;
  machine_id: string;
  name: string;
  machine_type: string | null;
  location: string | null;
  status: string | null;
}

export interface TelemetryPayload {
  vibration_rms: number;
  peak_current: number;
  supercap_voltage: number;
  kurtosis: number;
  z_score: number;
  variance?: number;
  panic: boolean;
  wifi_rssi?: number;
  firmware_version?: string;
  uptime_seconds?: number;
}
