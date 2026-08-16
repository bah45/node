"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function AIAssistant() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? t("ai.unavailable") }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "EVA could not reach the analysis service. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        aria-label="Open EVA assistant"
        onClick={() => setOpen((o) => !o)}
        className="focus-ring fixed bottom-20 right-4 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-statistical p-3.5 text-white shadow-lg transition-transform hover:scale-105 lg:bottom-6 lg:right-6"
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed bottom-36 right-4 z-50 flex h-[28rem] w-[22rem] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl lg:bottom-24 lg:right-6">
          <div className="flex items-center gap-2 border-b border-border bg-statistical/10 px-4 py-3">
            <Sparkles className="h-4 w-4 text-statistical" />
            <div>
              <p className="text-sm font-semibold text-ink">{t("ai.name")}</p>
              <p className="text-[11px] text-ink-muted">{t("ai.subtitle")}</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-xs leading-relaxed text-ink-muted">
                Ask EVA about the machine&apos;s condition — e.g. &quot;Is the machine healthy?&quot; or &quot;When was the last emergency?&quot;
                EVA only reasons from real telemetry stored in Supabase and will say so plainly when data is missing.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                  m.role === "user"
                    ? "ml-auto bg-telemetry text-white"
                    : "bg-surface-raised text-ink border border-border"
                )}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> EVA is analyzing telemetry…
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask about machine health…"
              className="focus-ring flex-1 rounded-lg border border-border bg-surface-raised px-3 py-2 text-xs text-ink outline-none"
            />
            <button
              aria-label="Send"
              onClick={send}
              disabled={loading}
              className="focus-ring rounded-lg bg-statistical p-2 text-white disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
