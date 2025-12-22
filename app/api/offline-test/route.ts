// app/api/offline-test/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ✅ FIX: make sure Prisma routes are Node runtime
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const items = await prisma.offlineTestItem.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({
    items: items.map((x) => ({
      id: x.id,
      name: x.title,
      email: x.body ?? "",
      createdAt: x.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const data = await req.json().catch(() => null);

  if (!data) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = String(data.name ?? data.title ?? "").trim();
  const body = String(data.email ?? data.body ?? "").trim();

  if (!title) {
    return NextResponse.json({ error: "name/title is required" }, { status: 422 });
  }

  const created = await prisma.offlineTestItem.create({
    data: { title, body: body || null },
  });

  return NextResponse.json({
    ok: true,
    item: {
      id: created.id,
      name: created.title,
      email: created.body ?? "",
      createdAt: created.createdAt.toISOString(),
    },
  });
}
