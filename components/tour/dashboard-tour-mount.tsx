"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  AppTourProvider,
  type TourStep,
  useAppTour,
} from "./app-tour-provider";
import { AppTourUI } from "./app-tour-ui";
import { cn } from "@/lib/utils";

function DashboardTourInner({
  userId,
  tenantKey,
  steps,
}: {
  userId: string;
  tenantKey: string;
  steps: TourStep[];
}) {
  const { start, stop, isOpen } = useAppTour();
  const pathname = usePathname();
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // ✅ TENANT/PERMISSION AWARE: only include steps that exist in DOM
  const getRunnableSteps = useCallback(() => {
    return steps.filter((s) => {
      const el = document.querySelector(s.selector);
      return !!el; // skip steps not rendered (permission/tenant differences)
    });
  }, [steps]);

  // ✅ stop tour on route change
  useEffect(() => {
    if (isOpen) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // ✅ Start tour event (your Start Tour button)
  useEffect(() => {
    const handler = () => {
      // wait a tick so sidebar/nav is definitely mounted
      setTimeout(() => {
        const runnable = getRunnableSteps();
        if (runnable.length) start(runnable, 0);
      }, 30);
    };

    window.addEventListener("start-app-tour", handler);
    return () => window.removeEventListener("start-app-tour", handler);
  }, [start, getRunnableSteps]);

  // ✅ Welcome (first login only) — TENANT AWARE
  useEffect(() => {
    const key = `hive:welcome-tour-shown:${tenantKey}:${userId}`;
    const shown = window.localStorage.getItem(key);

    if (!shown) {
      setWelcomeOpen(true);
      window.localStorage.setItem(key, "1");
    }
  }, [tenantKey, userId]);

  return (
    <>
      <AppTourUI />

      {welcomeOpen && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4">
          <div className="w-[420px] max-w-full rounded-2xl border border-white/10 bg-slate-950 p-5 text-slate-50 shadow-2xl">
            <div className="text-base font-semibold">Welcome to Hive 👋</div>
            <div className="mt-1 text-sm text-slate-300">
              Want a quick guided tour of the app?
            </div>

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
                onClick={() => {
                  setWelcomeOpen(false);
                  const runnable = getRunnableSteps();
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

export function DashboardTourMount({
  userId,
  tenantKey,
}: {
  userId: string;
  tenantKey: string;
}) {
  const steps: TourStep[] = useMemo(
    () => [
      {
        id: "sidebar",
        selector: '[data-tour="sidebar"]',
        title: "Sidebar Navigation",
        body: "Use the sidebar to move between modules quickly.",
        placement: "right",
        rect: { x: 2, y: 0, width: 252, height: 745 },
      },

      // Sidebar links (these will auto-skip if not rendered)
      {
        id: "dashboard-link",
        selector: '[data-tour="nav-dashboard"]',
        title: "Dashboard",
        body: "Go back to your main overview anytime.",
        placement: "right",
        padding: 14,
        rect: { x: -1, width: 259.2, height: 70 },
      },
      {
        id: "tenants-link",
        selector: '[data-tour="nav-tenants"]',
        title: "Tenants",
        body: "Manage tenants and their domains here.",
        placement: "right",
        padding: 14,
        rect: { x: -1, width: 259.2, height: 70 },
      },
      {
        id: "security-link",
        selector: '[data-tour="nav-security"]',
        title: "Security",
        body: "Roles, permissions, and security controls.",
        placement: "right",
        padding: 14,
        rect: { x: -1, width: 259.2, height: 70 },
      },
      {
        id: "files-link",
        selector: '[data-tour="nav-files"]',
        title: "Files",
        body: "Upload and manage your documents and media.",
        placement: "right",
        padding: 14,
        rect: { x: -1, width: 259.2, height: 70 },
      },
      {
        id: "billing-link",
        selector: '[data-tour="nav-billing"]',
        title: "Billing",
        body: "Subscriptions and invoices live here.",
        placement: "right",
        padding: 14,
        rect: { x: -1, width: 259.2, height: 70 },
      },
      {
        id: "settings-link",
        selector: '[data-tour="nav-settings"]',
        title: "Settings",
        body: "Branding, email config, notifications, and localization.",
        placement: "right",
        padding: 14,
        rect: { x: -1, width: 259.2, height: 70 },
      },

      {
        id: "content",
        selector: '[data-tour="content"]',
        title: "Main Workspace",
        body: "This area changes based on what you open. Your content lives here.",
        placement: "bottom",
        rect: { x: 253, y: 5, width: 1265, height: 576 },
      },
    ],
    []
  );

  return (
    <AppTourProvider steps={steps}>
      <DashboardTourInner
        userId={userId}
        tenantKey={tenantKey}
        steps={steps}
      />
    </AppTourProvider>
  );
}
