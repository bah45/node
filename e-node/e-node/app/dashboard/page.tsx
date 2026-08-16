"use client";

import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { useNodeOnline } from "@/hooks/useNodeOnline";
import { computeHealthScore } from "@/lib/health";
import { formatNum, timeAgo, cn } from "@/lib/utils";
import { MACHINE_ID, EMERGENCY_THRESHOLDS } from "@/lib/config";
import { Activity, Zap, BatteryCharging, AlertTriangle } from "lucide-react";

const HEALTH_TONE: Record<string, "healthy" | "warning" | "critical" | "offline"> = {
  HEALTHY: "healthy",
  WARNING: "warning",
  CRITICAL: "critical",
  "INSUFFICIENT DATA": "offline",
};

export default function DashboardPage() {
  const { recent, node, loading } = useLiveTelemetry(50);
  const online = useNodeOnline(node?.last_seen);
  const latest = recent.length ? recent[recent.length - 1] : null;
  const health = computeHealthScore(recent);

  const machineStatus = !online
    ? "OFFLINE"
    : latest?.severity === "critical"
    ? "CRITICAL"
    : latest?.severity === "warning"
    ? "WARNING"
    : latest
    ? "RUNNING"
    : "OFFLINE";

  const statusTone: Record<string, "healthy" | "warning" | "critical" | "offline"> = {
    RUNNING: "healthy",
    WARNING: "warning",
    CRITICAL: "critical",
    OFFLINE: "offline",
  };

  return (
    <AppShell title="Overview">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">Machine Overview</h2>
          <p className="text-sm text-ink-muted">{MACHINE_ID} — Industrial Motor</p>
        </div>
        <Badge tone={online ? "healthy" : "offline"} className="text-sm">
          <span className={cn("h-1.5 w-1.5 rounded-full", online ? "bg-healthy animate-pulseDot" : "bg-offline")} />
          {online ? "ONLINE" : "OFFLINE"}
        </Badge>
      </div>

      {loading ? (
        <Card><CardContent><p className="text-sm text-ink-muted">Loading telemetry…</p></CardContent></Card>
      ) : !latest ? (
        <Card>
          <CardContent>
            <EmptyState title="NO TELEMETRY RECEIVED" description="Waiting for ESP32-C3 to transmit its first reading." />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-4 grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardHeader><CardTitle>Machine Health</CardTitle></CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <span className="text-5xl font-bold tabular text-ink">
                  {health.score !== null ? health.score : "--"}
                  {health.score !== null && <span className="text-lg text-ink-muted"> /100</span>}
                </span>
                <Badge tone={HEALTH_TONE[health.label]} className="mt-3">{health.label}</Badge>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Machine Status</CardTitle></CardHeader>
              <CardContent className="flex h-full flex-col items-center justify-center gap-3 py-8">
                <Badge tone={statusTone[machineStatus]} className="px-4 py-2 text-base">
                  {machineStatus}
                </Badge>
                <p className="text-xs text-ink-muted">
                  {online ? `Last telemetry ${timeAgo(node?.last_seen)}` : `Node offline — last seen ${timeAgo(node?.last_seen)}`}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mb-4 grid gap-4 md:grid-cols-3">
            <MetricCard
              icon={Activity}
              tone="telemetry"
              label="Vibration"
              value={`${formatNum(latest.vibration_rms)} RMS`}
              sub={`Threshold ${EMERGENCY_THRESHOLDS.vibrationRms} RMS`}
              status={latest.vibration_rms > EMERGENCY_THRESHOLDS.vibrationRms ? "critical" : "healthy"}
              timestamp={latest.created_at}
            />
            <MetricCard
              icon={Zap}
              tone="warning"
              label="Machine Current"
              value={`${formatNum(latest.peak_current)} A`}
              sub={`Threshold ${EMERGENCY_THRESHOLDS.peakCurrent} A`}
              status={latest.peak_current > EMERGENCY_THRESHOLDS.peakCurrent ? "critical" : "healthy"}
              timestamp={latest.created_at}
            />
            <MetricCard
              icon={BatteryCharging}
              tone="statistical"
              label="Energy Buffer"
              value={`${formatNum(latest.supercap_voltage)} V`}
              sub={latest.energy_state?.replace("_", " ") ?? "--"}
              status="neutral"
              timestamp={latest.created_at}
            />
          </div>

          <Card>
            <CardHeader><CardTitle>Recent Events</CardTitle></CardHeader>
            <CardContent className="p-0">
              {recent.filter((r) => r.anomaly_detected || r.panic).length === 0 ? (
                <EmptyState title="No events recorded." />
              ) : (
                <ul className="divide-y divide-border">
                  {[...recent]
                    .filter((r) => r.anomaly_detected || r.panic)
                    .reverse()
                    .slice(0, 8)
                    .map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className={cn("h-4 w-4", r.severity === "critical" ? "text-critical" : "text-warning")} />
                          <div>
                            <p className="text-sm text-ink">{r.trigger_reason ?? "Anomaly detected"}</p>
                            <p className="text-[11px] text-ink-muted">{timeAgo(r.created_at)}</p>
                          </div>
                        </div>
                        <Badge tone={r.severity === "critical" ? "critical" : "warning"}>{r.severity.toUpperCase()}</Badge>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </AppShell>
  );
}

const TONE_ICON_BG: Record<string, string> = {
  telemetry: "bg-telemetry/10",
  warning: "bg-warning/10",
  statistical: "bg-statistical/10",
};
const TONE_ICON_TEXT: Record<string, string> = {
  telemetry: "text-telemetry",
  warning: "text-warning",
  statistical: "text-statistical",
};

function MetricCard({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  status,
  timestamp,
}: {
  icon: any;
  tone: "telemetry" | "warning" | "statistical";
  label: string;
  value: string;
  sub: string;
  status: "healthy" | "critical" | "neutral";
  timestamp: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", TONE_ICON_BG[tone])}>
            <Icon className={cn("h-4 w-4", TONE_ICON_TEXT[tone])} />
          </div>
          {status !== "neutral" && (
            <Badge tone={status}>{status === "healthy" ? "NORMAL" : "ALERT"}</Badge>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-ink-muted">{label}</p>
          <p className="text-2xl font-bold tabular text-ink">{value}</p>
          <p className="text-[11px] text-ink-muted">{sub}</p>
        </div>
        <p className="text-[10px] text-ink-muted">{timeAgo(timestamp)}</p>
      </CardContent>
    </Card>
  );
}
