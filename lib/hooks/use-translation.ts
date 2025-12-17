"use client";

import { useAppConfig } from "@/components/providers/app-config-provider";

export function useTranslation() {
  const { dictionary } = useAppConfig();

  const t = (key: string, fallback?: string) => {
    if (!dictionary) return fallback || key;
    
    // Access key safely
    const value = dictionary[key];
    
    // If translation exists, return it. Otherwise return fallback.
    return value || fallback || key;
  };

  return { t };
}