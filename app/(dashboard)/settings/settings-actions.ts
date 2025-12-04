"use server";

import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/* ------------------------------------------------------------------ */
/* PROFILE                                                            */
/* ------------------------------------------------------------------ */

export type UpdateProfileInput = {
  name: string;
};

export async function updateProfileAction(input: UpdateProfileInput) {
  const { user } = await getCurrentSession();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  const name = input.name.trim();
  if (!name) {
    throw new Error("NAME_REQUIRED");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name },
  });

  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

/* ------------------------------------------------------------------ */
/* TENANT SETTINGS (NAME / SLUG / DOMAIN)                             */
/* ------------------------------------------------------------------ */

export type UpdateTenantSettingsInput = {
  name: string;
  slug: string;
  domain?: string;
};

export async function updateTenantSettingsAction(
  input: UpdateTenantSettingsInput
) {
  const { user } = await getCurrentSession();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  const { tenant } = await getTenantAndUser();
  if (!tenant) {
    throw new Error("NO_ACTIVE_TENANT");
  }

  const perms = await getCurrentUserPermissions();
  const allowed = perms.some((p) =>
    [
      "manage_tenants",
      "manage_security",
      "settings.localization.update",
      "settings.company.update",
    ].includes(p)
  );

  if (!allowed) {
    throw new Error("FORBIDDEN_INSUFFICIENT_PERMISSIONS");
  }

  const name = input.name.trim();
  const slug =
    input.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  if (!name) throw new Error("TENANT_NAME_REQUIRED");
  if (!slug) throw new Error("TENANT_SLUG_REQUIRED");

  const domain = input.domain?.trim() || undefined;

  const existingSlug = await prisma.tenant.findFirst({
    where: {
      slug,
      id: { not: tenant.id },
    },
  });

  if (existingSlug) {
    throw new Error("TENANT_SLUG_IN_USE");
  }

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: tenant.id },
      data: { name, slug },
    });

    await tx.tenantDomain.deleteMany({
      where: { tenantId: tenant.id },
    });

    if (domain) {
      await tx.tenantDomain.create({
        data: {
          tenantId: tenant.id,
          domain,
        },
      });
    }
  });

  revalidatePath("/settings");
  revalidatePath("/tenants");
}

/* ------------------------------------------------------------------ */
/* APP / SYSTEM CONFIGURATION (Timezone, Locale, Security, Theme)     */
/* ------------------------------------------------------------------ */

export type UpdateAppSettingsInput = {
  timezone: string;
  locale: string;
  dateFormat: string;
  timeFormat: string;
  weekStartsOn: number;
  defaultTheme: "light" | "dark" | "system";
  allowUserThemeOverride: boolean;
  enforceTwoFactor: boolean;
  sessionTimeout: number;
};

export async function updateAppSettingsAction(input: UpdateAppSettingsInput) {
  const { user } = await getCurrentSession();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  const { tenant } = await getTenantAndUser();
  const tenantId = tenant?.id ?? null;

  const perms = await getCurrentUserPermissions();
  const allowed = perms.some((p) =>
    ["manage_tenants", "manage_security", "settings.system.update"].includes(p)
  );

  if (!allowed) {
    throw new Error("FORBIDDEN_INSUFFICIENT_PERMISSIONS");
  }

  await prisma.appSettings.upsert({
    where: { tenantId },
    update: {
      timezone: input.timezone,
      locale: input.locale,
      dateFormat: input.dateFormat,
      timeFormat: input.timeFormat,
      weekStartsOn: input.weekStartsOn,
      defaultTheme: input.defaultTheme,
      allowUserThemeOverride: input.allowUserThemeOverride,
      enforceTwoFactor: input.enforceTwoFactor,
      sessionTimeout: input.sessionTimeout,
    },
    create: {
      tenantId,
      timezone: input.timezone,
      locale: input.locale,
      dateFormat: input.dateFormat,
      timeFormat: input.timeFormat,
      weekStartsOn: input.weekStartsOn,
      defaultTheme: input.defaultTheme,
      allowUserThemeOverride: input.allowUserThemeOverride,
      enforceTwoFactor: input.enforceTwoFactor,
      sessionTimeout: input.sessionTimeout,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* BRAND SETTINGS (LOGOS + TEXT)                                      */
/* ------------------------------------------------------------------ */

export type UpdateBrandSettingsInput = {
  titleText: string;
  footerText: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
  faviconUrl?: string;
  sidebarIconUrl?: string;
};

export async function updateBrandSettingsAction(
  input: UpdateBrandSettingsInput
) {
  const { user } = await getCurrentSession();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  const { tenant } = await getTenantAndUser();
  const tenantId = tenant?.id ?? null;

  const perms = await getCurrentUserPermissions();
  const allowed = perms.some((p) =>
    [
      "settings.brand.update",
      "manage_tenants",
      "manage_security",
    ].includes(p)
  );

  if (!allowed) {
    throw new Error("FORBIDDEN_INSUFFICIENT_PERMISSIONS");
  }

  const titleText = input.titleText.trim();
  const footerText = input.footerText.trim();

  await prisma.brandSettings.upsert({
    where: { tenantId },
    update: {
      titleText,
      footerText,
      logoLightUrl: input.logoLightUrl ?? null,
      logoDarkUrl: input.logoDarkUrl ?? null,
      faviconUrl: input.faviconUrl ?? null,
      sidebarIconUrl: input.sidebarIconUrl ?? null,
    },
    create: {
      tenantId,
      titleText,
      footerText,
      logoLightUrl: input.logoLightUrl ?? null,
      logoDarkUrl: input.logoDarkUrl ?? null,
      faviconUrl: input.faviconUrl ?? null,
      sidebarIconUrl: input.sidebarIconUrl ?? null,
    },
  });

  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* COMPANY SETTINGS                                                   */
/* ------------------------------------------------------------------ */

export type UpdateCompanySettingsInput = {
  companyName: string;
  legalName?: string;
  email?: string;
  phone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  taxId?: string;
  registrationNumber?: string;
};

export async function updateCompanySettingsAction(
  input: UpdateCompanySettingsInput
) {
  const { user } = await getCurrentSession();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  const { tenant } = await getTenantAndUser();
  const tenantId = tenant?.id ?? null;

  const perms = await getCurrentUserPermissions();
  const allowed = perms.some((p) =>
    [
      "settings.company.update",
      "manage_tenants",
      "manage_security",
    ].includes(p)
  );

  if (!allowed) {
    throw new Error("FORBIDDEN_INSUFFICIENT_PERMISSIONS");
  }

  const companyName = input.companyName.trim();
  if (!companyName) {
    throw new Error("COMPANY_NAME_REQUIRED");
  }

  await prisma.companySettings.upsert({
    where: { tenantId },
    update: {
      companyName,
      legalName: input.legalName?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      website: input.website?.trim() || null,
      addressLine1: input.addressLine1?.trim() || null,
      addressLine2: input.addressLine2?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      country: input.country?.trim() || null,
      taxId: input.taxId?.trim() || null,
      registrationNumber: input.registrationNumber?.trim() || null,
    },
    create: {
      tenantId,
      companyName,
      legalName: input.legalName?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      website: input.website?.trim() || null,
      addressLine1: input.addressLine1?.trim() || null,
      addressLine2: input.addressLine2?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      country: input.country?.trim() || null,
      taxId: input.taxId?.trim() || null,
      registrationNumber: input.registrationNumber?.trim() || null,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

/* ------------------------------------------------------------------ */
/* EMAIL SETTINGS (RESEND / SMTP)                                     */
/* ------------------------------------------------------------------ */

export type UpdateEmailSettingsInput = {
  provider: "RESEND" | "SMTP";
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpSecurity?: "tls" | "ssl" | "none";
};

export async function updateEmailSettingsAction(
  input: UpdateEmailSettingsInput
) {
  const { user } = await getCurrentSession();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  const { tenant } = await getTenantAndUser();
  const tenantId = tenant?.id ?? null;

  const perms = await getCurrentUserPermissions();
  const allowed = perms.some((p) =>
    [
      "settings.email.update",
      "manage_tenants",
      "manage_security",
    ].includes(p)
  );

  if (!allowed) {
    throw new Error("FORBIDDEN_INSUFFICIENT_PERMISSIONS");
  }

  const provider = input.provider === "SMTP" ? "SMTP" : "RESEND";

  const fromName = input.fromName.trim();
  const fromEmail = input.fromEmail.trim();
  const replyToEmail = input.replyToEmail?.trim() || null;

  if (!fromName) {
    throw new Error("EMAIL_FROM_NAME_REQUIRED");
  }

  if (!fromEmail) {
    throw new Error("EMAIL_FROM_ADDRESS_REQUIRED");
  }

  // Only persist SMTP fields when provider = SMTP
  const smtpHost =
    provider === "SMTP" ? input.smtpHost?.trim() || null : null;
  const smtpPort =
    provider === "SMTP" && input.smtpPort ? input.smtpPort : null;
  const smtpUser =
    provider === "SMTP" ? input.smtpUser?.trim() || null : null;
  const smtpSecurity =
    provider === "SMTP"
      ? input.smtpSecurity ?? "tls"
      : null;

  await prisma.emailSettings.upsert({
    where: { tenantId },
    update: {
      provider,
      fromName,
      fromEmail,
      replyToEmail,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpSecurity,
    },
    create: {
      tenantId,
      provider,
      fromName,
      fromEmail,
      replyToEmail,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpSecurity,
    },
  });

  revalidatePath("/settings");
}