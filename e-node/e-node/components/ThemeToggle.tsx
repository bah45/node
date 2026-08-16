"use client";

import { useTheme } from "@/lib/theme";
import { Sun, Moon, MonitorSmartphone } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { key: "light", icon: Sun, label: "Light" },
  { key: "dark", icon: Moon, label: "Dark" },
  { key: "system", icon: MonitorSmartphone, label: "System" },
] as const;

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-raised p-0.5">
      {OPTIONS.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          aria-label={label}
          aria-pressed={mode === key}
          onClick={() => setMode(key)}
          className={cn(
            "focus-ring rounded-md p-1.5 transition-colors",
            mode === key ? "bg-telemetry text-white" : "text-ink-muted hover:text-ink"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
