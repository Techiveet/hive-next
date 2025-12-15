//app/(dashboard)/layout.tsx

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

// 1. Define Default Dictionary
const DEFAULT_DICTIONARY = {
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

// Optimized function to fetch minimal email data for menu
async function getUnreadEmailData(userId: string) {
  try {
    const [unreadEmails, unreadCount] = await Promise.all([
      prisma.emailRecipient.findMany({
        where: {
          userId,
          isRead: false,
          folder: "inbox",
        },
        take: 3,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          email: {
            select: {
              id: true,
              subject: true,
              sender: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      prisma.emailRecipient.count({
        where: {
          userId,
          isRead: false,
          folder: "inbox",
        },
      }),
    ]);

    return { unreadEmails, unreadCount };
  } catch (error) {
    console.error("Error fetching unread emails:", error);
    return { unreadEmails: [], unreadCount: 0 };
  }
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

  const tenantId = await resolveTenantIdFromHost();

  // ✅ tenant-aware key (works across ALL tenants)
  const tenantKey = tenantId ?? "central";

  // ✅ SECURITY CHECK: IP RESTRICTION
  const ipCheck = await checkIpRestriction(tenantId);

  if (!ipCheck.allowed) {
    console.warn(`[IP Guard] Blocked ${user.email} from ${ipCheck.ip}`);
    redirect("/ip-restricted");
  }

  const [permissions, brand, appSettings, languages, emailData] =
    await Promise.all([
      getCurrentUserPermissions(tenantId),
      tenantId
        ? prisma.brandSettings.findFirst({
            where: { tenantId },
          })
        : Promise.resolve(null),
      tenantId
        ? prisma.appSettings.findUnique({
            where: { tenantId },
          })
        : Promise.resolve(null),
      tenantId
        ? prisma.language.findMany({
            where: { tenantId },
            select: { code: true, name: true, translations: true },
          })
        : Promise.resolve([]),
      getUnreadEmailData(user.id),
    ]);

  // Fallback to global/default brand
  let finalBrand = brand;
  if (!finalBrand && tenantId !== null) {
    finalBrand = await prisma.brandSettings.findFirst({
      where: { tenantId: null },
    });
  }

  // Fallback to global/default app settings
  let finalAppSettings = appSettings;
  if (!finalAppSettings && tenantId !== null) {
    finalAppSettings = await prisma.appSettings.findFirst({
      where: { tenantId: null },
    });
  }

  if (!permissions || permissions.length === 0) {
    redirect("/access-denied");
  }

  // Determine Active Language
  const activeLocale = finalAppSettings?.locale ?? "en";

  const activeLanguageRecord =
    languages.length > 0
      ? languages.find((lang) => lang.code === activeLocale)
      : null;

  const finalDictionary = activeLanguageRecord?.translations
    ? {
        ...DEFAULT_DICTIONARY,
        ...(activeLanguageRecord.translations as object),
      }
    : DEFAULT_DICTIONARY;

  const config = {
    timezone: finalAppSettings?.timezone ?? "UTC",
    locale: activeLocale,
    dateFormat: finalAppSettings?.dateFormat ?? "yyyy-MM-dd",
    timeFormat: finalAppSettings?.timeFormat ?? "HH:mm",
    weekStartsOn: finalAppSettings?.weekStartsOn ?? 1,
    sessionTimeout:
      finalAppSettings?.sessionTimeout && finalAppSettings.sessionTimeout > 0
        ? finalAppSettings.sessionTimeout
        : 30,
    enforceTwoFactor: finalAppSettings?.enforceTwoFactor ?? false,
    dictionary: finalDictionary as Record<string, string>,
  };

  return (
    <PermissionsProvider permissions={permissions}>
      <AppConfigProvider config={config}>
        <I18nProvider
          locale={activeLocale}
          messages={finalDictionary as Record<string, string>}
        >
          <SessionGuard timeoutMinutes={config.sessionTimeout} />
          <TwoFactorEnforcer
            enforced={config.enforceTwoFactor}
            isEnabled={user.twoFactorEnabled ?? false}
          />
          <FileManagerEventListener />

          <DashboardShell
            tenantKey={tenantKey} // ✅ PASS DOWN
            user={{
              id: user.id,
              name: user.name ?? null,
              email: user.email,
              image: user.image ?? null,
            }}
            permissions={permissions}
            currentLocale={activeLocale}
            languages={languages.map((l) => ({ code: l.code, name: l.name }))}
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
