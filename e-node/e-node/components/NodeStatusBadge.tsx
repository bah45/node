"use client";

import { useNodeOnline } from "@/hooks/useNodeOnline";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function NodeStatusBadge({ lastSeen, compact = false }: { lastSeen: string | null | undefined; compact?: boolean }) {
  const online = useNodeOnline(lastSeen);

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            online ? "bg-healthy animate-pulseDot" : "bg-offline"
          )}
        />
        <span className={cn("text-xs font-semibold tracking-wider", online ? "text-healthy" : "text-offline")}>
          {online ? "ONLINE" : "OFFLINE"}
        </span>
      </div>
      {!compact && (
        <span className="text-[11px] text-ink-muted">
          {lastSeen ? `Last telemetry: ${timeAgo(lastSeen)}` : "No telemetry received"}
        </span>
      )}
    </div>
  );
}
