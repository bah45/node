"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/client";
import { NODE_ID } from "@/lib/config";
import { formatNum } from "@/lib/utils";
import type { MaintenanceLog } from "@/types/telemetry";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Download } from "lucide-react";

const RANGES = [
  { key: "1h", label: "Last hour", ms: 3600_000 },
  { key: "6h", label: "6 hours", ms: 6 * 3600_000 },
  { key: "24h", label: "24 hours", ms: 24 * 3600_000 },
  { key: "7d", label: "7 days", ms: 7 * 24 * 3600_000 },
  { key: "30d", label: "30 days", ms: 30 * 24 * 3600_000 },
] as const;

const PAGE_SIZE = 15;

export default function HistoryPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("24h");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [rows, setRows] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const supabase = createClient();
      let query = supabase.from("maintenance_logs").select("*").eq("node_id", NODE_ID);

      if (useCustom && customStart && customEnd) {
        query = query.gte("created_at", new Date(customStart).toISOString()).lte("created_at", new Date(customEnd).toISOString());
      } else {
        const rangeDef = RANGES.find((r) => r.key === range)!;
        query = query.gte("created_at", new Date(Date.now() - rangeDef.ms).toISOString());
      }

      const { data } = await query.order("created_at", { ascending: true }).limit(2000);
      if (!cancelled) {
        setRows(data ?? []);
        setLoading(false);
        setPage(1);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [range, useCustom, customStart, customEnd]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => (sortDesc ? +new Date(b.created_at) - +new Date(a.created_at) : +new Date(a.created_at) - +new Date(b.created_at)));
    return copy;
  }, [rows, sortDesc]);

  const pageRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));

  const chartData = rows.map((r) => ({
    t: new Date(r.created_at).toLocaleString(),
    vibration_rms: r.vibration_rms,
    peak_current: r.peak_current,
    supercap_voltage: r.supercap_voltage,
    z_score: r.z_score,
    kurtosis: r.kurtosis,
  }));

  const exportCsv = () => {
    const header = "Timestamp,Vibration,Current,Supercap,Z-score,Kurtosis,Severity,Energy State\n";
    const body = sortedRows
      .map((r) => [r.created_at, r.vibration_rms, r.peak_current, r.supercap_voltage, r.z_score, r.kurtosis, r.severity, r.energy_state].join(","))
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enode-history-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell title="Historical Analytics">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => {
              setUseCustom(false);
              setRange(r.key);
            }}
            className={`focus-ring rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              !useCustom && range === r.key ? "border-telemetry bg-telemetry/10 text-telemetry" : "border-border text-ink-muted hover:text-ink"
            }`}
          >
            {r.label}
          </button>
        ))}
        <div className="flex items-center gap-1.5">
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="focus-ring rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-xs text-ink" />
          <span className="text-xs text-ink-muted">to</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="focus-ring rounded-lg border border-border bg-surface-raised px-2 py-1.5 text-xs text-ink" />
          <button
            onClick={() => customStart && customEnd && setUseCustom(true)}
            className={`focus-ring rounded-lg border px-3 py-1.5 text-xs font-medium ${useCustom ? "border-telemetry bg-telemetry/10 text-telemetry" : "border-border text-ink-muted hover:text-ink"}`}
          >
            Apply
          </button>
        </div>
        <div className="ml-auto">
          <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <Card><CardContent><p className="text-sm text-ink-muted">Loading records…</p></CardContent></Card>
      ) : rows.length === 0 ? (
        <Card><CardContent><EmptyState title="NO HISTORICAL DATA" description="No telemetry recorded during this period." /></CardContent></Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Vibration vs Time" dataKey="vibration_rms" data={chartData} color="hsl(var(--telemetry))" />
            <ChartCard title="Current vs Time" dataKey="peak_current" data={chartData} color="hsl(var(--warning))" />
            <ChartCard title="Supercapacitor Voltage vs Time" dataKey="supercap_voltage" data={chartData} color="hsl(var(--statistical))" />
            <ChartCard title="Z-score vs Time" dataKey="z_score" data={chartData} color="hsl(var(--critical))" />
            <ChartCard title="Kurtosis vs Time" dataKey="kurtosis" data={chartData} color="hsl(var(--healthy))" />
          </div>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Records ({sortedRows.length})</CardTitle>
              <button onClick={() => setSortDesc((s) => !s)} className="focus-ring text-xs text-ink-muted hover:text-ink">
                Sort: {sortDesc ? "Newest first" : "Oldest first"}
              </button>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border text-ink-muted">
                  <tr>
                    {["Timestamp", "Vibration", "Current", "Supercap", "Z-score", "Kurtosis", "Severity", "Energy State"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-4 py-2.5 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageRows.map((r) => (
                    <tr key={r.id} className="text-ink">
                      <td className="whitespace-nowrap px-4 py-2.5 tabular">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2.5 tabular">{formatNum(r.vibration_rms)}</td>
                      <td className="px-4 py-2.5 tabular">{formatNum(r.peak_current)}</td>
                      <td className="px-4 py-2.5 tabular">{formatNum(r.supercap_voltage)}</td>
                      <td className="px-4 py-2.5 tabular">{formatNum(r.z_score)}</td>
                      <td className="px-4 py-2.5 tabular">{formatNum(r.kurtosis)}</td>
                      <td className="px-4 py-2.5"><Badge tone={r.severity === "critical" ? "critical" : r.severity === "warning" ? "warning" : "healthy"}>{r.severity}</Badge></td>
                      <td className="whitespace-nowrap px-4 py-2.5">{r.energy_state?.replace("_", " ") ?? "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="focus-ring text-xs text-ink-muted disabled:opacity-40 hover:text-ink">
                Previous
              </button>
              <span className="text-xs text-ink-muted">Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="focus-ring text-xs text-ink-muted disabled:opacity-40 hover:text-ink">
                Next
              </button>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function ChartCard({ title, dataKey, data, color }: { title: string; dataKey: string; data: any[]; color: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="t" tick={false} stroke="hsl(var(--ink-muted))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--ink-muted))" />
            <Tooltip contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
