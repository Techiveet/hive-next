"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type TourPlacement = "top" | "right" | "bottom" | "left";

export type TourStep = {
  id: string;
  selector: string; // e.g. [data-tour="sidebar"]
  title: string;
  body: string;
  placement?: TourPlacement;
  padding?: number; // highlight padding

  rect?: { x: number; y: number; width: number; height: number };
};

type Ctx = {
  isOpen: boolean;
  steps: TourStep[];
  index: number;
  start: (steps: TourStep[], startIndex?: number) => void;
  stop: () => void;
  next: () => void;
  back: () => void;
};

const AppTourContext = createContext<Ctx | null>(null);

export function AppTourProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [index, setIndex] = useState(0);

  const start = useCallback((nextSteps: TourStep[], startIndex = 0) => {
    setSteps(nextSteps);
    setIndex(Math.max(0, Math.min(startIndex, nextSteps.length - 1)));
    setIsOpen(true);
  }, []);

  const stop = useCallback(() => {
    setIsOpen(false);
    setSteps([]);
    setIndex(0);
  }, []);

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

  const value = useMemo(
    () => ({ isOpen, steps, index, start, stop, next, back }),
    [isOpen, steps, index, start, stop, next, back]
  );

  return <AppTourContext.Provider value={value}>{children}</AppTourContext.Provider>;
}

export function useAppTour() {
  const ctx = useContext(AppTourContext);
  if (!ctx) throw new Error("useAppTour must be used inside <AppTourProvider />");
  return ctx;
}
