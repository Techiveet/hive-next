import { DashboardShell } from "@/components/dashboard-shell";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import type { ReactNode } from "react";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Dashboard | Hive",
};

// Resolve tenant from the current host (test.localhost etc.)
async function resolveCurrentTenantId() {
  const h = await headers();
  const host = (h.get("host") || "").toLowerCase(); // e.g. "test.localhost:3000"
  const bareHost = host.split(":")[0]; // -> "test.localhost"

  if (!bareHost) return null;

  // tenantDomain.domain should be like "test.localhost"
  const domain = await prisma.tenantDomain.findFirst({
    where: { domain: bareHost },
    select: { tenantId: true },
  });

  return domain?.tenantId ?? null;
}

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = await getCurrentSession();

  if (!user) {
    redirect("/sign-in?callbackURL=/dashboard");
  }

  const tenantId = await resolveCurrentTenantId();
  const permissions = await getCurrentUserPermissions(tenantId);

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
      <DashboardShell
        user={{ name: user.name ?? null, email: user.email }}
        permissions={permissions}
      >
        {children}
      </DashboardShell>
    </PermissionsProvider>
  );
}
