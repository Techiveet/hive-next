//app/components/tour/use-tour-from-db.ts
"use client";

import * as React from "react";

type TourStepDTO = {
  id: string;
  order: number;
  selector: string;
  title: string;
  body: string;
  placement: string;
  padding: number | null;
  rectX: number | null;
  rectY: number | null;
  rectWidth: number | null;
  rectHeight: number | null;
  onlyPathPrefix: string | null;
};

type TourDTO = {
  id: string;
  tenantId: string | null;
  tenantKey: string;
  key: string;
  name: string;
  isActive: boolean;
  version: number;
  steps: TourStepDTO[];
};

export function useTourFromDb(tourKey: string) {
  const [tour, setTour] = React.useState<TourDTO | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    const key = tourKey.trim();
    if (!key) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/tours/runtime?key=${encodeURIComponent(key)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      setTour(data?.tour ?? null);

      // ✅ push the latest tour into your runtime (DB is the source of truth)
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("tour:config", { detail: { tour: data?.tour ?? null } }));
      }
    } finally {
      setLoading(false);
    }
  }, [tourKey]);

  return { tour, loading, load };
}
