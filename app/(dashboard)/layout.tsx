import { AppConfigProvider } from "@/components/providers/app-config-provider";
import { DashboardShell } from "@/components/dashboard-shell";
import { FileManagerEventListener } from "@/components/file-manager/file-manager-event-listener";
import { PermissionsProvider } from "@/components/providers/permissions-provider";
import { SessionGuard } from "@/components/session-guard";
import { TwoFactorEnforcer } from "@/components/two-factor-enforcer";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

// 1. Define Default Dictionary (Fallback English Keys)
// This ensures that if a translation is missing in the DB, the UI doesn't break.
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
  // Add more default keys here as needed
};

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

  // Parallel fetch for Permissions, Brand, App Settings AND Languages
  const [permissions, brand, appSettings, languages] = await Promise.all([
    getCurrentUserPermissions(tenantId),
    prisma.brandSettings.findFirst({
      where: { tenantId },
    }),
    prisma.appSettings.findUnique({
      where: { tenantId },
    }),
    // ✅ Fetch available languages for the switcher
    prisma.language.findMany({
      where: { tenantId },
      select: { code: true, name: true, translations: true },
    }),
  ]);

  // Fallback to central brand if no tenant brand found
  let finalBrand = brand;
  if (!finalBrand) {
    finalBrand = await prisma.brandSettings.findFirst({
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

  // 2. Determine Active Language
  const activeLocale = appSettings?.locale ?? "en";

  // Find the active language record from the fetched list
  const activeLanguageRecord = languages.find(
    (lang) => lang.code === activeLocale
  );

  // 3. Merge Default Dictionary with Database Translations
  const finalDictionary = activeLanguageRecord?.translations
    ? {
        ...DEFAULT_DICTIONARY,
        ...(activeLanguageRecord.translations as object),
      }
    : DEFAULT_DICTIONARY;

  // Construct Configuration Object (Defaults handling)
  const config = {
    timezone: appSettings?.timezone ?? "UTC",
    locale: activeLocale,
    dateFormat: appSettings?.dateFormat ?? "yyyy-MM-dd",
    timeFormat: appSettings?.timeFormat ?? "HH:mm",
    weekStartsOn: appSettings?.weekStartsOn ?? 1,
    // Ensure this is at least 1 minute
    sessionTimeout:
      appSettings?.sessionTimeout && appSettings.sessionTimeout > 0
        ? appSettings.sessionTimeout
        : 30,
    enforceTwoFactor: appSettings?.enforceTwoFactor ?? false,
    dictionary: finalDictionary as Record<string, string>,
  };

  return (
    <PermissionsProvider permissions={permissions}>
      {/* Inject Global App Configuration (Time, Date, Lang, Translation) */}
      <AppConfigProvider config={config}>
        {/* 1. Watch for inactivity */}
        <SessionGuard timeoutMinutes={config.sessionTimeout} />

        {/* 2. Enforce 2FA if required */}
        <TwoFactorEnforcer
          enforced={config.enforceTwoFactor}
          isEnabled={user.twoFactorEnabled ?? false}
        />

        {/* 3. Global File Manager Listener */}
        <FileManagerEventListener />

        <DashboardShell
          user={{ name: user.name ?? null, email: user.email }}
          permissions={permissions}
          // ✅ Pass Locale & Languages to Shell (for Navbar Switcher)
          currentLocale={activeLocale}
          languages={languages.map((l) => ({ code: l.code, name: l.name }))}
          brand={{
            titleText: finalBrand?.titleText ?? null,
            logoLightUrl: finalBrand?.logoLightUrl ?? null,
            logoDarkUrl: finalBrand?.logoDarkUrl ?? null,
            sidebarIconUrl: finalBrand?.sidebarIconUrl ?? null,
          }}
        >
          {children}
        </DashboardShell>
      </AppConfigProvider>
    </PermissionsProvider>
  );
}