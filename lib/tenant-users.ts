// lib/tenant-users.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Link user ↔ tenant.
 */
export async function addUserToTenant(userId: string, tenantId: string) {
  return prisma.userTenant.upsert({
    where: { userId_tenantId: { userId, tenantId } },
    update: { isOwner: true },        // superadmin = owner
    create: { userId, tenantId, isOwner: true },
  });
}

/**
 * Make this user the tenant_superadmin for a given tenant.
 * Reuses the role/permissions seeded in prisma/seed.ts
 */
export async function makeTenantSuperadmin(userId: string, tenantId: string) {
  const role = await prisma.role.findUnique({
    where: {
      tenantId_key: {
        tenantId,
        key: "tenant_superadmin",
      },
    },
  });

  if (!role) {
    throw new Error(`tenant_superadmin role missing for tenant ${tenantId}`);
  }

  // optional: enforce ONE holder per tenant_superadmin role (like seeder)
  await prisma.userRole.deleteMany({
    where: { roleId: role.id, tenantId },
  });

  return prisma.userRole.create({
    data: {
      userId,
      roleId: role.id,
      tenantId,
    },
  });
}
