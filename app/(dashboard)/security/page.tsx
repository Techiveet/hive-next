// app/(dashboard)/security/page.tsx

import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Breadcrumb } from "@/components/breadcrumb";
import { PermissionsTab } from "./_components/permissions-tab";
import { RoleScope } from "@prisma/client";
import { RolesTab } from "./_components/roles-tab";
import { SecurityTabs } from "./_components/security-tabs";
import { UsersTab } from "./_components/users-tab";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

// ⚠️ FORCE DYNAMIC: This is critical for instant permission updates.
export const dynamic = "force-dynamic";

const CENTRAL_ONLY_PERMISSIONS = [
  "manage_tenants",
  "manage_billing",
  "view_audit_logs",
];

type PageSearchParams = { tab?: string | string[] };
interface SecurityPageProps {
  searchParams: Promise<PageSearchParams>;
}

export default async function SecurityPage({ searchParams }: SecurityPageProps) {
  const params = await searchParams;

  // 1. Auth
  const { user } = await getCurrentSession();
  if (!user?.id) return <div className="p-4">Sign in required.</div>;

  // 2. User & Context
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id as string },
    include: { tenantMemberships: { include: { tenant: true } } },
  });
  
  if (!dbUser) return <div>User not found</div>;
  
  const activeMembership = dbUser.tenantMemberships[0] ?? null;
  const activeTenantId = activeMembership?.tenantId ?? null;
  const activeTenantName = activeMembership?.tenant?.name ?? null;

  // 3. FETCH PERMISSIONS (The Source of Truth)
  // This calculates permission strings for this specific user in this specific context
  const userPermissions = await getCurrentUserPermissions(activeTenantId);

  // 4. CHECK PERMISSIONS & GATES
  const has = (key: string) => userPermissions.includes(key);
  const hasAny = (keys: string[]) => keys.some((k) => has(k));

  if (!hasAny(["view_security", "manage_security"])) {
    redirect("/");
  }

  const canViewUsersTab = hasAny(["users.view", "manage_users", "manage_security"]);
  const canViewRolesTab = hasAny(["roles.view", "manage_roles", "manage_security"]);
  const canViewPermissionsTab = hasAny(["permissions.view", "manage_roles", "manage_security"]);

  // 5. DB Logic (Fetch Data for Tabs)
  const scopeProp = activeTenantId ? "TENANT" : "CENTRAL";
  
  const permissionsWhere = scopeProp === "CENTRAL"
    ? { tenantId: null }
    : {
        AND: [
          { OR: [{ tenantId: null }, { tenantId: activeTenantId }] },
          { key: { notIn: CENTRAL_ONLY_PERMISSIONS } },
        ],
      };

  const [rolesRaw, permissionsRaw] = await Promise.all([
    prisma.role.findMany({
      where: {
        scope: scopeProp === "CENTRAL" ? RoleScope.CENTRAL : RoleScope.TENANT,
        tenantId: scopeProp === "CENTRAL" ? null : activeTenantId,
      },
      include: { permissions: { include: { permission: true } } },
      orderBy: { id: "asc" },
    }),
    prisma.permission.findMany({ where: permissionsWhere, orderBy: { key: "asc" } }),
  ]);

  // Data shaping...
  const permissionsWithFlag = permissionsRaw.map((p) => ({
    ...p,
    isGlobal: p.tenantId === null,
  }));
  
  const roles = rolesRaw.map((r) => ({
    ...r,
    scope: r.scope as "CENTRAL" | "TENANT",
    permissions: r.permissions.map((rp) => rp.permission),
  }));

  // 6. Active Tab Logic
  const rawTabParam = params?.tab;
  const rawTab = typeof rawTabParam === "string" ? rawTabParam : undefined;
  
  let tab = "users";
  if (rawTab === "roles" && canViewRolesTab) tab = "roles";
  else if (rawTab === "permissions" && canViewPermissionsTab) tab = "permissions";
  else if (canViewUsersTab) tab = "users";
  else if (canViewRolesTab) tab = "roles";
  else tab = "permissions";

  return (
    <div className="px-4 py-4 lg:px-6 lg:py-6 xl:px-8">
      <div className="mb-5 space-y-2">
        <Breadcrumb />
        <h1 className="text-lg font-semibold tracking-tight">
          Security &amp; Access
        </h1>
      </div>

      <SecurityTabs defaultTab={tab} className="space-y-4">
        <TabsList>
          {canViewUsersTab && <TabsTrigger value="users">Users</TabsTrigger>}
          {canViewRolesTab && <TabsTrigger value="roles">Roles</TabsTrigger>}
          {canViewPermissionsTab && <TabsTrigger value="permissions">Permissions</TabsTrigger>}
        </TabsList>

        {/* USERS TAB */}
        {canViewUsersTab && (
          <TabsContent value="users" className="space-y-4">
            <UsersTab
              tenantId={activeTenantId}
              tenantName={activeTenantName}
              permissions={userPermissions} // ⬅️ Prop Drill
            />
          </TabsContent>
        )}

        {/* ROLES TAB */}
        {canViewRolesTab && (
          <TabsContent value="roles" className="space-y-4">
            <RolesTab
              roles={roles}
              allPermissions={permissionsWithFlag}
              scopeProp={scopeProp}
              tenantId={activeTenantId}
              permissions={userPermissions} // ⬅️ Prop Drill (Replaces hardcoded booleans)
            />
          </TabsContent>
        )}

        {/* PERMISSIONS TAB */}
       {canViewPermissionsTab && (
  <TabsContent value="permissions" className="space-y-4">
    <PermissionsTab
      permissions={permissionsWithFlag}
      tenantId={activeTenantId}
      // ⬇️ Pass the prop here!
      permissionsList={userPermissions} 
    />
  </TabsContent>
)}
      </SecurityTabs>
    </div>
  );
}