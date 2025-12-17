"use client";

import { Mail } from "lucide-react";
import { useTranslation } from "@/lib/hooks/use-translation";

export function EmailPagePlaceholder() {
  const { t } = useTranslation();

  return (
    <div className="hidden flex-1 lg:flex h-full flex-col items-center justify-center rounded-xl bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 p-8 text-center">
      <div className="relative mb-6 rounded-full bg-slate-50 p-6 dark:bg-slate-800">
        <Mail className="h-12 w-12 text-slate-300" />
        <div className="absolute right-5 top-5 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-slate-900" />
      </div>

      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        {t("email.page.placeholder.title", "Select an email to read")}
      </h2>

      <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto">
        {t("email.page.placeholder.subtitle", "Choose a message from the list to view its details.")}
      </p>
    </div>
  );
}
