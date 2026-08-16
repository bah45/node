"use client";

import { useEffect, useState } from "react";
import { Bell, LogOut, UserRound } from "lucide-react";
import { LanguageSelector } from "./LanguageSelector";
import { ThemeToggle } from "./ThemeToggle";
import { NodeStatusBadge } from "./NodeStatusBadge";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function Topbar({
  title,
  lastSeen,
  unacknowledgedCount,
}: {
  title: string;
  lastSeen: string | null | undefined;
  unacknowledgedCount: number;
}) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur lg:px-6">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold text-ink">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:block">
          <NodeStatusBadge lastSeen={lastSeen} compact />
        </div>
        <div className="hidden sm:block">
          <LanguageSelector />
        </div>
        <ThemeToggle />
        <button
          aria-label="Notifications"
          className="focus-ring relative rounded-lg border border-border bg-surface-raised p-2 text-ink-muted hover:text-ink"
        >
          <Bell className="h-4 w-4" />
          {unacknowledgedCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-bold text-white">
              {unacknowledgedCount}
            </span>
          )}
        </button>
        <div className="hidden items-center gap-2 rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 md:flex">
          <UserRound className="h-3.5 w-3.5 text-ink-muted" />
          <span className="max-w-[140px] truncate text-xs text-ink-muted">{email ?? "Operator"}</span>
          <button aria-label="Sign out" onClick={signOut} className="focus-ring text-ink-muted hover:text-critical">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
