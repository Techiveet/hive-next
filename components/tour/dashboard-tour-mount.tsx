"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AppTourProvider, type TourStep, useAppTour } from "./app-tour-provider";
import { AppTourUI } from "./app-tour-ui";
import { cn } from "@/lib/utils";

type RuntimeTour = {
  id: string;
  tenantKey: string;
  key: string;
  name: string;
  isActive: boolean;
  version: number;
  steps: TourStep[];
};

type TourApiResponse = { tour: RuntimeTour | null; error?: string };

const SIDEBAR_RECT = { x: 3, y: 1, width: 254, height: 744 } as const;

function withSidebarRect(steps: TourStep[]): TourStep[] {
  return (steps ?? []).map((s) => {
    const isSidebar =
      s.id === "sidebar" || String(s.selector).includes('[data-tour="sidebar"]');

    if (!isSidebar) return s;

    return {
      ...s,
      rect: { ...SIDEBAR_RECT },
      placement: s.placement ?? "right",
    };
  });
}

async function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isSelectorReady(step: TourStep) {
  // allow rect-only steps
  const anyStep: any = step as any;
  const rectOk =
    !!anyStep?.rect &&
    Number.isFinite(anyStep.rect?.x) &&
    Number.isFinite(anyStep.rect?.y) &&
    Number.isFinite(anyStep.rect?.width) &&
    Number.isFinite(anyStep.rect?.height);

  if (rectOk) return true;
  return !!document.querySelector(step.selector);
}

function DashboardTourInner({
  userId,
  tenantKey,
  tourKey,
  tourVersion,
  steps,
  isEnabled,
}: {
  userId: string;
  tenantKey: string;
  tourKey: string;
  tourVersion: number;
  steps: TourStep[];
  isEnabled: boolean;
}) {
  const { start, stop, isOpen } = useAppTour();
  const pathname = usePathname();
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  const getStepsWhenReady = useCallback(
    async (timeoutMs = 2500) => {
      if (!isEnabled) return [];

      // allow paint
      await new Promise((r) => requestAnimationFrame(() => r(null)));

      const started = Date.now();

      while (Date.now() - started < timeoutMs) {
        const allReady = steps.every((s) => isSelectorReady(s));
        if (allReady) return steps;
        await wait(60);
      }

      // fallback: run what exists
      return steps.filter((s) => isSelectorReady(s));
    },
    [steps, isEnabled]
  );

  // stop on route change
  useEffect(() => {
    if (isOpen) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // manual start event
  useEffect(() => {
    const handler = async () => {
      const runnable = await getStepsWhenReady();
      if (runnable.length) start(runnable, 0);
    };

    window.addEventListener("start-app-tour", handler as any);
    return () => window.removeEventListener("start-app-tour", handler as any);
  }, [start, getStepsWhenReady]);

  // welcome modal (once)
  useEffect(() => {
    if (!isEnabled) return;

    const key = `hive:welcome-tour-shown:${tenantKey}:${tourKey}:v${tourVersion}:${userId}`;
    if (!localStorage.getItem(key)) {
      setWelcomeOpen(true);
      localStorage.setItem(key, "1");
    }
  }, [tenantKey, tourKey, tourVersion, userId, isEnabled]);

  return (
    <>
      <AppTourUI />

      {welcomeOpen && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4">
          <div className="w-[420px] max-w-full rounded-2xl border border-white/10 bg-slate-950 p-5 text-slate-50 shadow-2xl">
            <div className="text-base font-semibold">Welcome to Hive 👋</div>
            <div className="mt-1 text-sm text-slate-300">Want a quick guided tour of the app?</div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setWelcomeOpen(false)}
                className="rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
              >
                Maybe later
              </button>

              <button
                type="button"
                onClick={async () => {
                  setWelcomeOpen(false);
                  const runnable = await getStepsWhenReady();
                  if (runnable.length) start(runnable, 0);
                }}
                className={cn(
                  "rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950",
                  "hover:bg-emerald-400"
                )}
              >
                Start tour
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function DashboardTourMount({ userId, tenantKey }: { userId: string; tenantKey: string }) {
  const pathname = usePathname();
  const tourKey = "dashboard";

  const [isEnabled, setIsEnabled] = useState(false);
  const [tourVersion, setTourVersion] = useState(1);
  const [steps, setSteps] = useState<TourStep[]>([]);

  const fallbackSteps: TourStep[] = useMemo(
    () =>
      withSidebarRect([
        {
          id: "sidebar",
          selector: '[data-tour="sidebar"]',
          title: "Sidebar Navigation",
          body: "Use the sidebar to move between modules quickly.",
          placement: "right",
        },
        {
          id: "content",
          selector: '[data-tour="content"]',
          title: "Main Workspace",
          body: "This area changes based on what you open. Your content lives here.",
          placement: "bottom",
        },
      ]),
    []
  );

  const loadTour = useCallback(async () => {
    try {
      const res = await fetch(`/api/tours/runtime?key=${encodeURIComponent(tourKey)}`, {
        cache: "no-store",
      });

      const data = (await res.json()) as TourApiResponse;

      if (!data.tour || !data.tour.isActive) {
        setIsEnabled(false);
        setTourVersion(1);
        setSteps(fallbackSteps);
        return;
      }

      const ver = Number.isFinite(data.tour.version) ? data.tour.version : 1;
      const incoming = Array.isArray(data.tour.steps) ? data.tour.steps : [];

      setIsEnabled(true);
      setTourVersion(ver);
      setSteps(withSidebarRect(incoming.length ? incoming : fallbackSteps));
    } catch {
      setIsEnabled(false);
      setTourVersion(1);
      setSteps(fallbackSteps);
    }
  }, [tourKey, fallbackSteps]);

  useEffect(() => {
    loadTour();
  }, [loadTour, pathname]);

  useEffect(() => {
    const onFocus = () => loadTour();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadTour]);

  useEffect(() => {
    const handler = () => loadTour();
    window.addEventListener("tour-config-updated", handler);
    return () => window.removeEventListener("tour-config-updated", handler);
  }, [loadTour]);

  const providerKey = `${tenantKey}:${tourKey}:v${tourVersion}`;

  return (
    <AppTourProvider key={providerKey} steps={steps}>
      <DashboardTourInner
        userId={userId}
        tenantKey={tenantKey}
        tourKey={tourKey}
        tourVersion={tourVersion}
        steps={steps}
        isEnabled={isEnabled}
      />
    </AppTourProvider>
  );
}
