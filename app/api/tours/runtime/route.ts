// app/api/tours/runtime/route.ts

import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth-server";
import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { user } = await getCurrentSession();
  if (!user) return NextResponse.json({ tour: null }, { status: 401 });

  const url = new URL(req.url);
  const key = (url.searchParams.get("key") || "").trim();
  if (!key) {
    return NextResponse.json({ tour: null, error: "MISSING_KEY" }, { status: 400 });
  }

  const { tenant } = await getTenantAndUser();
  const tenantKey = tenant?.slug ?? "GLOBAL";

  const selectTour = {
    id: true,
    tenantId: true,
    tenantKey: true,
    key: true,
    name: true,
    isActive: true,
    version: true,
    steps: {
      orderBy: { order: "asc" as const },
      select: {
        id: true,
        order: true,
        selector: true,
        title: true,
        body: true,
        placement: true,
        padding: true,
        rectX: true,
        rectY: true,
        rectWidth: true,
        rectHeight: true,
        onlyPathPrefix: true,
      },
    },
  };

  const tenantTour = await prisma.tour.findUnique({
    where: { tenantKey_key: { tenantKey, key } },
    select: selectTour,
  });

  const globalTour =
    tenantKey === "GLOBAL"
      ? null
      : await prisma.tour.findUnique({
          where: { tenantKey_key: { tenantKey: "GLOBAL", key } },
          select: selectTour,
        });

  const chosen =
    tenantTour?.isActive ? tenantTour : globalTour?.isActive ? globalTour : null;

  if (!chosen) return NextResponse.json({ tour: null });

  // ✅ map DB steps => TourStep[] (client expects rect object)
  const steps = (chosen.steps ?? []).map((s) => ({
    id: s.id,
    selector: s.selector,
    title: s.title,
    body: s.body,
    placement: s.placement,
    padding: s.padding ?? undefined,
    rect:
      s.rectX != null || s.rectY != null || s.rectWidth != null || s.rectHeight != null
        ? {
            x: s.rectX ?? undefined,
            y: s.rectY ?? undefined,
            width: s.rectWidth ?? undefined,
            height: s.rectHeight ?? undefined,
          }
        : undefined,
    onlyPathPrefix: s.onlyPathPrefix ?? undefined,
  }));

  return NextResponse.json({
    tour: {
      id: chosen.id,
      tenantKey: chosen.tenantKey,
      key: chosen.key,
      name: chosen.name,
      isActive: chosen.isActive,
      version: chosen.version,
      steps,
    },
  });
}
