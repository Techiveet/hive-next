// app/components/tour/app-tour-provider.tsx
"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type TourPlacement = "top" | "right" | "bottom" | "left";

export type TourStep = {
  id: string; // ✅ required for jump
  selector: string;
  title: string;
  body: string;
  placement?: TourPlacement;
  padding?: number;
  rect?: { x: number; y: number; width: number; height: number };
};

type Ctx = {
  isOpen: boolean;
  steps: TourStep[];
  index: number;
  start: (steps?: TourStep[], startIndex?: number) => void;
  stop: () => void;
  next: () => void;
  back: () => void;
  // ✅ NEW
  goTo: (index: number) => void;
  goToStep: (id: string) => void;
};

const AppTourContext = createContext<Ctx | null>(null);

export function AppTourProvider({
  children,
  steps: initialSteps = [],
}: {
  children: React.ReactNode;
  steps?: TourStep[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [steps, setSteps] = useState<TourStep[]>(initialSteps);
  const [index, setIndex] = useState(0);

  // keep in sync if parent (DashboardTourMount) changes steps
  useEffect(() => {
    setSteps(initialSteps ?? []);
    setIndex(0);
    setIsOpen(false);
  }, [initialSteps]);

  const stop = useCallback(() => {
    setIsOpen(false);
    setIndex(0);
  }, []);

  const start = useCallback((nextSteps?: TourStep[], startIndex = 0) => {
    const finalSteps = (nextSteps?.length ? nextSteps : steps) ?? [];
    if (!finalSteps.length) return;

    setSteps(finalSteps);
    setIndex(Math.max(0, Math.min(startIndex, finalSteps.length - 1)));
    setIsOpen(true);
  }, [steps]);

  const next = useCallback(() => {
    setIndex((i) => {
      const last = steps.length - 1;
      if (i >= last) return i;
      return i + 1;
    });
  }, [steps.length]);

  const back = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // ✅ NEW: jump by index
  const goTo = useCallback((target: number) => {
    setIndex((current) => {
      if (!steps.length) return current;
      if (target < 0 || target > steps.length - 1) return current;
      return target;
    });
  }, [steps.length]);

  // ✅ NEW: jump by step id
  const goToStep = useCallback((id: string) => {
    const target = steps.findIndex((s) => s.id === id);
    if (target >= 0) goTo(target);
  }, [steps, goTo]);

  // ✅ stop tour from anywhere
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => stop();
    window.addEventListener("tour:stop", handler);
    return () => window.removeEventListener("tour:stop", handler);
  }, [stop]);

  // ✅ NEW: jump from anywhere
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (e: any) => {
      const detail = e?.detail ?? {};
      if (typeof detail.index === "number") goTo(detail.index);
      if (typeof detail.stepId === "string") goToStep(detail.stepId);
    };

    window.addEventListener("tour:go-to", handler);
    return () => window.removeEventListener("tour:go-to", handler);
  }, [goTo, goToStep]);

  const value = useMemo(
    () => ({ isOpen, steps, index, start, stop, next, back, goTo, goToStep }),
    [isOpen, steps, index, start, stop, next, back, goTo, goToStep]
  );

  return <AppTourContext.Provider value={value}>{children}</AppTourContext.Provider>;
}

export function useAppTour() {
  const ctx = useContext(AppTourContext);
  if (!ctx) throw new Error("useAppTour must be used inside <AppTourProvider />");
  return ctx;
}
