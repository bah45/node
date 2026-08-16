"use client";

import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { formatNum, cn } from "@/lib/utils";
import { ENERGY_THRESHOLDS, ENERGY_STATES } from "@/lib/config";
import { BatteryCharging, Cpu, Wifi, Clock, Cog } from "lucide-react";

const STATE_ORDER = [
  ENERGY_STATES.HIGH_ENERGY,
  ENERGY_STATES.NORMAL,
  ENERGY_STATES.ENERGY_SAVING,
  ENERGY_STATES.CRITICAL_ENERGY,
];

const STATE_LABEL: Record<string, string> = {
  HIGH_ENERGY: "HIGH ENERGY",
  NORMAL: "NORMAL OPERATION",
  ENERGY_SAVING: "ENERGY SAVING",
  CRITICAL_ENERGY: "CRITICAL ENERGY",
};

const STATE_TONE: Record<string, "healthy" | "telemetry" | "warning" | "critical"> = {
  HIGH_ENERGY: "healthy",
  NORMAL: "telemetry",
  ENERGY_SAVING: "warning",
  CRITICAL_ENERGY: "critical",
};

const STATE_BEHAVIOR: Record<string, { sensing: string; wifi: string; interval: string; processing: string }> = {
  HIGH_ENERGY: { sensing: "Normal / high-rate sensing", wifi: "Normal Wi-Fi activity", interval: "Regular transmission interval", processing: "Full local statistical processing" },
  NORMAL: { sensing: "Standard sensing rate", wifi: "Standard Wi-Fi activity", interval: "Standard transmission interval", processing: "Standard local processing" },
  ENERGY_SAVING: { sensing: "Reduced sensing rate", wifi: "Reduced Wi-Fi activity", interval: "Increased transmission interval, buffered", processing: "Local anomaly detection continues" },
  CRITICAL_ENERGY: { sensing: "Minimal sensing", wifi: "Minimized communication", interval: "Communication reserved for emergencies", processing: "Essential safety monitoring only" },
};

export default function EnergyPage() {
  const { recent } = useLiveTelemetry(50);
  const latest = recent.length ? recent[recent.length - 1] : null;
  const currentState = latest?.energy_state ?? null;

  return (
    <AppShell title="Energy Intelligence">
      {!latest ? (
        <Card><CardContent><EmptyState title="NO TELEMETRY RECEIVED" description="Waiting for ESP32-C3 telemetry." /></CardContent></Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Supercapacitor</CardTitle></CardHeader>
            <CardContent className="flex flex-col items-center py-8">
              <BatteryCharging className="mb-2 h-8 w-8 text-statistical" />
              <span className="text-5xl font-bold tabular text-ink">{formatNum(latest.supercap_voltage)}V</span>
              {currentState && (
                <Badge tone={STATE_TONE[currentState] ?? "offline"} className="mt-3">
                  {STATE_LABEL[currentState] ?? currentState}
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Energy-Aware State Machine</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col items-stretch gap-2">
                {STATE_ORDER.map((s, i) => (
                  <div key={s} className="flex flex-col items-center">
                    <div
                      className={cn(
                        "w-full rounded-lg border px-4 py-3 text-center text-sm font-semibold tracking-wide",
                        currentState === s
                          ? "border-telemetry bg-telemetry/10 text-telemetry"
                          : "border-border bg-surface-raised text-ink-muted"
                      )}
                    >
                      {STATE_LABEL[s]}
                    </div>
                    {i < STATE_ORDER.length - 1 && <div className="my-1 h-4 w-px bg-border" />}
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-critical/30 bg-critical/5 px-4 py-3 text-center text-sm font-semibold text-critical">
                ANY EMERGENCY → EMERGENCY PRIORITY (overrides energy-saving behavior)
              </div>
              <p className="mt-3 text-[11px] text-ink-muted">
                Thresholds — High ≥ {ENERGY_THRESHOLDS.highEnergyMinV}V · Normal ≥ {ENERGY_THRESHOLDS.normalMinV}V · Energy Saving ≥{" "}
                {ENERGY_THRESHOLDS.energySavingMinV}V · below that is Critical.
              </p>
            </CardContent>
          </Card>

          {currentState && STATE_BEHAVIOR[currentState] && (
            <Card>
              <CardHeader><CardTitle>Current Firmware Behavior</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <BehaviorItem icon={Cpu} label="Sensing" text={STATE_BEHAVIOR[currentState].sensing} />
                <BehaviorItem icon={Wifi} label="Wi-Fi" text={STATE_BEHAVIOR[currentState].wifi} />
                <BehaviorItem icon={Clock} label="Transmission" text={STATE_BEHAVIOR[currentState].interval} />
                <BehaviorItem icon={Cog} label="Processing" text={STATE_BEHAVIOR[currentState].processing} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Energy Harvesting</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-center gap-2 py-4 text-center text-xs font-medium text-ink-muted">
                {["Machine Vibration", "Energy Harvester", "LTC3588-1", "0.5F Supercapacitor", "ESP32-C3"].map((step, i, arr) => (
                  <div key={step} className="flex items-center gap-2">
                    <span className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-ink">{step}</span>
                    {i < arr.length - 1 && <span className="text-ink-muted">→</span>}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-center text-xs text-ink-muted">Harvested power measurement unavailable — the current firmware does not report it.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function BehaviorItem({ icon: Icon, label, text }: { icon: any; label: string; text: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-3">
      <div className="mb-1.5 flex items-center gap-2 text-ink-muted">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xs text-ink">{text}</p>
    </div>
  );
}
