"use client";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { AIAssistant } from "./AIAssistant";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { NODE_ID } from "@/lib/config";

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const [{ data: node }, { count }] = await Promise.all([
        supabase.from("nodes").select("last_seen").eq("node_id", NODE_ID).maybeSingle(),
        supabase
          .from("alerts")
          .select("id", { count: "exact", head: true })
          .eq("node_id", NODE_ID)
          .eq("acknowledged", false),
      ]);
      setLastSeen(node?.last_seen ?? null);
      setUnacknowledgedCount(count ?? 0);
    };
    load();

    const channel = supabase
      .channel("shell-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "nodes", filter: `node_id=eq.${NODE_ID}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `node_id=eq.${NODE_ID}` }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar lastSeen={lastSeen} />
      <div className="flex min-w-0 flex-1 flex-col pb-14 lg:pb-0">
        <Topbar title={title} lastSeen={lastSeen} unacknowledgedCount={unacknowledgedCount} />
        <main className="flex-1 px-4 py-5 lg:px-6 lg:py-6">{children}</main>
      </div>
      <MobileNav />
      <AIAssistant />
    </div>
  );
}
