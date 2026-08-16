"use client";

import { useEffect, useState } from "react";
import { isNodeOnline } from "@/lib/utils";
import { NODE_ONLINE_TIMEOUT_SECONDS } from "@/lib/config";

/** Re-derives online/offline every second from the real last_seen timestamp — never a static flag. */
export function useNodeOnline(lastSeen: string | null | undefined) {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const tick = () => setOnline(isNodeOnline(lastSeen, NODE_ONLINE_TIMEOUT_SECONDS));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastSeen]);

  return online;
}
