import { ANOMALY_THRESHOLDS, EMERGENCY_THRESHOLDS } from "./config";
import type { Severity } from "@/types/telemetry";

export interface EvaluationInput {
  vibration_rms: number;
  peak_current: number;
  z_score: number;
  kurtosis: number;
  panic: boolean;
}

export interface EvaluationResult {
  severity: Severity;
  anomaly_detected: boolean;
  trigger_reason: string | null;
}

/**
 * Training-free, threshold-based statistical evaluation.
 * Runs only against real telemetry values received from the ESP32-C3 —
 * never against synthetic or placeholder input.
 */
export function evaluateTelemetry(input: EvaluationInput): EvaluationResult {
  const reasons: string[] = [];
  let severity: Severity = "info";

  if (input.panic) {
    reasons.push("panic flag set by device");
    severity = "critical";
  }
  if (input.vibration_rms > EMERGENCY_THRESHOLDS.vibrationRms) {
    reasons.push(
      `vibration_rms ${input.vibration_rms.toFixed(2)} exceeded emergency threshold ${EMERGENCY_THRESHOLDS.vibrationRms}`
    );
    severity = "critical";
  }
  if (input.peak_current > EMERGENCY_THRESHOLDS.peakCurrent) {
    reasons.push(
      `peak_current ${input.peak_current.toFixed(2)} exceeded emergency threshold ${EMERGENCY_THRESHOLDS.peakCurrent}`
    );
    severity = "critical";
  }

  let anomaly = false;
  if (input.z_score > ANOMALY_THRESHOLDS.zScore) {
    reasons.push(`z_score ${input.z_score.toFixed(2)} exceeded threshold ${ANOMALY_THRESHOLDS.zScore}`);
    anomaly = true;
    if (severity === "info") severity = "warning";
  }
  if (input.kurtosis > ANOMALY_THRESHOLDS.kurtosis) {
    reasons.push(`kurtosis ${input.kurtosis.toFixed(2)} exceeded threshold ${ANOMALY_THRESHOLDS.kurtosis}`);
    anomaly = true;
    if (severity === "info") severity = "warning";
  }

  return {
    severity,
    anomaly_detected: anomaly || severity === "critical",
    trigger_reason: reasons.length ? reasons.join("; ") : null,
  };
}
