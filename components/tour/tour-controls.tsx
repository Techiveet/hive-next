// app/components/tour/tour-controls.tsx
"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type StepLite = { id: string; title: string };

type RuntimeTour = {
  isActive: boolean;
  steps: { id: string; title: string }[];
};

type TourApiResponse = { tour: RuntimeTour | null };

export function TourControls({
  tourKey = "dashboard",
  className,
}: {
  tourKey?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<StepLite[]>([]);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // load steps automatically from your API
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/tours/runtime?key=${encodeURIComponent(tourKey)}`,
          {
            cache: "no-store",
          }
        );

        const data = (await res.json()) as TourApiResponse;

        if (cancelled) return;

        if (
          !data.tour ||
          !data.tour.isActive ||
          !Array.isArray(data.tour.steps)
        ) {
          setSteps([]);
          return;
        }

        setSteps(
          data.tour.steps
            .filter((s) => s?.id && s?.title)
            .map((s) => ({ id: s.id, title: s.title }))
        );
      } catch {
        if (!cancelled) setSteps([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tourKey]);

  // close dropdown on outside click
  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      if (!wrap.contains(e.target as Node)) setOpen(false);
    };

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const items = useMemo(() => steps ?? [], [steps]);
  const hasSteps = items.length > 0;

  return (
    <div
      ref={wrapRef}
      className={cn("relative flex items-center gap-2", className)}
    >
      {/* ✅ Start Tour */}
      <button
        data-tour="start-tour"
        type="button"
        onClick={() => window.dispatchEvent(new Event("start-app-tour"))}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2",
          "text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20",
          "hover:bg-emerald-400 active:scale-[0.99]"
        )}
      >
        <Sparkles className="h-4 w-4" />
        Start Tour
      </button>

     
      {open && hasSteps && (
        <div className="absolute right-0 top-[110%] z-50 w-[280px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
          <div className="border-b border-white/10 px-3 py-2 text-[11px] text-slate-400">
            Jump to step
          </div>

          <div className="max-h-[260px] overflow-y-auto">
            {items.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  window.dispatchEvent(
                    new CustomEvent("tour:go-to", {
                      detail: { stepId: s.id, index: idx },
                    })
                  );
                }}
                className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-white/10"
              >
                <div className="font-semibold">{s.title}</div>
                <div className="text-[11px] text-slate-400">
                  #{idx + 1} • {s.id}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
