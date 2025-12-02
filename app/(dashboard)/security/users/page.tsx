// app/(dashboard)/security/users/page.tsx

import { Breadcrumb } from "@/components/breadcrumb";
import UsersClient from "./_components/users-tab-client";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/rbac";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

// --- same helper you used in Tenants page ---
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

export default async function UsersPage() {
  const { user } = await getCurrentSession();
  if (!user?.id) redirect("/");

  const permissions = await getCurrentUserPermissions(null); // central
  const canManageUsers =
    permissions.includes("manage_users") ||
    permissions.includes("manage_security");

  if (!canManageUsers) redirect("/");

  // --- your existing users query here ---
  const users = await prisma.user.findMany({
    /* ...existing include/orderBy... */
  });
  const tenantId = await resolveTenantIdFromHost();

  // ---------- COMPANY SETTINGS (tenant-aware) ----------
  let company = await prisma.companySettings.findFirst({
    where: { tenantId }, // resolve from host
  });

  if (!company) {
    company = await prisma.companySettings.findFirst({
      where: { tenantId: null }, // global fallback
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

  // ---------- BRAND SETTINGS (same as Tenants) ----------

  let brand = await prisma.brandSettings.findFirst({
    where: { tenantId },
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

  return (
    <div className="px-4 py-4 lg:px-6 lg:py-6 xl:px-8">
      <div className="mb-5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Users</h1>
          <p className="text-xs text-muted-foreground">
            Manage central users, roles and access.
          </p>
        </div>
      </div>

      <UsersClient
        users={users}
        canManageUsers={canManageUsers}
        companySettings={companySettings}
        brandingSettings={brandingSettings}
      />
    </div>
  );
}
