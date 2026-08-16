"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Activity, HeartPulse, BatteryCharging, History, Bell, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/telemetry", label: "Live", icon: Activity },
  { href: "/health", label: "Health", icon: HeartPulse },
  { href: "/energy", label: "Energy", icon: BatteryCharging },
  { href: "/history", label: "History", icon: History },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-border bg-surface/95 backdrop-blur lg:hidden">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "focus-ring flex min-w-[68px] flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[10px] font-medium",
              active ? "text-telemetry" : "text-ink-muted"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
