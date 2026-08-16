"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { createClient } from "@/lib/supabase/client";
import { NODE_ID } from "@/lib/config";
import { timeAgo } from "@/lib/utils";
import type { AlertRecord } from "@/types/telemetry";
import { CheckCircle2 } from "lucide-react";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "unacknowledged">("all");

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("alerts")
      .select("*")
      .eq("node_id", NODE_ID)
      .order("created_at", { ascending: false })
      .limit(200);
    setAlerts(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel("alerts-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `node_id=eq.${NODE_ID}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const acknowledge = async (id: string) => {
    await fetch("/api/alerts/acknowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  const filtered = alerts.filter((a) => {
    if (filter === "all") return true;
    if (filter === "unacknowledged") return !a.acknowledged;
    return a.severity === filter;
  });

  return (
    <AppShell title="Alerts & Anomalies">
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "critical", "warning", "unacknowledged"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`focus-ring rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              filter === f ? "border-telemetry bg-telemetry/10 text-telemetry" : "border-border text-ink-muted hover:text-ink"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <Card><CardContent><p className="text-sm text-ink-muted">Loading alerts…</p></CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent><EmptyState title="No alerts recorded." description="Emergency alerts, statistical anomalies and critical-energy events will appear here as real telemetry triggers them." /></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge tone={a.severity === "critical" ? "critical" : a.severity === "warning" ? "warning" : "neutral"}>
                      {a.severity.toUpperCase()}
                    </Badge>
                    {a.acknowledged && (
                      <span className="flex items-center gap-1 text-[11px] text-healthy">
                        <CheckCircle2 className="h-3 w-3" /> Acknowledged
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-ink">{a.title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{a.message}</p>
                  <p className="mt-1 text-[11px] text-ink-muted">
                    {a.machine_id} · {a.node_id} · {timeAgo(a.created_at)} · trigger: {a.trigger_reason}
                  </p>
                </div>
                {!a.acknowledged && (
                  <Button variant="secondary" onClick={() => acknowledge(a.id)}>
                    Acknowledge
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
