// lib/tours.ts

import { prisma } from "@/lib/prisma";

export async function getTourForTenant(tourKey: string, tenantId: string | null) {
  const key = tourKey.trim();
  const tenantKey = tenantId ?? "GLOBAL";

  // 1) Try tenant-specific first (even if inactive)
  if (tenantId) {
    const tenantTour = await prisma.tour.findFirst({
      where: { tenantKey: tenantId, key },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    // if exists and disabled -> STOP (do not fallback)
    if (tenantTour && !tenantTour.isActive) return null;
    if (tenantTour && tenantTour.isActive) return tenantTour;
  }

  // 2) Only fallback if tenant tour does NOT exist
  const globalTour = await prisma.tour.findFirst({
    where: { tenantKey: "GLOBAL", key, isActive: true },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  return globalTour ?? null;
}
