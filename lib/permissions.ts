// lib/permissions.ts

import { getCurrentSession } from "@/lib/auth-server";
import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { prisma } from "@/lib/prisma";

/**
 * Get all permission keys for the current user.
 *
 * - Always includes CENTRAL (tenantId = null) roles.
 * - Additionally includes roles for the CURRENT tenant.
 * - The tenant can be passed explicitly (tenantIdOverride) or
 *   auto-resolved via `getTenantAndUser()`.
 */
export async function getCurrentUserPermissions(
  tenantIdOverride?: string | null
): Promise<string[]> {
  const { user } = await getCurrentSession();
  if (!user) return [];

  // --------------------------------------------------
  // 1) Resolve tenant context
  // --------------------------------------------------
  let tenantId: string | null = null;
  let tenantSlug: string | undefined;

  if (typeof tenantIdOverride !== "undefined") {
    // Explicit tenant id provided by caller (e.g. DashboardLayout)
    tenantId = tenantIdOverride ?? null;

    if (tenantId) {
      const t = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { slug: true },
      });
      tenantSlug = t?.slug;
    }
  } else {
    // Fallback: use your existing helper (host → tenant)
    const { tenant } = await getTenantAndUser();
    tenantId = tenant?.id ?? null;
    tenantSlug = tenant?.slug;
  }

  // --------------------------------------------------
  // 2) Fetch CENTRAL + TENANT roles for this user
  // --------------------------------------------------
  const userRoles = await prisma.userRole.findMany({
    where: {
      userId: user.id,
      OR: [
        { tenantId: null }, // central roles
        ...(tenantId ? [{ tenantId }] : []), // current tenant roles
      ],
    },
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true }, // rolePermission → permission
          },
        },
      },
    },
  });

  if (!userRoles.length) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[permissions] No userRoles found", {
        email: user.email,
        tenantId,
        tenantSlug: tenantSlug ?? "GLOBAL",
      });
    }
    return [];
  }

  // --------------------------------------------------
  // 3) Collect distinct permission keys
  // --------------------------------------------------
  const keysSet = new Set<string>();

  for (const ur of userRoles) {
    for (const rp of ur.role.permissions) {
      if (rp.permission?.key) {
        keysSet.add(rp.permission.key);
      }
    }
  }

  const keys = Array.from(keysSet);

  if (process.env.NODE_ENV !== "production") {
    console.log("[permissions] Resolved permission keys", {
      email: user.email,
      tenantId,
      tenantSlug: tenantSlug ?? "GLOBAL",
      roles: userRoles.map((ur) => ({
        roleId: ur.roleId,
        roleKey: ur.role.key,
        userRoleTenantId: ur.tenantId,
        roleTenantId: ur.role.tenantId,
      })),
      permissionCount: keys.length,
      permissions: keys,
    });
  }

  return keys;
}
