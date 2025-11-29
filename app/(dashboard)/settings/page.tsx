// app/(dashboard)/settings/page.tsx

import type { Metadata } from "next";
import { SettingsClient } from "./_components/settings-client";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Settings", // -> "Settings | <brand title or Hive>"
};

export default async function SettingsPage() {
  const { user } = await getCurrentSession();

  if (!user) {
    redirect("/sign-in?callbackURL=/settings");
  }

  const { tenant } = await getTenantAndUser();
  const permissions = await getCurrentUserPermissions();
  const tenantId = tenant?.id ?? null;

  const brand = await prisma.brandSettings.findUnique({
    where: { tenantId },
  });

  return (
    <SettingsClient
      user={{
        id: user.id,
        name: user.name ?? "",
        email: user.email,
      }}
      tenant={
        tenant
          ? { id: tenant.id, name: tenant.name, slug: tenant.slug }
          : null
      }
      permissions={permissions}
      brandSettings={{
        titleText: brand?.titleText ?? "",
        footerText: brand?.footerText ?? "",
        logoLightUrl: brand?.logoLightUrl ?? "",
        logoDarkUrl: brand?.logoDarkUrl ?? "",
        faviconUrl: brand?.faviconUrl ?? "",
      }}
    />
  );
}
