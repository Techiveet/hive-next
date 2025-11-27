// app/(dashboard)/security/roles-actions.ts
"use server";

import { RoleScope } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { roleSchema } from "@/lib/validations/security";

// Keys that tenants cannot touch
const CENTRAL_ONLY_PERMISSIONS = [
  "manage_tenants",
  "manage_billing_plans",
  "access_central_dashboard",
];
const PROTECTED_ROLES = ["central_superadmin", "tenant_superadmin"];

async function authorizeRoleAction(tenantId?: string | null) {
  const { user } = await getCurrentSession();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  if (tenantId) {
    const membership = await prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId } },
    });
    if (!membership) throw new Error("FORBIDDEN_TENANT");
  } else {
    const isCentral = await prisma.userRole.findFirst({
      where: { userId: user.id, tenantId: null, role: { key: "central_superadmin" } },
    });
    if (!isCentral) throw new Error("FORBIDDEN_CENTRAL");
  }
}

export async function upsertRoleAction(rawData: unknown) {
  // 1. Validate Input
  const result = roleSchema.safeParse(rawData);
  if (!result.success) throw new Error(result.error.issues[0].message);
  const input = result.data;

  // PROTECT creation / duplication of superadmin roles
  if (!input.id && PROTECTED_ROLES.includes(input.key)) {
    throw new Error("CANNOT_CREATE_PROTECTED_ROLE");
  }

  // 2. Auth Guard
  await authorizeRoleAction(input.tenantId);

  // 3. Protect Critical Roles on update
  if (input.id) {
    const existingRole = await prisma.role.findUnique({ where: { id: input.id } });
    if (existingRole && PROTECTED_ROLES.includes(existingRole.key)) {
      if (input.key !== existingRole.key) {
        throw new Error("CANNOT_CHANGE_PROTECTED_KEY");
      }
    }
  }

  // 4. Validate Permission Scope (security)
  if (input.tenantId && input.permissionIds.length > 0) {
    const forbiddenPermissions = await prisma.permission.count({
      where: {
        id: { in: input.permissionIds },
        OR: [
          { key: { in: CENTRAL_ONLY_PERMISSIONS } },
          { tenantId: { not: null, not: input.tenantId } },
        ],
      },
    });

    if (forbiddenPermissions > 0) {
      throw new Error("ATTEMPTED_PRIVILEGE_ESCALATION");
    }
  }

  // 5. Check Key Uniqueness in Context
  const existingKey = await prisma.role.findFirst({
    where: {
      key: input.key,
      tenantId: input.tenantId ?? null,
      ...(input.id ? { id: { not: input.id } } : {}),
    },
  });
  if (existingKey) throw new Error("ROLE_KEY_IN_USE");

  const scope = input.tenantId ? RoleScope.TENANT : RoleScope.CENTRAL;

  // 6. DB Write
  if (input.id) {
    await prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id: input.id! },
        data: { name: input.name, key: input.key, scope, tenantId: input.tenantId ?? null },
      });
      await tx.rolePermission.deleteMany({ where: { roleId: input.id! } });
      if (input.permissionIds.length) {
        await tx.rolePermission.createMany({
          data: input.permissionIds.map((pid) => ({
            roleId: input.id!,
            permissionId: pid,
          })),
        });
      }
    });
  } else {
    await prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: { name: input.name, key: input.key, scope, tenantId: input.tenantId ?? null },
      });
      if (input.permissionIds.length) {
        await tx.rolePermission.createMany({
          data: input.permissionIds.map((pid) => ({
            roleId: role.id,
            permissionId: pid,
          })),
        });
      }
    });
  }
}

export async function deleteRoleAction(id: number) {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("UNAUTHORIZED");

  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw new Error("NOT_FOUND");

  if (PROTECTED_ROLES.includes(role.key)) {
    throw new Error("CANNOT_DELETE_PROTECTED_ROLE");
  }

  if (role.tenantId) {
    const mem = await prisma.userTenant.findUnique({
      where: {
        userId_tenantId: { userId: user.id, tenantId: role.tenantId },
      },
    });
    if (!mem) throw new Error("FORBIDDEN");
  } else {
    // central context check is already enforced in authorizeRoleAction
  }

  try {
    await prisma.role.delete({ where: { id } });
  } catch (e: any) {
    if (e.code === "P2003") throw new Error("ROLE_IN_USE");
    throw e;
  }
}
