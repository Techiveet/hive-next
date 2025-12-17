import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Breadcrumb } from "@/components/breadcrumb";
import { PermissionsTab } from "./permissions/_components/permissions-tab";
import { RoleScope } from "@prisma/client";
import { RolesTab } from "./roles/_components/roles-tab";
import { SecurityTabs } from "./security-tabs";
import { TourControls } from "@/components/tour/tour-controls"; // Import the TourControls
import { UsersTab } from "./users/_components/users-tab";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/rbac";
import { headers } from "next/headers"; // add this
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

// add this helper (same logic as your Tenants page)
async function resolveTenantIdFromHost(): Promise<string | null> {
  const h = await headers();
  const host = (h.get("host") || "").toLowerCase();
  const bareHost = host.split(":")[0];

  if (bareHost === "localhost") {
    const centralTenant = await prisma.tenant.findUnique({
      where: { slug: "central-hive" },
      select: { id: true },
    });
    return centralTenant?.id ?? null;
  }

  const domain = await prisma.tenantDomain.findFirst({
    where: { domain: bareHost },
    select: { tenantId: true },
  });

  return domain?.tenantId ?? null;
}

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

export default async function SecurityPage({
  searchParams,
}: SecurityPageProps) {
  const params = await searchParams;

  const { user } = await getCurrentSession();
  if (!user?.id) return <div className="p-4">Sign in required.</div>;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id as string },
    include: { tenantMemberships: { include: { tenant: true } } },
  });

  if (!dbUser) return <div>User not found</div>;

  const activeMembership = dbUser.tenantMemberships[0] ?? null;
  const activeTenantId = activeMembership?.tenantId ?? null;
  const activeTenantName = activeMembership?.tenant?.name ?? null;

  const userPermissions = await getCurrentUserPermissions(activeTenantId);

  // Company + Branding shared
  // Company + Branding shared (tenant-aware, with fallback)
  const brandTenantId = activeTenantId ?? (await resolveTenantIdFromHost());

  // company settings
  let company = await prisma.companySettings.findFirst({
    where: { tenantId: brandTenantId },
  });

  if (!company) {
    company = await prisma.companySettings.findFirst({
      where: { tenantId: null },
    });
  }

  const companySettings = company
    ? {
        companyName: company.companyName ?? "",
        legalName: company.legalName ?? undefined,
        email: company.email ?? undefined,
        phone: company.phone ?? undefined,
        website: company.website ?? undefined,
        addressLine1: company.addressLine1 ?? undefined,
        addressLine2: company.addressLine2 ?? undefined,
        city: company.city ?? undefined,
        state: company.state ?? undefined,
        postalCode: company.postalCode ?? undefined,
        country: company.country ?? undefined,
        taxId: company.taxId ?? undefined,
        registrationNumber: company.registrationNumber ?? undefined,
      }
    : null;

  // branding (logo)
  let brand = await prisma.brandSettings.findFirst({
    where: { tenantId: brandTenantId },
  });

  if (!brand) {
    brand = await prisma.brandSettings.findFirst({
      where: { tenantId: null },
    });
  }

  const brandingSettings =
    brand && (brand.logoDarkUrl || brand.logoLightUrl)
      ? {
          darkLogoUrl: (brand.logoDarkUrl || brand.logoLightUrl)!,
        }
      : null;

  // Permission gates
  const has = (key: string) => userPermissions.includes(key);
  const hasAny = (keys: string[]) => keys.some((k) => has(k));

  if (!hasAny(["view_security", "manage_security"])) {
    redirect("/");
  }

  const canViewUsersTab = hasAny([
    "users.view",
    "manage_users",
    "manage_security",
  ]);
  const canViewRolesTab = hasAny([
    "roles.view",
    "manage_roles",
    "manage_security",
  ]);
  const canViewPermissionsTab = hasAny([
    "permissions.view",
    "manage_roles",
    "manage_security",
  ]);

  const scopeProp = activeTenantId ? "TENANT" : "CENTRAL";

  const permissionsWhere =
    scopeProp === "CENTRAL"
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
    prisma.permission.findMany({
      where: permissionsWhere,
      orderBy: { key: "asc" },
    }),
  ]);

  const permissionsWithFlag = permissionsRaw.map((p) => ({
    ...p,
    isGlobal: p.tenantId === null,
  }));

  const roles = rolesRaw.map((r) => ({
    ...r,
    scope: r.scope as "CENTRAL" | "TENANT",
    permissions: r.permissions.map((rp) => rp.permission),
  }));

  // active tab logic
  const rawTabParam = params?.tab;
  const rawTab = typeof rawTabParam === "string" ? rawTabParam : undefined;

  let tab = "users";
  if (rawTab === "roles" && canViewRolesTab) tab = "roles";
  else if (rawTab === "permissions" && canViewPermissionsTab)
    tab = "permissions";
  else if (canViewUsersTab) tab = "users";
  else if (canViewRolesTab) tab = "roles";
  else tab = "permissions";

  return (
    <div className="px-4 py-4 lg:px-6 lg:py-6 xl:px-8">
      <div className="mb-5 space-y-2">
       <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb />
          {/* Start Tour button aligned with Breadcrumb */}
          <TourControls steps={[{ id: 'start', title: 'Start Tour' }]} />
        </div>
        <h1 className="text-lg font-semibold tracking-tight">
          Security &amp; Access
        </h1>
      </div>

      <SecurityTabs defaultTab={tab} className="space-y-4">
        <TabsList>
          {canViewUsersTab && <TabsTrigger value="users">Users</TabsTrigger>}
          {canViewRolesTab && <TabsTrigger value="roles">Roles</TabsTrigger>}
          {canViewPermissionsTab && (
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
          )}
        </TabsList>

        {/* USERS */}
        {canViewUsersTab && (
          <TabsContent value="users" className="space-y-4">
            <UsersTab
              tenantId={activeTenantId}
              tenantName={activeTenantName}
              permissions={userPermissions}
              companySettings={companySettings}
              brandingSettings={brandingSettings}
            />
          </TabsContent>
        )}

        {/* ROLES */}
        {canViewRolesTab && (
          <TabsContent value="roles" className="space-y-4">
            <RolesTab
              roles={roles}
              allPermissions={permissionsWithFlag}
              scopeProp={scopeProp}
              tenantId={activeTenantId}
              permissions={userPermissions}
              companySettings={companySettings}
              brandingSettings={brandingSettings}
            />
          </TabsContent>
        )}

        {/* PERMISSIONS */}
        {canViewPermissionsTab && (
          <TabsContent value="permissions" className="space-y-4">
            <PermissionsTab
              permissions={permissionsWithFlag}
              tenantId={activeTenantId}
              permissionsList={userPermissions}
              companySettings={companySettings}
              brandingSettings={brandingSettings}
            />
          </TabsContent>
        )}
      </SecurityTabs>
    </div>
  );
}
