"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MaintenanceLog, NodeRecord } from "@/types/telemetry";
import { NODE_ID } from "@/lib/config";

interface UseLiveTelemetryResult {
  latest: MaintenanceLog | null;
  recent: MaintenanceLog[];
  node: NodeRecord | null;
  loading: boolean;
  error: string | null;
}

/**
 * Subscribes to Supabase Realtime for new `maintenance_logs` rows and keeps
 * the node's `last_seen` in sync. Every value here traces back to a row
 * actually inserted by the /api/telemetry ingest route — nothing here is
 * generated client-side.
 */
export function useLiveTelemetry(recentLimit = 50): UseLiveTelemetryResult {
  const [recent, setRecent] = useState<MaintenanceLog[]>([]);
  const [node, setNode] = useState<NodeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInitial = useCallback(async () => {
    const supabase = createClient();
    setLoading(true);
    const [{ data: logs, error: logErr }, { data: nodeRow, error: nodeErr }] = await Promise.all([
      supabase
        .from("maintenance_logs")
        .select("*")
        .eq("node_id", NODE_ID)
        .order("created_at", { ascending: false })
        .limit(recentLimit),
      supabase.from("nodes").select("*").eq("node_id", NODE_ID).maybeSingle(),
    ]);

    if (logErr) setError(logErr.message);
    if (nodeErr) setError((prev) => prev ?? nodeErr.message);

    setRecent(logs ? [...logs].reverse() : []);
    setNode(nodeRow ?? null);
    setLoading(false);
  }, [recentLimit]);

  useEffect(() => {
    fetchInitial();
    const supabase = createClient();

    const channel = supabase
      .channel("realtime-maintenance-logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "maintenance_logs", filter: `node_id=eq.${NODE_ID}` },
        (payload) => {
          const row = payload.new as MaintenanceLog;
          setRecent((prev) => [...prev.slice(-(recentLimit - 1)), row]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "nodes", filter: `node_id=eq.${NODE_ID}` },
        (payload) => {
          setNode(payload.new as NodeRecord);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInitial, recentLimit]);

  return {
    latest: recent.length ? recent[recent.length - 1] : null,
    recent,
    node,
    loading,
    error,
  };
}
