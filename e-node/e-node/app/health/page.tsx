"use client";

import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { computeHealthScore } from "@/lib/health";
import { formatNum } from "@/lib/utils";
import { ANOMALY_THRESHOLDS, EMERGENCY_THRESHOLDS, MIN_RECORDS_FOR_HEALTH_SCORE } from "@/lib/config";
import { CheckCircle2, AlertTriangle } from "lucide-react";

const HEALTH_TONE: Record<string, "healthy" | "warning" | "critical" | "offline"> = {
  HEALTHY: "healthy",
  WARNING: "warning",
  CRITICAL: "critical",
  "INSUFFICIENT DATA": "offline",
};

export default function HealthPage() {
  const { recent } = useLiveTelemetry(50);
  const latest = recent.length ? recent[recent.length - 1] : null;
  const health = computeHealthScore(recent);

  const indicators = latest
    ? [
        {
          label: "Excessive vibration",
          active: latest.vibration_rms > EMERGENCY_THRESHOLDS.vibrationRms * 0.75,
          text: "Elevated vibration may indicate mechanical degradation. Inspection recommended if the trend persists.",
        },
        {
          label: "Current overload",
          active: latest.peak_current > EMERGENCY_THRESHOLDS.peakCurrent * 0.75,
          text: "Current draw is approaching the configured overload threshold. Monitor for a sustained trend.",
        },
        {
          label: "Statistical instability",
          active: latest.z_score > ANOMALY_THRESHOLDS.zScore || latest.kurtosis > ANOMALY_THRESHOLDS.kurtosis,
          text: "Recent readings deviate from the established statistical baseline.",
        },
        {
          label: "Possible imbalance",
          active: latest.kurtosis > ANOMALY_THRESHOLDS.kurtosis,
          text: "Elevated kurtosis can be associated with impulsive, non-Gaussian vibration patterns such as imbalance.",
        },
      ]
    : [];

  return (
    <AppShell title="Predictive Health">
      {!latest || recent.length < MIN_RECORDS_FOR_HEALTH_SCORE ? (
        <Card>
          <CardContent>
            <EmptyState
              title="INSUFFICIENT DATA"
              description="Health assessment requires telemetry. At least a few real readings are needed before a score can be computed."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Machine Health Score</CardTitle></CardHeader>
            <CardContent className="flex flex-col items-center py-8">
              <span className="text-6xl font-bold tabular text-ink">{health.score}</span>
              <Badge tone={HEALTH_TONE[health.label]} className="mt-3">{health.label}</Badge>
              <p className="mt-3 max-w-md text-center text-xs text-ink-muted">
                Calculated from the last {recent.length} real telemetry records using threshold-weighted statistical analysis.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Training-Free Anomaly Detection</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-4 text-xs leading-relaxed text-ink-muted">
                This system detects abnormal machine behavior using real-time statistical characteristics rather than
                requiring a pre-trained machine-learning dataset.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ThresholdRow label="Vibration" value={latest.vibration_rms} unit="RMS" threshold={EMERGENCY_THRESHOLDS.vibrationRms} />
                <ThresholdRow label="Peak Current" value={latest.peak_current} unit="A" threshold={EMERGENCY_THRESHOLDS.peakCurrent} />
                <ThresholdRow label="Z-score" value={latest.z_score} unit="" threshold={ANOMALY_THRESHOLDS.zScore} />
                <ThresholdRow label="Kurtosis" value={latest.kurtosis} unit="" threshold={ANOMALY_THRESHOLDS.kurtosis} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Predictive Maintenance Indicators</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {indicators.map((ind) => (
                <div key={ind.label} className="flex items-start gap-3 rounded-lg border border-border bg-surface-raised p-3">
                  {ind.active ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-healthy" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-ink">{ind.label}</p>
                    {ind.active && <p className="mt-0.5 text-xs text-ink-muted">{ind.text}</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function ThresholdRow({ label, value, unit, threshold }: { label: string; value: number; unit: string; threshold: number }) {
  const alert = value > threshold;
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <Badge tone={alert ? "critical" : "healthy"}>{alert ? "ALERT" : "NORMAL"}</Badge>
      </div>
      <p className="mt-1 text-lg font-bold tabular text-ink">
        {formatNum(value)} {unit}
      </p>
      <p className="text-[11px] text-ink-muted">Threshold {threshold}{unit ? ` ${unit}` : ""}</p>
    </div>
  );
}
