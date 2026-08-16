import { ANOMALY_THRESHOLDS, EMERGENCY_THRESHOLDS, MIN_RECORDS_FOR_HEALTH_SCORE } from "./config";
import type { MaintenanceLog } from "@/types/telemetry";

export interface HealthResult {
  score: number | null;
  label: "HEALTHY" | "WARNING" | "CRITICAL" | "INSUFFICIENT DATA";
}

/**
 * Deterministic, explainable health score derived only from real
 * telemetry records already stored in Supabase. Never fabricated.
 * Penalizes proximity to emergency/anomaly thresholds across the
 * most recent records supplied by the caller.
 */
export function computeHealthScore(records: MaintenanceLog[]): HealthResult {
  if (!records || records.length < MIN_RECORDS_FOR_HEALTH_SCORE) {
    return { score: null, label: "INSUFFICIENT DATA" };
  }

  let totalPenalty = 0;
  for (const r of records) {
    let penalty = 0;

    const vibRatio = r.vibration_rms / EMERGENCY_THRESHOLDS.vibrationRms;
    penalty += Math.max(0, Math.min(1, vibRatio)) * 35;

    const curRatio = r.peak_current / EMERGENCY_THRESHOLDS.peakCurrent;
    penalty += Math.max(0, Math.min(1, curRatio)) * 25;

    const zRatio = Math.abs(r.z_score) / ANOMALY_THRESHOLDS.zScore;
    penalty += Math.max(0, Math.min(1, zRatio)) * 20;

    const kRatio = r.kurtosis / ANOMALY_THRESHOLDS.kurtosis;
    penalty += Math.max(0, Math.min(1, kRatio)) * 15;

    if (r.panic) penalty += 25;

    totalPenalty += Math.min(100, penalty);
  }

  const avgPenalty = totalPenalty / records.length;
  const score = Math.round(Math.max(0, 100 - avgPenalty));

  let label: HealthResult["label"] = "HEALTHY";
  if (score < 50) label = "CRITICAL";
  else if (score < 80) label = "WARNING";

  return { score, label };
}
