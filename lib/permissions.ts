// lib/permissions.ts

import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

/**
 * Returns the list of permission keys the current user has
 * for the given tenant context.
 *
 * - If user has central_superadmin (global) -> all global permissions.
 * - Otherwise -> aggregate permissions of:
 *   - global roles (tenantId = null)
 *   - tenant-local roles for activeTenantId
 */
export async function getCurrentUserPermissions(
  currentTenantId?: string | null
): Promise<string[]> {
  const { user } = await getCurrentSession();
  if (!user?.id) return [];

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id as string },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
      tenantMemberships: true,
    },
  });

  if (!dbUser) return [];

  // 1) Central superadmin → all global permissions
  const isCentralSuperadmin = dbUser.userRoles.some(
    (ur) => ur.role.key === "central_superadmin" && ur.tenantId === null
  );

  if (isCentralSuperadmin) {
    const all = await prisma.permission.findMany({
      where: { tenantId: null },
    });
    return all.map((p) => p.key);
  }

  // 2) Active tenant context (for tenant users)
  const activeTenantId =
    currentTenantId ?? dbUser.tenantMemberships[0]?.tenantId ?? null;

  const keys = new Set<string>();

  for (const ur of dbUser.userRoles) {
    // Global roles apply everywhere
    if (ur.tenantId === null) {
      for (const rp of ur.role.permissions) {
        keys.add(rp.permission.key);
      }
    }

    // Tenant-local roles for the active tenant
    if (activeTenantId && ur.tenantId === activeTenantId) {
      for (const rp of ur.role.permissions) {
        keys.add(rp.permission.key);
      }
    }
  }

  return Array.from(keys);
}
