// app/(dashboard)/providers.tsx
"use client";

import { I18nProvider } from "@/lib/i18n/client";

export default function DashboardProviders({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: any;
  children: React.ReactNode;
}) {
  return (
    <I18nProvider locale={locale} messages={messages}>
      {children}
    </I18nProvider>
  );
}
