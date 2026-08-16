import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { evaluateTelemetry } from "@/lib/anomaly";
import { deriveEnergyState, ALERT_COOLDOWN_SECONDS, NODE_ID, MACHINE_ID } from "@/lib/config";
import { Resend } from "resend";

export const runtime = "nodejs";

const payloadSchema = z.object({
  vibration_rms: z.number().finite(),
  peak_current: z.number().finite(),
  supercap_voltage: z.number().finite(),
  kurtosis: z.number().finite(),
  z_score: z.number().finite(),
  variance: z.number().finite().optional(),
  panic: z.boolean(),
  wifi_rssi: z.number().finite().optional(),
  firmware_version: z.string().max(32).optional(),
  uptime_seconds: z.number().finite().optional(),
  node_id: z.string().max(64).optional(),
  machine_id: z.string().max(64).optional(),
});

// Simple in-memory rate limiter (per-process). For multi-instance deployments,
// replace with a shared store (e.g. Upstash Redis) — noted in README.
const rateLimitWindowMs = 1000;
const rateLimitMax = 5;
const rateLimitBuckets = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now - bucket.windowStart > rateLimitWindowMs) {
    rateLimitBuckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > rateLimitMax;
}

export async function POST(req: NextRequest) {
  try {
    const deviceKey = req.headers.get("x-device-api-key");
    if (!deviceKey || deviceKey !== process.env.ESP32_DEVICE_API_KEY) {
      return NextResponse.json({ ok: false, error: "unauthorized_device" }, { status: 401 });
    }

    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const json = await req.json().catch(() => null);
    if (!json) {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const parsed = payloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const nodeId = payload.node_id ?? NODE_ID;
    const machineId = payload.machine_id ?? MACHINE_ID;
    const nowIso = new Date().toISOString();

    const evaluation = evaluateTelemetry({
      vibration_rms: payload.vibration_rms,
      peak_current: payload.peak_current,
      z_score: payload.z_score,
      kurtosis: payload.kurtosis,
      panic: payload.panic,
    });
    const energyState = deriveEnergyState(payload.supercap_voltage);

    const supabase = createServiceClient();

    const { data: logRow, error: insertError } = await supabase
      .from("maintenance_logs")
      .insert({
        node_id: nodeId,
        machine_id: machineId,
        vibration_rms: payload.vibration_rms,
        peak_current: payload.peak_current,
        supercap_voltage: payload.supercap_voltage,
        kurtosis: payload.kurtosis,
        z_score: payload.z_score,
        variance: payload.variance ?? null,
        panic: payload.panic,
        severity: evaluation.severity,
        anomaly_detected: evaluation.anomaly_detected,
        trigger_reason: evaluation.trigger_reason,
        energy_state: energyState,
        created_at: nowIso,
      })
      .select()
      .single();

    if (insertError) {
      console.error("telemetry insert failed", insertError);
      return NextResponse.json({ ok: false, error: "db_insert_failed" }, { status: 500 });
    }

    const { error: upsertError } = await supabase.from("nodes").upsert(
      {
        node_id: nodeId,
        machine_id: machineId,
        last_seen: nowIso,
        status: evaluation.severity === "critical" ? "critical" : "online",
        energy_state: energyState,
        firmware_version: payload.firmware_version ?? undefined,
        wifi_rssi: payload.wifi_rssi ?? undefined,
        uptime_seconds: payload.uptime_seconds ?? undefined,
      },
      { onConflict: "node_id" }
    );
    if (upsertError) console.error("node upsert failed", upsertError);

    if (evaluation.severity === "critical" || evaluation.anomaly_detected) {
      await maybeTriggerAlert(supabase, {
        nodeId,
        machineId,
        severity: evaluation.severity,
        triggerReason: evaluation.trigger_reason ?? "threshold exceeded",
        payload,
      });
    }

    return NextResponse.json({ ok: true, id: logRow.id, severity: evaluation.severity, energy_state: energyState });
  } catch (err) {
    console.error("telemetry route error", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}

async function maybeTriggerAlert(
  supabase: ReturnType<typeof createServiceClient>,
  args: {
    nodeId: string;
    machineId: string;
    severity: "info" | "warning" | "critical";
    triggerReason: string;
    payload: z.infer<typeof payloadSchema>;
  }
) {
  const cooldownStart = new Date(Date.now() - ALERT_COOLDOWN_SECONDS * 1000).toISOString();
  const { data: recentAlerts } = await supabase
    .from("alerts")
    .select("id, created_at")
    .eq("node_id", args.nodeId)
    .eq("trigger_reason", args.triggerReason)
    .gte("created_at", cooldownStart)
    .limit(1);

  if (recentAlerts && recentAlerts.length > 0) {
    return; // cooldown active — do not spam duplicate alerts
  }

  const title =
    args.severity === "critical" ? `Emergency on ${args.machineId}` : `Anomaly detected on ${args.machineId}`;
  const message = `Node ${args.nodeId} reported: ${args.triggerReason}. Vibration RMS ${args.payload.vibration_rms}, peak current ${args.payload.peak_current}, supercap ${args.payload.supercap_voltage}V.`;

  const { error: alertInsertError } = await supabase.from("alerts").insert({
    node_id: args.nodeId,
    machine_id: args.machineId,
    severity: args.severity,
    title,
    message,
    trigger_reason: args.triggerReason,
    acknowledged: false,
  });
  if (alertInsertError) {
    console.error("alert insert failed", alertInsertError);
    return;
  }

  await Promise.allSettled([sendEmailAlert(title, message), sendSmsWebhook(title, message)]);
}

async function sendEmailAlert(title: string, message: string) {
  if (!process.env.RESEND_API_KEY || !process.env.ALERT_RECIPIENT_EMAIL) return;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "E-NODE Alerts <alerts@enode.dev>",
      to: process.env.ALERT_RECIPIENT_EMAIL,
      subject: `[E-NODE] ${title}`,
      text: message,
    });
  } catch (err) {
    console.error("resend email failed", err);
  }
}

async function sendSmsWebhook(title: string, message: string) {
  if (!process.env.SMS_ALERT_WEBHOOK_URL) return;
  try {
    await fetch(process.env.SMS_ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, message }),
    });
  } catch (err) {
    console.error("sms webhook failed", err);
  }
}
