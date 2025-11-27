// lib/rbac.ts

import { prisma } from "@/lib/prisma";

/**
 * Ensure the `central_superadmin` role always has *all* permissions.
 * Safe to call from seed or from a cron/job whenever you add new permissions.
 */
export async function syncCentralSuperAdminPermissions() {
  // 1) Find global central_superadmin role (tenantId = null)
  const centralRole = await prisma.role.findFirst({
    where: {
      key: "central_superadmin",
      tenantId: null,
    },
  });

  if (!centralRole) {
    console.warn(
      "[RBAC] central_superadmin role not found – nothing to sync."
    );
    return;
  }

  // 2) Load all global permissions
  const allPermissions = await prisma.permission.findMany({
    where: { tenantId: null },
    select: { id: true },
  });

  if (!allPermissions.length) {
    console.warn("[RBAC] No permissions found – nothing to sync.");
    return;
  }

  // 3) Clear existing central_superadmin rolePermission links
  await prisma.rolePermission.deleteMany({
    where: { roleId: centralRole.id },
  });

  // 4) Attach everything
  await prisma.rolePermission.createMany({
    data: allPermissions.map((p) => ({
      roleId: centralRole.id,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });

  console.log(
    `[RBAC] Synced central_superadmin with ${allPermissions.length} permissions.`
  );
}
