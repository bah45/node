"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Activity,
  HeartPulse,
  BatteryCharging,
  History,
  Bell,
  Settings,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { NodeStatusBadge } from "./NodeStatusBadge";
import { NODE_ID } from "@/lib/config";

const NAV = [
  { href: "/dashboard", key: "nav.overview", icon: LayoutGrid },
  { href: "/telemetry", key: "nav.telemetry", icon: Activity },
  { href: "/health", key: "nav.health", icon: HeartPulse },
  { href: "/energy", key: "nav.energy", icon: BatteryCharging },
  { href: "/history", key: "nav.history", icon: History },
  { href: "/alerts", key: "nav.alerts", icon: Bell },
  { href: "/settings", key: "nav.settings", icon: Settings },
];

export function Sidebar({ lastSeen }: { lastSeen: string | null | undefined }) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-telemetry/15">
          <Zap className="h-4 w-4 text-telemetry" />
        </div>
        <span className="text-sm font-bold tracking-[0.2em] text-ink">E-NODE</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ href, key, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "focus-ring flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-telemetry/10 text-telemetry"
                  : "text-ink-muted hover:bg-ink/5 hover:text-ink"
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {t(key)}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <p className="text-[10px] font-semibold tracking-[0.15em] text-ink-muted">NODE</p>
        <p className="mb-2 font-mono text-xs text-ink">{NODE_ID}</p>
        <NodeStatusBadge lastSeen={lastSeen} />
      </div>
    </aside>
  );
}
