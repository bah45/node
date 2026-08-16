import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { createServiceClient } from "@/lib/supabase/server";
import { NODE_ID, MACHINE_ID, NODE_ONLINE_TIMEOUT_SECONDS } from "@/lib/config";
import { isNodeOnline } from "@/lib/utils";
import { computeHealthScore } from "@/lib/health";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are EVA (Energy & Vibration Analyst), the assistant embedded in the E-NODE
predictive maintenance dashboard. You analyze a real physical machine monitored by an ESP32-C3
edge node with vibration, current and supercapacitor-voltage sensing.

STRICT RULES:
- You may ONLY reason from the "TELEMETRY CONTEXT" block provided below. Never invent sensor
  readings, timestamps, or events that are not present in that context.
- If the context says no telemetry is available, say so plainly: "No hardware telemetry is
  currently available." Do not guess a plausible-sounding value.
- If the node is offline, state that clearly and reference the last known reading with its
  timestamp, explicitly labeled as "last known" rather than live.
- Always separate: Measured (raw numbers from telemetry), Interpretation (what the numbers
  suggest against known thresholds), and Recommendation (a cautious, non-diagnostic suggestion).
- Never claim a specific component (e.g. "the bearing") has definitively failed. Use cautious
  language like "may indicate mechanical degradation; inspection recommended if the trend persists."
- Keep answers concise (3-6 sentences) unless asked for detail.`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();
    const supabase = createServiceClient();

    const [{ data: node }, { data: recentLogs }, { data: recentAlerts }] = await Promise.all([
      supabase.from("nodes").select("*").eq("node_id", NODE_ID).maybeSingle(),
      supabase
        .from("maintenance_logs")
        .select("*")
        .eq("node_id", NODE_ID)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("alerts")
        .select("*")
        .eq("node_id", NODE_ID)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const online = isNodeOnline(node?.last_seen, NODE_ONLINE_TIMEOUT_SECONDS);
    const health = recentLogs ? computeHealthScore(recentLogs.slice().reverse() as any) : { score: null, label: "INSUFFICIENT DATA" as const };

    let context: string;
    if (!recentLogs || recentLogs.length === 0) {
      context = `No telemetry has ever been received from node ${NODE_ID} / machine ${MACHINE_ID}. There is nothing to analyze yet.`;
    } else {
      const latest = recentLogs[0];
      context = [
        `Machine: ${MACHINE_ID}. Node: ${NODE_ID}.`,
        `Node online right now: ${online ? "YES" : "NO"}. Last seen: ${node?.last_seen ?? "unknown"}.`,
        `Latest telemetry (${latest.created_at}): vibration_rms=${latest.vibration_rms}, peak_current=${latest.peak_current}, supercap_voltage=${latest.supercap_voltage}, z_score=${latest.z_score}, kurtosis=${latest.kurtosis}, panic=${latest.panic}, severity=${latest.severity}, energy_state=${latest.energy_state}.`,
        `Computed health score from last ${recentLogs.length} records: ${health.score ?? "insufficient data"} (${health.label}).`,
        `Recent alerts: ${
          recentAlerts && recentAlerts.length
            ? recentAlerts.map((a: any) => `[${a.created_at}] ${a.severity.toUpperCase()} — ${a.title} (${a.trigger_reason})`).join(" | ")
            : "none recorded"
        }`,
      ].join("\n");
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({
        reply:
          recentLogs && recentLogs.length
            ? `EVA (offline mode — AI key not configured):\n${context}`
            : "No hardware telemetry is currently available for analysis.",
      });
    }

    const result = await generateText({
      model: google("gemini-1.5-flash"),
      system: SYSTEM_PROMPT,
      messages: [
        { role: "system", content: `TELEMETRY CONTEXT:\n${context}` },
        ...(Array.isArray(messages) ? messages : []),
      ],
    });

    return NextResponse.json({ reply: result.text });
  } catch (err) {
    console.error("chat route error", err);
    return NextResponse.json({ reply: "EVA could not analyze telemetry right now due to a service error." }, { status: 500 });
  }
}
