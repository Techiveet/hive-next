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
    title: "Settings", 
};

export default async function SettingsPage() {
    const { user: sessionUser } = await getCurrentSession();

    if (!sessionUser) {
        redirect("/sign-in?callbackURL=/settings");
    }

    // Fetch the full user record, including the key status fields.
    const user = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: {
            id: true,
            name: true,
            email: true,
            pgpPublicKey: true, 
            encryptedPrivateKey: true, // <--- FETCH THE NEW PRIVATE KEY STATUS
        },
    });

    if (!user) {
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

    const { tenant } = await getTenantAndUser();
    const tenantId = tenant?.id ?? null;

    // ⚡️ Parallel fetch: Brand, Company, Email, AppConfig, AND Languages
    const [brand, company, email, appSettings, languages] = await Promise.all([
        prisma.brandSettings.findUnique({ where: { tenantId } }),
        prisma.companySettings.findUnique({ where: { tenantId } }),
        prisma.emailSettings.findUnique({ where: { tenantId } }),
        prisma.appSettings.findUnique({ where: { tenantId } }),
        // ✅ Add Language Fetch
        prisma.language.findMany({
            where: { tenantId },
            orderBy: { name: "asc" },
        }),
    ]);

    // Default Fallbacks
    const defaultAppSettings = {
        timezone: "UTC",
        locale: "en",
        dateFormat: "yyyy-MM-dd",
        timeFormat: "HH:mm",
        weekStartsOn: 1,
        defaultTheme: "system",
        allowUserThemeOverride: true,
        enforceTwoFactor: false,
        sessionTimeout: 30,
    };

    // Determine the key status based on both fields
    const hasPgpKey = !!user.pgpPublicKey && !!user.encryptedPrivateKey;


    return (
        <div className="px-4 py-4 lg:px-6 lg:py-6 xl:px-8">
            {/* Header + breadcrumb */}
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
                    // Use the computed boolean status for the client component
                    hasPgpKey: hasPgpKey, 
                }}
                tenant={
                    tenant
                        ? { id: tenant.id, name: tenant.name, slug: tenant.slug }
                        : null
                }
                permissions={permissions}
                // ✅ Pass the fetched languages to the client
                languages={languages} 
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
                    weekStartsOn: appSettings?.weekStartsOn ?? defaultAppSettings.weekStartsOn,
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