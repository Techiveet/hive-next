// app/(dashboard)/settings/page.tsx

import { notFound, redirect } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import type { Metadata } from "next";
import { SettingsClient } from "./_components/settings-client";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Settings", // -> "Settings | <brand title or Hive>"
};

export default async function SettingsPage() {
  const { user } = await getCurrentSession();

  if (!user) {
    redirect("/sign-in?callbackURL=/settings");
  }

  // 🔐 PERMISSION CHECK FOR SETTINGS ROUTE
  const permissions = await getCurrentUserPermissions();

  const has = (key: string) => permissions.includes(key);
  const hasAny = (keys: string[]) => keys.some((k) => permissions.includes(k));

  // who can *see* Settings at all
  const canViewSettings =
    has("manage_settings") ||
    hasAny([
      "settings.brand.view",
      "settings.company.view",
      "settings.email.view",
      "settings.notifications.view",
      "settings.system.view",
      "manage_tenants",
      "manage_security",
    ]);

  if (!canViewSettings) {
    // ❌ no permission => pretend the page doesn't exist
    notFound();
  }

  const { tenant } = await getTenantAndUser();
  const tenantId = tenant?.id ?? null;

  const brand = await prisma.brandSettings.findUnique({
    where: { tenantId },
  });

  const company = await prisma.companySettings.findUnique({
    where: { tenantId },
  });

  const email = await prisma.emailSettings.findUnique({
    where: { tenantId },
  });

  return (
    <div className="px-4 py-4 lg:px-6 lg:py-6 xl:px-8">
      {/* Header + breadcrumb (same pattern as Security Users page) */}
      <div className="mb-5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          <p className="text-xs text-muted-foreground">
            Manage brand, workspace, and system configuration.
          </p>
        </div>
      </div>

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
          sidebarIconUrl: brand?.sidebarIconUrl ?? "",
        }}
        companySettings={{
          companyName: company?.companyName ?? "",
          legalName: company?.legalName ?? "",
          email: company?.email ?? "",
          phone: company?.phone ?? "",
          website: company?.website ?? "",
          addressLine1: company?.addressLine1 ?? "",
          addressLine2: company?.addressLine2 ?? "",
          city: company?.city ?? "",
          state: company?.state ?? "",
          postalCode: company?.postalCode ?? "",
          country: company?.country ?? "",
          taxId: company?.taxId ?? "",
          registrationNumber: company?.registrationNumber ?? "",
        }}
        emailSettings={{
    provider: (email?.provider as "RESEND" | "SMTP") ?? "RESEND",
    fromName: email?.fromName ?? "",
    fromEmail: email?.fromEmail ?? "",
    replyToEmail: email?.replyToEmail ?? "",
    smtpHost: email?.smtpHost ?? "",
    smtpPort: email?.smtpPort ?? null,
    smtpUser: email?.smtpUser ?? "",
    smtpSecurity: (email?.smtpSecurity as "tls" | "ssl" | "none") ?? "tls",
  }}
      />
    </div>
  );
}
