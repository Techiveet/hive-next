// lib/get-tenant-and-user.ts

import { getCurrentSession } from "@/lib/auth-server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function getTenantAndUser() {
  const { user } = await getCurrentSession();

  if (!user?.id) {
    return {
      user: null,
      tenant: null,
      userRoles: [],
      isTenantSuperadmin: false,
    };
  }

  const rawHost = headers().get("host") ?? "";
  const host = rawHost.split(":")[0]; // strip port → "acme.localhost"

  const tenantDomain = await prisma.tenantDomain.findUnique({
    where: { domain: host },
    include: { tenant: true },
  });

  const tenant = tenantDomain?.tenant ?? null;

  if (!tenant) {
    return {
      user,
      tenant: null,
      userRoles: [],
      isTenantSuperadmin: false,
    };
  }

  const userRoles = await prisma.userRole.findMany({
    where: {
      userId: user.id,
      tenantId: tenant.id,
    },
    include: { role: true },
  });

  const isTenantSuperadmin = userRoles.some(
    (ur) => ur.role.key === "tenant_superadmin"
  );

  return {
    user,
    tenant,
    userRoles,
    isTenantSuperadmin,
  };
}
