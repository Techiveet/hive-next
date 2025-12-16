// app/(dashboard)/settings/page.tsx

import { notFound, redirect } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import type { Metadata } from "next";
import { SettingsClient } from "./_components/settings-client";
import { TourControls } from "@/components/tour/tour-controls"; // Import the TourControls
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const { user: sessionUser } = await getCurrentSession();

  if (!sessionUser) {
    redirect("/sign-in?callbackURL=/settings");
  }

  // 🔐 PERMISSION CHECK
  const permissions = await getCurrentUserPermissions();
  const has = (key: string) => permissions.includes(key);
  const hasAny = (keys: string[]) => keys.some((k) => permissions.includes(k));

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
    notFound();
  }

  // Fetch the full user record, including key status fields.
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      pgpPublicKey: true,
      encryptedPrivateKey: true,
    },
  });

  if (!user) {
    redirect("/sign-in?callbackURL=/settings");
  }

  const { tenant } = await getTenantAndUser();
  const tenantId = tenant?.id ?? null;
  const isCentral = !tenant || tenant.slug === "central-hive";

  // ✅ Tours: central sees ALL tours, non-central sees none (tab is central-only anyway)
  const toursPromise = isCentral
    ? prisma.tour.findMany({
        orderBy: [{ name: "asc" }],
        select: {
          id: true,
          tenantId: true,
          tenantKey: true, // ✅ important (GLOBAL vs tenant)
          key: true,
          name: true,
          isActive: true,
          version: true,
          steps: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              order: true,
              selector: true,
              title: true,
              body: true,
              placement: true,
              padding: true,
              rectX: true,
              rectY: true,
              rectWidth: true,
              rectHeight: true,
              onlyPathPrefix: true,
            },
          },
        },
      })
    : Promise.resolve([]);

  // ✅ JSON-safe selects (avoid Date serialization issues to Client Components)
  const [brand, company, email, appSettings, languages, tours] =
    await Promise.all([
      prisma.brandSettings.findUnique({
        where: { tenantId },
        select: {
          titleText: true,
          footerText: true,
          logoLightUrl: true,
          logoDarkUrl: true,
          faviconUrl: true,
          sidebarIconUrl: true,
        },
      }),
      prisma.companySettings.findUnique({
        where: { tenantId },
        select: {
          companyName: true,
          legalName: true,
          email: true,
          phone: true,
          website: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          taxId: true,
          registrationNumber: true,
        },
      }),
      prisma.emailSettings.findUnique({
        where: { tenantId },
        select: {
          provider: true,
          fromName: true,
          fromEmail: true,
          replyToEmail: true,
          smtpHost: true,
          smtpPort: true,
          smtpUser: true,
          smtpSecurity: true,
        },
      }),
      prisma.appSettings.findUnique({
        where: { tenantId },
        select: {
          timezone: true,
          locale: true,
          dateFormat: true,
          timeFormat: true,
          weekStartsOn: true,
          defaultTheme: true,
          allowUserThemeOverride: true,
          enforceTwoFactor: true,
          sessionTimeout: true,
        },
      }),
      prisma.language.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          isDefault: true,
          isEnabled: true,
          translations: true,
        },
      }),
      toursPromise,
    ]);

  const defaultAppSettings = {
    timezone: "UTC",
    locale: "en",
    dateFormat: "yyyy-MM-dd",
    timeFormat: "HH:mm",
    weekStartsOn: 1,
    defaultTheme: "system" as const,
    allowUserThemeOverride: true,
    enforceTwoFactor: false,
    sessionTimeout: 30,
  };

  // Determine the key status based on both fields
  const hasPgpKey = !!user.pgpPublicKey && !!user.encryptedPrivateKey;

  return (
    <div className="px-4 py-4 lg:px-6 lg:py-6 xl:px-8">
      <div className="mb-5 space-y-2">
       <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb />
          {/* Start Tour button aligned with Breadcrumb */}
          <TourControls steps={[{ id: 'start', title: 'Start Tour' }]} />
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
          hasPgpKey,
        }}
        tenant={
          tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null
        }
        permissions={permissions}
        languages={languages}
        tours={tours}
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
        appSettings={{
          timezone: appSettings?.timezone ?? defaultAppSettings.timezone,
          locale: appSettings?.locale ?? defaultAppSettings.locale,
          dateFormat: appSettings?.dateFormat ?? defaultAppSettings.dateFormat,
          timeFormat: appSettings?.timeFormat ?? defaultAppSettings.timeFormat,
          weekStartsOn:
            appSettings?.weekStartsOn ?? defaultAppSettings.weekStartsOn,
          defaultTheme:
            (appSettings?.defaultTheme as "light" | "dark" | "system") ??
            defaultAppSettings.defaultTheme,
          allowUserThemeOverride:
            appSettings?.allowUserThemeOverride ??
            defaultAppSettings.allowUserThemeOverride,
          enforceTwoFactor:
            appSettings?.enforceTwoFactor ?? defaultAppSettings.enforceTwoFactor,
          sessionTimeout:
            appSettings?.sessionTimeout ?? defaultAppSettings.sessionTimeout,
        }}
      />
    </div>
  );
}
