// lib/rbac.ts

import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

/**
 * Ensure the `central_superadmin` role always has *all* permissions.
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
 * Sync default tenant role permissions for a given tenant.
 * Mirrors your seed logic:
 *  - tenant_superadmin → all except "manage_tenants"
 *  - tenant_admin      → same as superadmin
 *  - tenant_member     → ["manage_files"]
 */
export async function syncTenantDefaultRolesPermissions(tenantId: string) {
  const permissions = await prisma.permission.findMany({
    where: { tenantId: null },
  });

  if (!permissions.length) {
    console.warn("[RBAC] No global permissions found – tenant sync skipped.");
    return;
  }

  const permByKey = new Map(permissions.map((p) => [p.key, p.id]));
  const allPermKeys = permissions.map((p) => p.key);
  const tenantPermKeys = allPermKeys.filter((k) => k !== "manage_tenants");

  const roles = await prisma.role.findMany({
    where: {
      tenantId,
      key: { in: ["tenant_superadmin", "tenant_admin", "tenant_member"] },
    },
  });

  if (!roles.length) {
    console.warn(
      `[RBAC] No tenant roles found for tenantId=${tenantId} – skipped.`
    );
    return;
  }

  const roleIds = roles.map((r) => r.id);
  const rolePermissions: { roleId: number; permissionId: number }[] = [];

  for (const role of roles) {
    let keys: string[] = [];

    if (role.key === "tenant_superadmin" || role.key === "tenant_admin") {
      keys = tenantPermKeys;
    } else if (role.key === "tenant_member") {
      keys = ["manage_files"];
    }

    for (const key of keys) {
      const pid = permByKey.get(key);
      if (pid) {
        rolePermissions.push({ roleId: role.id, permissionId: pid });
      }
    }
  }

  await prisma.rolePermission.deleteMany({
    where: { roleId: { in: roleIds } },
  });

  if (!rolePermissions.length) {
    console.warn(
      `[RBAC] No rolePermissions generated for tenantId=${tenantId} – nothing to create.`
    );
    return;
  }

  await prisma.rolePermission.createMany({
    data: rolePermissions,
    skipDuplicates: true,
  });

  console.log(
    `[RBAC] Synced tenant roles (${roles
      .map((r) => r.key)
      .join(", ")}) for tenantId=${tenantId}.`
  );
}

/**
 * Returns a flat list of permission keys for the current user.
 * Includes central roles + optional tenant roles.
 */
export async function getCurrentUserPermissions(
  currentTenantId?: string | null
): Promise<string[]> {
  const { user } = await getCurrentSession();
  if (!user?.id) return [];

  // Central roles (tenantId = null)
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

  // Tenant roles
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

  if (process.env.NODE_ENV !== "production") {
    console.log("[RBAC] getCurrentUserPermissions()", {
      userId: user.id,
      email: user.email,
      currentTenantId: currentTenantId ?? null,
      centralRoles: centralUserRoles.map((r) => r.role.key),
      tenantRoles: tenantUserRoles.map((r) => r.role.key),
      permissionCount: keys.size,
    });
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
