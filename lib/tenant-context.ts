// lib/tenant-context.ts

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function getCurrentTenantIdFromHost(): Promise<string | null> {
  // ✅ FIX: Await the headers() function
  const headerList = await headers();
  const host = headerList.get("host") ?? "";
  
  const bareHost = host.split(":")[0]; // strip port

  const domain = await prisma.tenantDomain.findFirst({
    where: { domain: bareHost },
    select: { tenantId: true },
  });

  return domain?.tenantId ?? null;
}