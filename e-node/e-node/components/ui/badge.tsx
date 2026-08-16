import { cn } from "@/lib/utils";
import React from "react";

type Tone = "healthy" | "telemetry" | "warning" | "critical" | "statistical" | "offline" | "neutral";

const toneClasses: Record<Tone, string> = {
  healthy: "bg-healthy/10 text-healthy border-healthy/30",
  telemetry: "bg-telemetry/10 text-telemetry border-telemetry/30",
  warning: "bg-warning/10 text-warning border-warning/30",
  critical: "bg-critical/10 text-critical border-critical/30",
  statistical: "bg-statistical/10 text-statistical border-statistical/30",
  offline: "bg-offline/10 text-offline border-offline/30",
  neutral: "bg-ink/5 text-ink-muted border-border",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium tabular",
        toneClasses[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
