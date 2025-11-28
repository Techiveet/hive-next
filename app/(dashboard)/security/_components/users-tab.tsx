// app/(dashboard)/security/_components/users-tab.tsx

import { RoleScope } from "@prisma/client";
import { UsersTabClient } from "./users-tab-client";
import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

interface UsersTabProps {
  tenantId: string | null;
  tenantName: string | null;
  permissions: string[]; // ⬅️ Receive
}

export async function UsersTab({ tenantId, tenantName, permissions }: UsersTabProps) {
  const { user } = await getCurrentSession();
  if (!user?.id) return null;

  // --- Central ---
  if (!tenantId) {
    const [roles, centralUsers] = await Promise.all([
      prisma.role.findMany({ where: { scope: RoleScope.CENTRAL, tenantId: null }, orderBy: { id: "asc" } }),
      prisma.user.findMany({
        where: { userRoles: { some: { tenantId: null } } },
        orderBy: { createdAt: "desc" },
        include: { userRoles: { include: { role: true } } },
      }),
    ]);
    const assignableRoles = roles.filter((r) => r.key !== "central_superadmin").map((r) => ({ id: r.id, key: r.key, name: r.name }));
    const usersForClient = centralUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt.toISOString(),
      isActive: u.isActive,
      userRoles: u.userRoles.map((ur) => ({ id: ur.id, tenantId: ur.tenantId, role: { key: ur.role.key, name: ur.role.name, scope: ur.role.scope } })),
    }));
    const roleMap: Record<number, string> = {};
    roles.forEach((r) => { roleMap[r.id] = r.name; });

    return (
      <UsersTabClient
        users={usersForClient}
        assignableRoles={assignableRoles}
        centralRoleMap={roleMap}
        currentUserId={user.id}
        tenantId={tenantId}
        tenantName={tenantName}
        permissions={permissions} // ⬅️ Pass Down
      />
    );
  }

  // --- Tenant ---
  const [roles, memberships] = await Promise.all([
    prisma.role.findMany({ where: { scope: RoleScope.TENANT, tenantId: tenantId }, orderBy: { id: "asc" } }),
    prisma.userTenant.findMany({
      where: { tenantId },
      include: { user: { include: { userRoles: { where: { tenantId }, include: { role: true } } } } },
    }),
  ]);
  const tenantUsers = memberships.map((m) => m.user);
  const assignableRoles = roles.filter((r) => r.key !== "tenant_superadmin").map((r) => ({ id: r.id, key: r.key, name: r.name }));
  const usersForClient = tenantUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    createdAt: u.createdAt.toISOString(),
    isActive: u.isActive,
    userRoles: u.userRoles.map((ur) => ({ id: ur.id, tenantId: ur.tenantId, role: { key: ur.role.key, name: ur.role.name, scope: ur.role.scope } })),
  }));
  const roleMap: Record<number, string> = {};
  roles.forEach((r) => { roleMap[r.id] = r.name; });

  return (
    <UsersTabClient
      users={usersForClient}
      assignableRoles={assignableRoles}
      centralRoleMap={roleMap}
      currentUserId={user.id}
      tenantId={tenantId}
      tenantName={tenantName}
      permissions={permissions} // ⬅️ Pass Down
    />
  );
}