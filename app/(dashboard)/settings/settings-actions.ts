// app/(dashboard)/settings/settings-actions.ts
"use server";

import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/permissions";
import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/* ------------------------------------------------------------------ */
/* HELPERS                                                            */
/* ------------------------------------------------------------------ */

function normalizeSlug(raw: string) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidEmail(email: string) {
  // simple + safe enough (avoid over-engineering)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function requireAuth() {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

async function requireTenant() {
  const { tenant } = await getTenantAndUser();
  if (!tenant) throw new Error("NO_ACTIVE_TENANT");
  return tenant;
}

async function requireAnyPermission(allowed: string[]) {
  const perms = await getCurrentUserPermissions();
  const ok = perms.some((p) => allowed.includes(p));
  if (!ok) throw new Error("FORBIDDEN_INSUFFICIENT_PERMISSIONS");
  return perms;
}

function revalidateSettingsAndLayout() {
  revalidatePath("/settings");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* PROFILE                                                            */
/* ------------------------------------------------------------------ */

export type UpdateProfileInput = {
  name: string;
};

export async function updateProfileAction(input: UpdateProfileInput) {
  const user = await requireAuth();

  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("NAME_REQUIRED");

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

export async function updateTenantSettingsAction(input: UpdateTenantSettingsInput) {
  await requireAuth();
  const tenant = await requireTenant();

  await requireAnyPermission([
    "manage_tenants",
    "manage_security",
    "settings.localization.update",
    "settings.company.update",
  ]);

  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("TENANT_NAME_REQUIRED");

  const fallbackSlug = normalizeSlug(name);
  const normalizedSlug = normalizeSlug(input.slug) || fallbackSlug;
  if (!normalizedSlug) throw new Error("TENANT_SLUG_REQUIRED");

  const domain = String(input.domain ?? "").trim() || undefined;

  const existingSlug = await prisma.tenant.findFirst({
    where: { slug: normalizedSlug, id: { not: tenant.id } },
    select: { id: true },
  });
  if (existingSlug) throw new Error("TENANT_SLUG_IN_USE");

  if (domain) {
    // optional but useful: avoid two tenants sharing the same domain
    const domainTaken = await prisma.tenantDomain.findFirst({
      where: { domain, tenantId: { not: tenant.id } },
      select: { id: true },
    });
    if (domainTaken) throw new Error("TENANT_DOMAIN_IN_USE");
  }

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: tenant.id },
      data: { name, slug: normalizedSlug },
    });

    await tx.tenantDomain.deleteMany({ where: { tenantId: tenant.id } });

    if (domain) {
      await tx.tenantDomain.create({
        data: { tenantId: tenant.id, domain },
      });
    }
  });

  revalidatePath("/settings");
  revalidatePath("/tenants");
}

/* ------------------------------------------------------------------ */
/* APP / SYSTEM CONFIGURATION                                         */
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
  await requireAuth();
  const { tenant } = await getTenantAndUser();
  const tenantId = tenant?.id ?? null;

  await requireAnyPermission(["manage_tenants", "manage_security", "settings.system.update"]);

  const weekStartsOn = Number(input.weekStartsOn);
  if (!Number.isFinite(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
    throw new Error("WEEK_STARTS_ON_INVALID");
  }

  const sessionTimeout = Number(input.sessionTimeout);
  if (!Number.isFinite(sessionTimeout) || sessionTimeout < 1) {
    throw new Error("SESSION_TIMEOUT_INVALID");
  }

  await prisma.appSettings.upsert({
    where: { tenantId },
    update: {
      timezone: String(input.timezone ?? "").trim(),
      locale: String(input.locale ?? "").trim(),
      dateFormat: String(input.dateFormat ?? "").trim(),
      timeFormat: String(input.timeFormat ?? "").trim(),
      weekStartsOn,
      defaultTheme: input.defaultTheme,
      allowUserThemeOverride: !!input.allowUserThemeOverride,
      enforceTwoFactor: !!input.enforceTwoFactor,
      sessionTimeout,
    },
    create: {
      tenantId,
      timezone: String(input.timezone ?? "").trim(),
      locale: String(input.locale ?? "").trim(),
      dateFormat: String(input.dateFormat ?? "").trim(),
      timeFormat: String(input.timeFormat ?? "").trim(),
      weekStartsOn,
      defaultTheme: input.defaultTheme,
      allowUserThemeOverride: !!input.allowUserThemeOverride,
      enforceTwoFactor: !!input.enforceTwoFactor,
      sessionTimeout,
    },
  });

  revalidateSettingsAndLayout();
}

/* ------------------------------------------------------------------ */
/* BRAND SETTINGS                                                     */
/* ------------------------------------------------------------------ */

export type UpdateBrandSettingsInput = {
  titleText: string;
  footerText: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
  faviconUrl?: string;
  sidebarIconUrl?: string;
};

export async function updateBrandSettingsAction(input: UpdateBrandSettingsInput) {
  await requireAuth();
  const { tenant } = await getTenantAndUser();
  const tenantId = tenant?.id ?? null;

  await requireAnyPermission(["settings.brand.update", "manage_tenants", "manage_security"]);

  const titleText = String(input.titleText ?? "").trim();
  const footerText = String(input.footerText ?? "").trim();

  if (!titleText) throw new Error("BRAND_TITLE_REQUIRED");

  await prisma.brandSettings.upsert({
    where: { tenantId },
    update: {
      titleText,
      footerText,
      logoLightUrl: input.logoLightUrl?.trim() || null,
      logoDarkUrl: input.logoDarkUrl?.trim() || null,
      faviconUrl: input.faviconUrl?.trim() || null,
      sidebarIconUrl: input.sidebarIconUrl?.trim() || null,
    },
    create: {
      tenantId,
      titleText,
      footerText,
      logoLightUrl: input.logoLightUrl?.trim() || null,
      logoDarkUrl: input.logoDarkUrl?.trim() || null,
      faviconUrl: input.faviconUrl?.trim() || null,
      sidebarIconUrl: input.sidebarIconUrl?.trim() || null,
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

export async function updateCompanySettingsAction(input: UpdateCompanySettingsInput) {
  await requireAuth();
  const { tenant } = await getTenantAndUser();
  const tenantId = tenant?.id ?? null;

  await requireAnyPermission(["settings.company.update", "manage_tenants", "manage_security"]);

  const companyName = String(input.companyName ?? "").trim();
  if (!companyName) throw new Error("COMPANY_NAME_REQUIRED");

  const email = input.email?.trim() || null;
  if (email && !isValidEmail(email)) throw new Error("COMPANY_EMAIL_INVALID");

  await prisma.companySettings.upsert({
    where: { tenantId },
    update: {
      companyName,
      legalName: input.legalName?.trim() || null,
      email,
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
      email,
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
/* EMAIL SETTINGS                                                     */
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

export async function updateEmailSettingsAction(input: UpdateEmailSettingsInput) {
  await requireAuth();
  const { tenant } = await getTenantAndUser();
  const tenantId = tenant?.id ?? null;

  await requireAnyPermission(["settings.email.update", "manage_tenants", "manage_security"]);

  const provider: "RESEND" | "SMTP" = input.provider === "SMTP" ? "SMTP" : "RESEND";

  const fromName = String(input.fromName ?? "").trim();
  const fromEmail = String(input.fromEmail ?? "").trim();
  const replyToEmail = String(input.replyToEmail ?? "").trim() || null;

  if (!fromName) throw new Error("EMAIL_FROM_NAME_REQUIRED");
  if (!fromEmail) throw new Error("EMAIL_FROM_ADDRESS_REQUIRED");
  if (!isValidEmail(fromEmail)) throw new Error("EMAIL_FROM_ADDRESS_INVALID");
  if (replyToEmail && !isValidEmail(replyToEmail)) throw new Error("EMAIL_REPLY_TO_INVALID");

  let smtpHost: string | null = null;
  let smtpPort: number | null = null;
  let smtpUser: string | null = null;
  let smtpSecurity: "tls" | "ssl" | "none" | null = null;

  if (provider === "SMTP") {
    smtpHost = String(input.smtpHost ?? "").trim() || null;
    smtpUser = String(input.smtpUser ?? "").trim() || null;
    smtpSecurity = input.smtpSecurity ?? "tls";

    if (!smtpHost) throw new Error("SMTP_HOST_REQUIRED");

    if (input.smtpPort != null) {
      const port = Number(input.smtpPort);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("SMTP_PORT_INVALID");
      }
      smtpPort = port;
    } else {
      smtpPort = null;
    }
  }

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

/* ------------------------------------------------------------------ */
/* TOUR SETTINGS (CENTRAL ADMIN ONLY)                                 */
/* ------------------------------------------------------------------ */

type TourRect = { x?: number; y?: number; width?: number; height?: number };

export type TourStepInput = {
  id?: string;
  selector: string;
  title: string;
  body: string;
  placement?: string;
  padding?: number;
  rect?: TourRect;
  onlyPathPrefix?: string;
};

export type UpsertTourConfigInput = {
  targetTenantId: string | null; // null = global default
  tourKey: string;
  version: number;
  isEnabled: boolean;
  name?: string;
  steps: TourStepInput[];
};

async function assertCentralAdminOrThrow() {
  await requireAuth();

  const { tenant } = await getTenantAndUser();
  const isCentral = !tenant || tenant.slug === "central-hive";
  if (!isCentral) throw new Error("FORBIDDEN_CENTRAL_ONLY");

  await requireAnyPermission([
    "manage_settings",
    "manage_tenants",
    "manage_security",
    "settings.tour.update",
  ]);
}

function sanitizeSteps(steps: TourStepInput[]) {
  if (!Array.isArray(steps) || steps.length === 0) throw new Error("TOUR_STEPS_REQUIRED");

  return steps.map((s) => {
    const selector = String(s.selector ?? "").trim();
    const title = String(s.title ?? "").trim();
    const body = String(s.body ?? "").trim();
    if (!selector) throw new Error("TOUR_STEP_SELECTOR_REQUIRED");
    if (!title) throw new Error("TOUR_STEP_TITLE_REQUIRED");
    if (!body) throw new Error("TOUR_STEP_BODY_REQUIRED");

    const placement = String(s.placement ?? "right").trim() || "right";
    const padding =
      typeof s.padding === "number" && Number.isFinite(s.padding) ? Math.round(s.padding) : null;

    const rect = s.rect ?? {};
    const rectX = typeof rect.x === "number" && Number.isFinite(rect.x) ? Math.round(rect.x) : null;
    const rectY = typeof rect.y === "number" && Number.isFinite(rect.y) ? Math.round(rect.y) : null;
    const rectWidth =
      typeof rect.width === "number" && Number.isFinite(rect.width) ? Math.round(rect.width) : null;
    const rectHeight =
      typeof rect.height === "number" && Number.isFinite(rect.height)
        ? Math.round(rect.height)
        : null;

    const onlyPathPrefix = s.onlyPathPrefix ? String(s.onlyPathPrefix).trim() || null : null;

    return { selector, title, body, placement, padding, rectX, rectY, rectWidth, rectHeight, onlyPathPrefix };
  });
}

function prettifyKey(key: string) {
  return String(key ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
}

export async function upsertTourConfigAction(input: UpsertTourConfigInput) {
  await assertCentralAdminOrThrow();

  const tourKey = String(input.tourKey ?? "").trim();
  if (!tourKey) throw new Error("TOUR_KEY_REQUIRED");

  const version = Number(input.version);
  if (!Number.isFinite(version) || version < 1) throw new Error("TOUR_VERSION_INVALID");

  const tenantId = input.targetTenantId ?? null;
  const tenantKey = tenantId ?? "GLOBAL";
  const isActive = !!input.isEnabled;

  const steps = sanitizeSteps(input.steps);
  const name = (String(input.name ?? "").trim() || prettifyKey(tourKey)).slice(0, 191);

  await prisma.$transaction(async (tx) => {
    const tour = await tx.tour.upsert({
      where: { tenantKey_key: { tenantKey, key: tourKey } },
      update: { name, isActive, version, tenantId },
      create: { tenantId, tenantKey, key: tourKey, name, isActive, version },
      select: { id: true },
    });

    await tx.tourStep.deleteMany({ where: { tourId: tour.id } });

    await tx.tourStep.createMany({
      data: steps.map((s, order) => ({
        tourId: tour.id,
        order,
        selector: s.selector,
        title: s.title,
        body: s.body,
        placement: s.placement,
        padding: s.padding,
        rectX: s.rectX,
        rectY: s.rectY,
        rectWidth: s.rectWidth,
        rectHeight: s.rectHeight,
        onlyPathPrefix: s.onlyPathPrefix,
      })),
    });
  });

  revalidateSettingsAndLayout();
}

export async function deleteTourConfigAction(input: { targetTenantId: string | null; tourKey: string }) {
  await assertCentralAdminOrThrow();

  const tenantId = input.targetTenantId ?? null;
  const tenantKey = tenantId ?? "GLOBAL";

  const tourKey = String(input.tourKey ?? "").trim();
  if (!tourKey) throw new Error("TOUR_KEY_REQUIRED");

  const existing = await prisma.tour.findFirst({
    where: { tenantKey, key: tourKey },
    select: { id: true },
  });
  if (!existing) return;

  await prisma.tour.delete({ where: { id: existing.id } });

  revalidateSettingsAndLayout();
}

/* ------------------------------------------------------------------ */
/* LIST TOUR CONFIGS FOR SETTINGS UI                                  */
/* ------------------------------------------------------------------ */

export type TourConfigDto = {
  tenantId: string | null;
  tenantKey: string; // "GLOBAL" or tenantId
  tourKey: string;
  name: string;
  version: number;
  isEnabled: boolean;
  updatedAt: string;
  steps: TourStepInput[];
};

export async function listTourConfigsAction(): Promise<TourConfigDto[]> {
  await assertCentralAdminOrThrow();

  // If your Prisma relation name isn't "steps", change include.steps accordingly.
  const tours = await prisma.tour.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      steps: { orderBy: { order: "asc" } },
    },
  });

  return tours.map((t: any) => ({
    tenantId: t.tenantId ?? null,
    tenantKey: t.tenantKey,
    tourKey: t.key,
    name: t.name,
    version: t.version,
    isEnabled: !!t.isActive,
    updatedAt: new Date(t.updatedAt).toISOString(),
    steps: (t.steps ?? []).map((s: any) => ({
      selector: s.selector,
      title: s.title,
      body: s.body,
      placement: s.placement ?? "right",
      padding: s.padding ?? undefined,
      rect:
        s.rectX != null || s.rectY != null || s.rectWidth != null || s.rectHeight != null
          ? {
              x: s.rectX ?? undefined,
              y: s.rectY ?? undefined,
              width: s.rectWidth ?? undefined,
              height: s.rectHeight ?? undefined,
            }
          : undefined,
      onlyPathPrefix: s.onlyPathPrefix ?? undefined,
    })),
  }));
}
