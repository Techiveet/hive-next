// app/api/file-manager/files/route.ts

import { NextResponse } from "next/server";
import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // "images" | null

  const { tenant, user } = await getTenantAndUser();

  const where: any = {
    tenantId: tenant.id,
    ownerId: user.id,
    deletedAt: null,
  };

  if (type === "images") {
    where.mimeType = { startsWith: "image/" };
  }

  const files = await prisma.file.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return NextResponse.json(
    files.map((f) => ({
      id: f.id,
      name: f.name,
      url: f.url,
      size: f.size,
    }))
  );
}
