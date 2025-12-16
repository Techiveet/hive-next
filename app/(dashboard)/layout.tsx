// app/(dashboard)/layout.tsx

import { AppConfigProvider } from "@/components/providers/app-config-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { FileManagerEventListener } from "@/components/file-manager/file-manager-event-listener";
import { I18nProvider } from "@/lib/i18n/client";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import type { ReactNode } from "react";
import { SessionGuard } from "@/components/session-guard";
import { TwoFactorEnforcer } from "@/components/two-factor-enforcer";
import type { UnreadEmailData } from "@/components/email-menu";
import { checkIpRestriction } from "@/lib/ip-guard";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const DEFAULT_DICTIONARY: Record<string, string> = {
  "dashboard.title": "Dashboard",
  "sidebar.home": "Home",
  "sidebar.settings": "Settings",
  "auth.login": "Sign In",
  "auth.logout": "Sign Out",
  "common.save": "Save Changes",
  "common.cancel": "Cancel",
  "settings.profile": "Profile",
  "settings.security": "Security",
  "sidebar.dashboard": "Dashboard",
  "sidebar.tenants": "Tenants",
  "sidebar.security": "Security",
  "sidebar.files": "Files",
  "sidebar.billing": "Billing",
  "validation.email": "Please enter a valid email",
  "validation.required": "This field is required",
};

function getBareHost(h: Headers) {
  return (h.get("host") || "").toLowerCase().split(":")[0];
}

async function resolveTenantFromHost(): Promise<{ id: string; slug: string } | null> {
  const h = await headers();
  const bareHost = getBareHost(h);

  if (bareHost === "localhost") {
    const central = await prisma.tenant.findUnique({
      where: { slug: "central-hive" },
      select: { id: true, slug: true },
    });
    return central ?? null;
  }

  const domain = await prisma.tenantDomain.findFirst({
    where: { domain: bareHost },
    select: { tenant: { select: { id: true, slug: true } } },
  });

  return domain?.tenant ?? null;
}


async function getUnreadEmailData(userId: string) {
  try {
    const [unreadEmails, unreadCount] = await Promise.all([
      prisma.emailRecipient.findMany({
        where: { userId, isRead: false, folder: "inbox" },
        take: 3,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          email: {
            select: {
              id: true,
              subject: true,
              sender: { select: { name: true, email: true } },
            },
          },
        },
      }),
      prisma.emailRecipient.count({
        where: { userId, isRead: false, folder: "inbox" },
      }),
    ]);

    return { unreadEmails, unreadCount };
  } catch (err) {
    console.error("[DashboardLayout] unread emails fetch failed:", err);
    return { unreadEmails: [], unreadCount: 0 };
  }
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = await getCurrentSession();
  if (!user) redirect("/sign-in?callbackURL=/dashboard");

  const tenant = await resolveTenantFromHost();
const tenantId = tenant?.id ?? null;
const tenantKey = tenant?.slug ?? "GLOBAL"; // ✅ CORRECT


  const ipCheck = await checkIpRestriction(tenantId);
  if (!ipCheck.allowed) redirect("/ip-restricted");

  const [
    permissions,
    tenantBrand,
    tenantAppSettings,
    tenantLanguages,
    globalBrand,
    globalAppSettings,
    emailData,
  ] = await Promise.all([
    getCurrentUserPermissions(tenantId),

    prisma.brandSettings.findFirst({ where: { tenantId } }),
    prisma.appSettings.findFirst({ where: { tenantId } }),
    prisma.language.findMany({
      where: { tenantId },
      select: { code: true, name: true, translations: true },
    }),

    prisma.brandSettings.findFirst({ where: { tenantId: null } }),
    prisma.appSettings.findFirst({ where: { tenantId: null } }),

    getUnreadEmailData(user.id),
  ]);

  if (!permissions || permissions.length === 0) redirect("/access-denied");

  const finalBrand = tenantBrand ?? globalBrand ?? null;
  const finalAppSettings = tenantAppSettings ?? globalAppSettings ?? null;

  const activeLocale = finalAppSettings?.locale ?? "en";
  const activeLanguageRecord =
    tenantLanguages.length > 0 ? tenantLanguages.find((l) => l.code === activeLocale) : null;

  const dictionary: Record<string, string> = activeLanguageRecord?.translations
    ? { ...DEFAULT_DICTIONARY, ...(activeLanguageRecord.translations as Record<string, string>) }
    : DEFAULT_DICTIONARY;

  const config = {
    timezone: finalAppSettings?.timezone ?? "UTC",
    locale: activeLocale,
    dateFormat: finalAppSettings?.dateFormat ?? "yyyy-MM-dd",
    timeFormat: finalAppSettings?.timeFormat ?? "HH:mm",
    weekStartsOn: typeof finalAppSettings?.weekStartsOn === "number" ? finalAppSettings.weekStartsOn : 1,
    sessionTimeout:
      typeof finalAppSettings?.sessionTimeout === "number" && finalAppSettings.sessionTimeout > 0
        ? finalAppSettings.sessionTimeout
        : 30,
    enforceTwoFactor: finalAppSettings?.enforceTwoFactor ?? false,
    dictionary,
  };

  return (
    <PermissionsProvider permissions={permissions}>
      <AppConfigProvider config={config}>
        <I18nProvider locale={activeLocale} messages={dictionary}>
          <SessionGuard timeoutMinutes={config.sessionTimeout} />
          <TwoFactorEnforcer enforced={config.enforceTwoFactor} isEnabled={user.twoFactorEnabled ?? false} />
          <FileManagerEventListener />

          <DashboardShell
            tenantKey={tenantKey}
            user={{ id: user.id, name: user.name ?? null, email: user.email, image: user.image ?? null }}
            permissions={permissions}
            currentLocale={activeLocale}
            languages={tenantLanguages.map((l) => ({ code: l.code, name: l.name }))}
            brand={{
              titleText: finalBrand?.titleText ?? null,
              logoLightUrl: finalBrand?.logoLightUrl ?? null,
              logoDarkUrl: finalBrand?.logoDarkUrl ?? null,
              sidebarIconUrl: finalBrand?.sidebarIconUrl ?? null,
            }}
            emailData={{
              count: emailData.unreadCount,
              items: emailData.unreadEmails as UnreadEmailData[],
            }}
          >
            {children}
          </DashboardShell>
        </I18nProvider>
      </AppConfigProvider>
    </PermissionsProvider>
  );
}
