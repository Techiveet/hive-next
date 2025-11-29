// app/(dashboard)/security/layout.tsx

import { DashboardShell } from "@/components/dashboard-shell";
import { FileManagerEventListener } from "@/components/file-manager/file-manager-event-listener";
import type { Metadata } from "next";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

// 🔹 Use SAME tenant resolution logic as SignIn
async function resolveTenantIdFromHost(): Promise<string | null> {
  const h = await headers();
  const host = (h.get("host") || "").toLowerCase();
  const bareHost = host.split(":")[0];

  let tenantId: string | null = null;

  if (bareHost === "localhost") {
    const centralTenant = await prisma.tenant.findUnique({
      where: { slug: "central-hive" },
      select: { id: true },
    });
    tenantId = centralTenant?.id ?? null;
  } else {
    const domain = await prisma.tenantDomain.findFirst({
      where: { domain: bareHost },
      select: { tenantId: true },
    });
    tenantId = domain?.tenantId ?? null;
  }

  return tenantId;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getCurrentSession();

  if (!user) {
    redirect("/sign-in?callbackURL=/dashboard");
  }

  // 👇 Same tenantId as SignIn now
  const tenantId = await resolveTenantIdFromHost();

  const permissions = await getCurrentUserPermissions(tenantId);

  // Load brand for THIS tenant
  let brand = await prisma.brandSettings.findFirst({
    where: { tenantId },
  });

  // Optional: fallback to central brand (tenantId = null) if nothing found
  if (!brand) {
    brand = await prisma.brandSettings.findFirst({
      where: { tenantId: null },
    });
  }

  if (!permissions || permissions.length === 0) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[DashboardLayout] No permissions → redirecting to /access-denied",
        {
          email: user.email,
          tenantId,
          permissionsCount: permissions?.length ?? 0,
        }
      );
    }
    redirect("/access-denied");
  }

  return (
    <PermissionsProvider permissions={permissions}>
      {/* Global “Choose from File Manager” listener */}
      <FileManagerEventListener />

      <DashboardShell
        user={{ name: user.name ?? null, email: user.email }}
        permissions={permissions}
        brand={{
          titleText: brand?.titleText ?? null,
          logoLightUrl: brand?.logoLightUrl ?? null,
          logoDarkUrl: brand?.logoDarkUrl ?? null,
          faviconUrl: brand?.faviconUrl ?? null,
        }}
      >
        {children}
      </DashboardShell>
    </PermissionsProvider>
  );
}
