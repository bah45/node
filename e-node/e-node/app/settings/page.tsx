"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { NODE_ID, MACHINE_ID, NODE_ONLINE_TIMEOUT_SECONDS, ALERT_COOLDOWN_SECONDS } from "@/lib/config";
import { useNodeOnline } from "@/hooks/useNodeOnline";
import { timeAgo } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import type { NodeRecord } from "@/types/telemetry";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const { mode, setMode } = useTheme();
  const [email, setEmail] = useState<string | null>(null);
  const [node, setNode] = useState<NodeRecord | null>(null);
  const online = useNodeOnline(node?.last_seen);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    supabase
      .from("nodes")
      .select("*")
      .eq("node_id", NODE_ID)
      .maybeSingle()
      .then(({ data }) => setNode(data ?? null));
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <AppShell title="Settings">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Operator Account</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Row label="Name" value="Operator" />
            <Row label="Email" value={email ?? "--"} />
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" disabled>Change Password</Button>
              <Button variant="destructive" onClick={signOut}>Sign Out</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Node Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Row label="Node ID" value={NODE_ID} mono />
            <Row label="Machine ID" value={MACHINE_ID} mono />
            <Row label="Firmware Version" value={node?.firmware_version ?? "Not reported by device"} />
            <Row label="Online Timeout" value={`${NODE_ONLINE_TIMEOUT_SECONDS}s (env: NODE_ONLINE_TIMEOUT_SECONDS)`} />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-muted">Status</span>
              <Badge tone={online ? "healthy" : "offline"}>{online ? "ONLINE" : "OFFLINE"}</Badge>
            </div>
            <Row label="Last Seen" value={node?.last_seen ? timeAgo(node.last_seen) : "never"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Alert Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Row label="Email Recipient" value="Configured via ALERT_RECIPIENT_EMAIL" />
            <Row label="SMS Webhook" value="Configured via SMS_ALERT_WEBHOOK_URL" />
            <Row label="Alert Cooldown" value={`${ALERT_COOLDOWN_SECONDS}s`} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {(["light", "dark", "system"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`focus-ring flex-1 rounded-lg border px-3 py-2.5 text-xs font-medium capitalize transition-colors ${
                    mode === m ? "border-telemetry bg-telemetry/10 text-telemetry" : "border-border text-ink-muted hover:text-ink"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-muted">Preference persists between sessions on this device.</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Node Diagnostics</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Row label="Wi-Fi RSSI" value={node?.wifi_rssi != null ? `${node.wifi_rssi} dBm` : "Not reported by device"} />
            <Row label="Uptime" value={node?.uptime_seconds != null ? `${Math.floor(node.uptime_seconds / 60)} min` : "Not reported by device"} />
            <Row label="API Connectivity" value="Reachable" />
            <Row label="Supabase Connectivity" value={node ? "Reachable" : "Unknown"} />
            <Row label="Sensor Status" value="Not reported by device" />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      <span className={`text-xs text-ink ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
