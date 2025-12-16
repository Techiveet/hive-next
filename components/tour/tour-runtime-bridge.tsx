// app/components/tour/tour-runtime-bridge.tsx
"use client";

import { useAppTour } from "./app-tour-provider";
import { useEffect } from "react";

type TourStepDTO = {
  id: string;
  order: number;
  selector: string;
  title: string;
  body: string;
  placement: "top" | "right" | "bottom" | "left";
  padding: number | null;
  rectX: number | null;
  rectY: number | null;
  rectWidth: number | null;
  rectHeight: number | null;
  onlyPathPrefix: string | null;
};

type TourDTO = {
  key: string;
  tenantKey: string;
  isActive: boolean;
  version: number;
  steps: TourStepDTO[];
};

function shouldRunStep(step: TourStepDTO) {
  if (!step.onlyPathPrefix) return true;
  return window.location.pathname.startsWith(step.onlyPathPrefix);
}

export function TourRuntimeBridge() {
  const { start, stop } = useAppTour();

  useEffect(() => {
    const onConfig = (e: any) => {
      const tour: TourDTO | null = e?.detail?.tour ?? null;
      if (!tour?.isActive) return;

      const steps = (tour.steps ?? [])
        .sort((a, b) => a.order - b.order)
        .filter((s) => shouldRunStep(s))
        .map((s) => ({
          id: s.id,
          selector: s.selector,
          title: s.title,
          body: s.body,
          placement: s.placement ?? "bottom",
          padding: s.padding ?? 12,
          rect:
            s.rectX != null || s.rectY != null || s.rectWidth != null || s.rectHeight != null
              ? {
                  x: s.rectX ?? 0,
                  y: s.rectY ?? 0,
                  width: s.rectWidth ?? 0,
                  height: s.rectHeight ?? 0,
                }
              : undefined,
        }));

      // optional: auto-start only if there are steps
      if (steps.length) start(steps, 0);
    };

    const onStop = () => stop();

    window.addEventListener("tour:config", onConfig as any);
    window.addEventListener("tour:stop", onStop);

    return () => {
      window.removeEventListener("tour:config", onConfig as any);
      window.removeEventListener("tour:stop", onStop);
    };
  }, [start, stop]);

  return null;
}
