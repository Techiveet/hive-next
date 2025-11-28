// app/(dashboard)/tenants/page.tsx

import { Breadcrumb } from "@/components/breadcrumb";
import { RoleScope } from "@prisma/client";
import { TenantsClient } from "./_components/tenants-client";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

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
      superadminRoleId: superRole?.id ?? null, // ✅ needed for tenant user modal
    };
  });

  return (
    <div className="px-4 py-4 lg:px-6 lg:py-6 xl:px-8">
      <div className="mb-5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Tenants</h1>
          <p className="text-xs text-muted-foreground">
            Manage tenant lifecycle, domains, and tenant users.
          </p>
        </div>
      </div>

      <TenantsClient tenants={mapped} canManageTenants={canManageTenants} />
    </div>
  );
}
