"use client";

import { Sparkles } from "lucide-react";

export function StartTourFab() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("start-app-tour"))}
      className="fixed bottom-6 right-6 z-[9990] inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 shadow-2xl hover:bg-emerald-400"
    >
      <Sparkles className="h-4 w-4" />
      Start tour
    </button>
  );
}
