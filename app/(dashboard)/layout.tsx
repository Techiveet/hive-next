import { AppConfigProvider } from "@/components/providers/app-config-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { FileManagerEventListener } from "@/components/file-manager/file-manager-event-listener";
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

  // ✅ SECURITY CHECK: IP RESTRICTION
  const ipCheck = await checkIpRestriction(tenantId);

  if (!ipCheck.allowed) {
    console.warn(`[IP Guard] Blocked ${user.email} from ${ipCheck.ip}`);
    redirect("/ip-restricted");
  }

  // ✅ Parallel fetch: Permissions, Brand, Settings, Languages AND EMAILS
  // We use non-null assertion (!) where tenantId is required by Prisma but inferred as null
  // by TypeScript (e.g., in the 'where' clause for findUnique/findMany).
  const [
    permissions,
    brand,
    appSettings,
    languages,
    unreadEmails,
    unreadCount,
  ] = await Promise.all([
    getCurrentUserPermissions(tenantId),
    prisma.brandSettings.findFirst({
      where: { tenantId: tenantId! }, // ⬅️ FIX: Non-null assertion
    }),
    prisma.appSettings.findUnique({
      where: { tenantId: tenantId! }, // ⬅️ FIX: Non-null assertion (Line 91)
    }),
    prisma.language.findMany({
      where: { tenantId: tenantId! }, // ⬅️ FIX: Non-null assertion (Line 94)
      select: { code: true, name: true, translations: true },
    }),
    // 📧 Fetch 5 latest unread emails for the dropdown
    prisma.emailRecipient.findMany({
      where: { userId: user.id, isRead: false, folder: "inbox" },
      take: 5,
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
    // 📧 Fetch total unread count
    prisma.emailRecipient.count({
      where: { userId: user.id, isRead: false, folder: "inbox" },
    }),
  ]);

  let finalBrand = brand;
  if (!finalBrand) {
    finalBrand = await prisma.brandSettings.findFirst({
      where: { tenantId: null },
    });
  }

  if (!permissions || permissions.length === 0) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[DashboardLayout] No permissions → redirecting to /access-denied"
      );
    }
    redirect("/access-denied");
  }

  // 2. Determine Active Language
  const activeLocale = appSettings?.locale ?? "en";
  const activeLanguageRecord = languages.find(
    (lang) => lang.code === activeLocale
  );

  const finalDictionary = activeLanguageRecord?.translations
    ? {
        ...DEFAULT_DICTIONARY,
        ...(activeLanguageRecord.translations as object),
      }
    : DEFAULT_DICTIONARY;

  const config = {
    timezone: appSettings?.timezone ?? "UTC",
    locale: activeLocale,
    dateFormat: appSettings?.dateFormat ?? "yyyy-MM-dd",
    timeFormat: appSettings?.timeFormat ?? "HH:mm",
    weekStartsOn: appSettings?.weekStartsOn ?? 1,
    sessionTimeout:
      appSettings?.sessionTimeout && appSettings.sessionTimeout > 0
        ? appSettings.sessionTimeout
        : 30,
    enforceTwoFactor: appSettings?.enforceTwoFactor ?? false,
    dictionary: finalDictionary as Record<string, string>,
  };

  return (
    <PermissionsProvider permissions={permissions}>
      <AppConfigProvider config={config}>
        <SessionGuard timeoutMinutes={config.sessionTimeout} />
        <TwoFactorEnforcer
          enforced={config.enforceTwoFactor}
          isEnabled={user.twoFactorEnabled ?? false}
        />
        <FileManagerEventListener />

        <DashboardShell
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
          // ✅ PASS EMAIL DATA
          emailData={{
            count: unreadCount,
            items: unreadEmails as UnreadEmailData[],
          }}
        >
          {children}
        </DashboardShell>
      </AppConfigProvider>
    </PermissionsProvider>
  );
}
