"use client";

import { useI18n, LOCALES, LOCALE_LABELS } from "@/lib/i18n";
import { Languages } from "lucide-react";

export function LanguageSelector() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="relative flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-2 py-1.5">
      <Languages className="h-3.5 w-3.5 text-ink-muted" />
      <select
        aria-label="Select language"
        value={locale}
        onChange={(e) => setLocale(e.target.value as any)}
        className="focus-ring bg-transparent text-xs font-medium text-ink outline-none"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} className="bg-surface text-ink">
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </div>
  );
}
