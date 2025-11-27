"use server";

import { getCurrentSession } from "@/lib/auth-server";
import { permissionSchema } from "@/lib/validations/security";
import { prisma } from "@/lib/prisma";

const RESTRICTED_KEYS = ["manage_tenants", "manage_billing", "root"];

async function authorizePermAction(tenantId?: string | null) {
  const { user } = await getCurrentSession();
  if (!user?.id) throw new Error("UNAUTHORIZED");
  
  if (tenantId) {
      const mem = await prisma.userTenant.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId }}});
      if (!mem) throw new Error("FORBIDDEN_TENANT");
  } else {
      const central = await prisma.userRole.findFirst({ where: { userId: user.id, tenantId: null, role: { key: "central_superadmin"}}});
      if (!central) throw new Error("FORBIDDEN_CENTRAL");
  }
}

export async function upsertPermissionAction(rawData: unknown) {
  const result = permissionSchema.safeParse(rawData);
  if (!result.success) throw new Error(result.error.issues[0].message);
  const input = result.data;

  await authorizePermAction(input.tenantId);

  // 1. Restrict Keys
  if (RESTRICTED_KEYS.includes(input.key) || input.key.startsWith("sys_")) {
      throw new Error("KEY_RESERVED_FOR_SYSTEM");
  }

  // 2. Uniqueness Check
  const existing = await prisma.permission.findFirst({
      where: {
          key: input.key,
          OR: [
              { tenantId: input.tenantId ?? null }, // Same context
              { tenantId: null } // Conflict with Global
          ],
          ...(input.id ? { id: { not: input.id } } : {})
      }
  });
  if (existing) throw new Error("PERMISSION_KEY_IN_USE");

  // 3. Update Protections
  if (input.id) {
      const current = await prisma.permission.findUnique({ where: { id: input.id }});
      if (input.tenantId && current?.tenantId === null) {
          throw new Error("CANNOT_MODIFY_SYSTEM_PERMISSION");
      }
      
      await prisma.permission.update({
          where: { id: input.id },
          data: { name: input.name, key: input.key }
      });
  } else {
      await prisma.permission.create({
          data: { name: input.name, key: input.key, tenantId: input.tenantId ?? null }
      });
  }
}

export async function deletePermissionAction(id: number, tenantId?: string | null) {
    await authorizePermAction(tenantId);
    
    const perm = await prisma.permission.findUnique({ where: { id }});
    if (!perm) throw new Error("NOT_FOUND");
    
    if (tenantId && perm.tenantId === null) throw new Error("CANNOT_DELETE_SYSTEM_PERMISSION");
    
    const usage = await prisma.rolePermission.count({ where: { permissionId: id }});
    if (usage > 0) throw new Error("PERMISSION_IN_USE");
    
    await prisma.permission.delete({ where: { id }});
}