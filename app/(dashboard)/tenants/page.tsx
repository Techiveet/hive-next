// app/(dashboard)/tenants/page.tsx

import { Breadcrumb } from "@/components/breadcrumb";
import { RoleScope } from "@prisma/client";
import { TenantsClient } from "./_components/tenants-client";
import { TourControls } from "@/components/tour/tour-controls"; // Import the TourControls
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/rbac";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

/**
 * Same host → tenant resolution logic you use in the dashboard layout
 */
async function resolveTenantIdFromHost(): Promise<string | null> {
  const h = await headers();
  const host = (h.get("host") || "").toLowerCase();
  const bareHost = host.split(":")[0];

  // local dev → central tenant by slug
  if (bareHost === "localhost") {
    const centralTenant = await prisma.tenant.findUnique({
      where: { slug: "central-hive" },
      select: { id: true },
    });
    return centralTenant?.id ?? null;
  }

  // custom domain → tenantDomain table
  const domain = await prisma.tenantDomain.findFirst({
    where: { domain: bareHost },
    select: { tenantId: true },
  });

  return domain?.tenantId ?? null;
}

export default async function TenantsPage() {
  const { user } = await getCurrentSession();
  if (!user?.id) redirect("/");

  const permissions = await getCurrentUserPermissions(null); // CENTRAL context
  const canManageTenants =
    permissions.includes("manage_tenants") ||
    permissions.includes("manage_security");

  if (!canManageTenants) {
    redirect("/");
  }

  // ---------- TENANTS ----------
  const tenants = await prisma.tenant.findMany({
    include: {
      domains: true,
      users: {
        where: { isOwner: true },
        include: { user: true },
      },
      roles: {
        where: { scope: RoleScope.TENANT },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = tenants.map((t) => {
    const primaryOwner = t.users[0]?.user ?? null;
    const superRole = t.roles.find((r) => r.key === "tenant_superadmin");

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      isActive: t.isActive,
      createdAt: t.createdAt.toISOString(),
      domain: t.domains[0]?.domain ?? null,
      superadmin: primaryOwner
        ? {
            id: primaryOwner.id,
            name: primaryOwner.name,
            email: primaryOwner.email,
          }
        : null,
      superadminRoleId: superRole?.id ?? null,
    };
  });

  // ---------- COMPANY SETTINGS (header text) ----------
  const company = await prisma.companySettings.findFirst();
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

  // ---------- BRAND (same source as Sidebar) ----------
  const tenantId = await resolveTenantIdFromHost();

  // 1) try brand for this tenant
  let brand = await prisma.brandSettings.findFirst({
    where: { tenantId },
  });

  // 2) fallback to global/central brand (tenantId = null)
  if (!brand) {
    brand = await prisma.brandSettings.findFirst({
      where: { tenantId: null },
    });
  }

  const brandingSettings =
    brand && (brand.logoDarkUrl || brand.logoLightUrl)
      ? {
          // prefer dark logo, fall back to light (so export always has *some* logo)
          darkLogoUrl: (brand.logoDarkUrl || brand.logoLightUrl)!,
        }
      : null;

  return (
    <div className="px-4 py-4 lg:px-6 lg:py-6 xl:px-8">
      <div className="mb-5 space-y-2">
         <div className="flex flex-wrap items-center justify-between gap-3">
                  <Breadcrumb />
                  {/* Start Tour button aligned with Breadcrumb */}
                  <TourControls steps={[{ id: 'start', title: 'Start Tour' }]} />
                </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Tenants</h1>
          <p className="text-xs text-muted-foreground">
            Manage tenant lifecycle, domains, and tenant users.
          </p>
        </div>
      </div>

      <TenantsClient
        tenants={mapped}
        canManageTenants={canManageTenants}
        companySettings={companySettings}
        brandingSettings={brandingSettings}
      />
    </div>
  );
}
