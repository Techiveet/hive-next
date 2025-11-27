// app/(dashboard)/security/page.tsx

import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Breadcrumb } from "@/components/breadcrumb";
import { PermissionsTab } from "./_components/permissions-tab";
import { RoleScope } from "@prisma/client";
import { RolesTab } from "./_components/roles-tab";
import { SecurityTabs } from "./_components/security-tabs";
import { UsersTab } from "./_components/users-tab";
import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

// ----------------------------------------------------------------------
// CONFIGURATION
// ----------------------------------------------------------------------

// Permissions that are STRICTLY for Central Superadmins.
// Tenants should never see these, even as read-only, to prevent
// accidental assignment to tenant roles.
const CENTRAL_ONLY_PERMISSIONS = [
  "manage_tenants",
  "manage_billing_plans",
  "access_central_dashboard",
  "view_system_audit_logs",
];

// ----------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------

type SearchParams = {
  tab?: "users" | "roles" | "permissions";
};

// ----------------------------------------------------------------------
// PAGE COMPONENT
// ----------------------------------------------------------------------

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;

  const tab: "users" | "roles" | "permissions" =
    resolvedSearchParams?.tab === "roles" ||
    resolvedSearchParams?.tab === "permissions"
      ? resolvedSearchParams.tab
      : "users";

  // 1. Auth & Session Check
  const { user } = await getCurrentSession();

  if (!user?.id) {
    return (
      <div className="px-4 py-4 text-xs text-muted-foreground">
        You must be signed in to view security settings.
      </div>
    );
  }

  // 2. Fetch User with Roles & Memberships
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id as string },
    include: {
      userRoles: { include: { role: true } },
      tenantMemberships: { include: { tenant: true } },
    },
  });

  if (!dbUser) {
    return (
      <div className="px-4 py-4 text-xs text-muted-foreground">
        User record not found.
      </div>
    );
  }

  // 3. Determine Context (Central vs Tenant)
  // Logic: If user has a tenant membership, default to that context.
  // Otherwise, check if they are a central superadmin.
  const activeMembership = dbUser.tenantMemberships[0] ?? null;
  const activeTenantId = activeMembership?.tenantId ?? null;
  const activeTenantName = activeMembership?.tenant?.name ?? null;

  const hasCentralSuperadmin = dbUser.userRoles.some(
    (ur) => ur.role.key === "central_superadmin" && ur.tenantId === null
  );

  let scopeProp: "CENTRAL" | "TENANT" = "CENTRAL";
  let description = "";
  
  // 4. Permission Filtering Logic
  let permissionsWhere: any = {};

  if (!activeTenantId) {
    // --- CENTRAL CONTEXT ---
    if (!hasCentralSuperadmin) {
      return <div className="p-4 text-xs">Access Denied.</div>;
    }
    scopeProp = "CENTRAL";
    description = "Manage central platform security, global roles, and system permissions.";

    // Central sees ONLY global permissions (defined by tenantId: null)
    permissionsWhere = { tenantId: null };
  } else {
    // --- TENANT CONTEXT ---
    scopeProp = "TENANT";
    description = `Manage users, roles, and permissions for ${activeTenantName}.`;

    // Tenant sees:
    // A) Global permissions (shared system perms)
    // B) PLUS their own custom permissions
    // C) MINUS restricted central-only keys (security filter)
    permissionsWhere = {
      AND: [
        {
          OR: [
            { tenantId: null }, // System perms
            { tenantId: activeTenantId }, // Custom perms
          ],
        },
        {
          key: { notIn: CENTRAL_ONLY_PERMISSIONS }, // Hide superadmin powers
        },
      ],
    };
  }

  // 5. Fetch Data Parallel
  const [rolesRaw, permissionsRaw] = await Promise.all([
    // Fetch Roles
    prisma.role.findMany({
      where: {
        scope: scopeProp === "CENTRAL" ? RoleScope.CENTRAL : RoleScope.TENANT,
        tenantId: activeTenantId, // null for central, uuid for tenant
      },
      include: {
        permissions: { include: { permission: true } },
      },
      orderBy: { id: "asc" },
    }),

    // Fetch Permissions (using the filter logic above)
    prisma.permission.findMany({
      where: permissionsWhere,
      orderBy: { key: "asc" },
    }),
  ]);

  // 6. Data Normalization (DTOs)

  // Map permissions to include an `isGlobal` flag. 
  // This helps the UI render "System" badges and lock buttons.
  const permissions = permissionsRaw.map((p) => ({
    ...p,
    isGlobal: p.tenantId === null,
  }));

  // Normalize roles structure
  const roles = rolesRaw.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    scope: r.scope as "CENTRAL" | "TENANT",
    tenantId: r.tenantId,
    permissions: r.permissions.map((rp) => ({
      id: rp.permission.id,
      key: rp.permission.key,
      name: rp.permission.name,
    })),
  }));

  return (
    <div className="px-4 py-4 lg:px-6 lg:py-6 xl:px-8">
      {/* Header */}
      <div className="mb-5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb />
        </div>

        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">
            Security &amp; Access
          </h1>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      {/* Tabs */}
      <SecurityTabs defaultTab={tab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        {/* Tab 1: Users */}
        <TabsContent value="users" className="space-y-4">
          <UsersTab tenantId={activeTenantId} tenantName={activeTenantName} />
        </TabsContent>

        {/* Tab 2: Roles */}
        <TabsContent value="roles" className="space-y-4">
          <RolesTab
            roles={roles}
            allPermissions={permissions}
            scopeProp={scopeProp}
            tenantId={activeTenantId}
          />
        </TabsContent>

        {/* Tab 3: Permissions */}
        <TabsContent value="permissions" className="space-y-4">
          <PermissionsTab
            permissions={permissions}
            tenantId={activeTenantId}
          />
        </TabsContent>
      </SecurityTabs>
    </div>
  );
}