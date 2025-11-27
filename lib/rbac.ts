// lib/rbac.ts

import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

/**
 * Ensure the `central_superadmin` role always has *all* permissions.
 * Safe to call from seed or from a cron/job whenever you add new permissions.
 */
export async function syncCentralSuperAdminPermissions() {
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

  const allPermissions = await prisma.permission.findMany({
    where: { tenantId: null },
    select: { id: true },
  });

  if (!allPermissions.length) {
    console.warn("[RBAC] No permissions found – nothing to sync.");
    return;
  }

  await prisma.rolePermission.deleteMany({
    where: { roleId: centralRole.id },
  });

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

/**
 * Returns a flat list of permission keys for the current user.
 *
 * IMPORTANT:
 * - Always includes **global** (central) role permissions (tenantId = null).
 * - Optionally merges in permissions for the current tenant (tenantId = currentTenantId).
 */
export async function getCurrentUserPermissions(
  currentTenantId?: string | null
): Promise<string[]> {
  const { user } = await getCurrentSession();
  if (!user?.id) return [];

  // 1) Global (central) roles → tenantId = null
  const centralUserRoles = await prisma.userRole.findMany({
    where: {
      userId: user.id,
      tenantId: null,
    },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  // 2) Tenant-scoped roles (if there is an active tenant)
  let tenantUserRoles: typeof centralUserRoles = [];
  if (currentTenantId) {
    tenantUserRoles = await prisma.userRole.findMany({
      where: {
        userId: user.id,
        tenantId: currentTenantId,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });
  }

  const keys = new Set<string>();

  for (const ur of [...centralUserRoles, ...tenantUserRoles]) {
    for (const rp of ur.role.permissions) {
      if (rp.permission?.key) {
        keys.add(rp.permission.key);
      }
    }
  }

  return Array.from(keys);
}

/**
 * Convenience wrapper if you just want a boolean.
 */
export async function userHasPermission(
  key: string,
  tenantId?: string | null
): Promise<boolean> {
  const perms = await getCurrentUserPermissions(tenantId);
  return perms.includes(key);
}
