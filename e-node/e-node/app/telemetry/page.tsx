"use client";

import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { useNodeOnline } from "@/hooks/useNodeOnline";
import { formatNum, timeAgo } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { ANOMALY_THRESHOLDS, EMERGENCY_THRESHOLDS } from "@/lib/config";

export default function TelemetryPage() {
  const { recent, node } = useLiveTelemetry(60);
  const online = useNodeOnline(node?.last_seen);
  const latest = recent.length ? recent[recent.length - 1] : null;

  const chartData = recent.map((r) => ({
    t: new Date(r.created_at).toLocaleTimeString(),
    vibration_rms: r.vibration_rms,
    peak_current: r.peak_current,
    supercap_voltage: r.supercap_voltage,
    z_score: r.z_score,
    kurtosis: r.kurtosis,
  }));

  return (
    <AppShell title="Live Telemetry">
      {!latest ? (
        <Card><CardContent><EmptyState title="NO TELEMETRY RECEIVED" description="Waiting for ESP32-C3 telemetry." /></CardContent></Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <GaugeCard
              title="ADXL335 Vibration"
              value={`${formatNum(latest.vibration_rms)}`}
              unit="RMS"
              online={online}
              timestamp={latest.created_at}
            />
            <GaugeCard
              title="ACS712 / SCT-013 Current"
              value={`${formatNum(latest.peak_current)}`}
              unit="A"
              online={online}
              timestamp={latest.created_at}
            />
            <GaugeCard
              title="Supercapacitor"
              value={`${formatNum(latest.supercap_voltage)}`}
              unit="V"
              online={online}
              timestamp={latest.created_at}
            />
          </div>

          <Card>
            <CardHeader><CardTitle>Vibration RMS Trend</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-2 text-[11px] text-ink-muted">
                Raw waveform samples are not currently sent by the firmware — this shows the actual received RMS values over time.
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="t" tick={{ fontSize: 10 }} stroke="hsl(var(--ink-muted))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--ink-muted))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <ReferenceLine y={EMERGENCY_THRESHOLDS.vibrationRms} stroke="hsl(var(--critical))" strokeDasharray="4 4" label={{ value: "Emergency", fontSize: 10, fill: "hsl(var(--critical))" }} />
                  <Line type="monotone" dataKey="vibration_rms" stroke="hsl(var(--telemetry))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Statistical Metrics</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <StatBlock label="Z-score" value={formatNum(latest.z_score)} threshold={ANOMALY_THRESHOLDS.zScore} alert={latest.z_score > ANOMALY_THRESHOLDS.zScore} />
              <StatBlock label="Kurtosis" value={formatNum(latest.kurtosis)} threshold={ANOMALY_THRESHOLDS.kurtosis} alert={latest.kurtosis > ANOMALY_THRESHOLDS.kurtosis} />
              <StatBlock label="Variance" value={latest.variance !== null ? formatNum(latest.variance) : "Not reported by device"} />
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function GaugeCard({ title, value, unit, online, timestamp }: { title: string; value: string; unit: string; online: boolean; timestamp: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Badge tone={online ? "telemetry" : "offline"}>{online ? "LIVE" : "LAST RECEIVED"}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col items-center py-8">
        <span className="text-4xl font-bold tabular text-ink">
          {value}
          <span className="ml-1 text-base text-ink-muted">{unit}</span>
        </span>
        <p className="mt-2 text-[11px] text-ink-muted">{online ? "updating live" : `${timeAgo(timestamp)}`}</p>
      </CardContent>
    </Card>
  );
}

function StatBlock({ label, value, threshold, alert }: { label: string; value: string; threshold?: number; alert?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="mt-1 text-xl font-bold tabular text-ink">{value}</p>
      {threshold !== undefined && (
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[11px] text-ink-muted">Threshold {threshold}</span>
          <Badge tone={alert ? "critical" : "healthy"}>{alert ? "ANOMALY" : "NORMAL"}</Badge>
        </div>
      )}
    </div>
  );
}
