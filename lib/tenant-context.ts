// lib/tenant-context.ts

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Resolve current tenant from the Host header.
 *
 * e.g. test.localhost:3000 → tenant whose TenantDomain.domain = "test.localhost"
 */
export async function getCurrentTenantIdFromHost(): Promise<string | null> {
  const host = headers().get("host") ?? "";
  const bareHost = host.split(":")[0]; // strip port

  const domain = await prisma.tenantDomain.findFirst({
    where: { domain: bareHost },
    select: { tenantId: true },
  });

  return domain?.tenantId ?? null;
}
