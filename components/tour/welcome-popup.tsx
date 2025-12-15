"use client";

import { useEffect, useState } from "react";

import { createPortal } from "react-dom";
import { useAppTour } from "@/components/tour/app-tour-provider";

export function TourWelcomePopup() {
  const { welcomeOpen, closeWelcome, startFromWelcome } = useAppTour();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted || !welcomeOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9998]">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={closeWelcome} />
      <div className="absolute left-1/2 top-1/2 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white shadow-xl dark:bg-slate-950 dark:border-slate-800">
        <div className="p-5">
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Welcome 👋
          </div>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Want a quick guided tour of the dashboard? You can skip anytime.
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeWelcome}
              className="rounded-xl px-3 py-2 text-sm border dark:border-slate-800"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={startFromWelcome}
              className="rounded-xl px-3 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Start tour
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
