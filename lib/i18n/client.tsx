// lib/i18n/client.tsx
"use client";

import React, { createContext, useContext, useMemo } from "react";

type Messages = Record<string, string>;

type I18nContextValue = {
  locale: string;
  messages: Messages;
  t: (key: string, vars?: Record<string, any>, fallback?: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(str: string, vars?: Record<string, any>) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`).toString());
}

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: Messages;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nContextValue>(() => {
    return {
      locale,
      messages,
      t: (key, vars, fallback) => {
        const raw = messages?.[key] ?? fallback ?? key;
        return interpolate(raw, vars);
      },
    };
  }, [locale, messages]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: "en",
      messages: {},
      t: (key: string, _vars?: Record<string, any>, fallback?: string) =>
        fallback ?? key,
    };
  }
  return ctx;
}
