"use client";

import { de, enUS, es, fr } from "date-fns/locale";

import { format } from "date-fns"; // Make sure to install: npm install date-fns
import { useAppConfig } from "@/components/providers/app-config-provider";

// Import other locales as needed

const locales: Record<string, any> = {
  en: enUS,
  es: es,
  fr: fr,
  de: de,
  am: enUS, // Fallback for Amharic if not supported by date-fns directly
};

export function useFormattedDate() {
  const { timezone, locale, dateFormat, timeFormat } = useAppConfig();

  const formatDate = (date: Date | string | number) => {
    const d = new Date(date);
    
    // Note: handling 'timezone' strictly usually requires 'date-fns-tz', 
    // but for simple display, formatting typically uses the browser's local time 
    // or the server time. 
    
    return format(d, dateFormat, {
      locale: locales[locale] || enUS,
    });
  };

  const formatTime = (date: Date | string | number) => {
    const d = new Date(date);
    return format(d, timeFormat, {
      locale: locales[locale] || enUS,
    });
  };

  const formatDateTime = (date: Date | string | number) => {
    return `${formatDate(date)} ${formatTime(date)}`;
  };

  return { formatDate, formatTime, formatDateTime };
}