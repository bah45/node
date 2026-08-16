"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import en from "./en.json";
import ta from "./ta.json";
import hi from "./hi.json";

export const LOCALES = ["en", "ta", "hi"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ta: "தமிழ்",
  hi: "हिन्दी",
};

const DICTS: Record<Locale, Record<string, string>> = { en, ta, hi };
const STORAGE_KEY = "enode-locale";

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored && LOCALES.includes(stored as Locale)) {
      setLocaleState(stored as Locale);
    }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, l);
  };

  const t = useMemo(() => {
    const dict = DICTS[locale];
    return (key: string) => dict[key] ?? DICTS.en[key] ?? key;
  }, [locale]);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
