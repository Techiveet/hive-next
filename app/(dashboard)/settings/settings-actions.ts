// app/(dashboard)/settings/settings-actions.ts
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
    ["manage_tenants", "manage_security", "manage_users", "manage_roles"].includes(
      p
    )
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
/* BRAND SETTINGS (LOGOS + TEXT)                                      */
/* ------------------------------------------------------------------ */

export type UpdateBrandSettingsInput = {
  titleText: string;
  footerText: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
  faviconUrl?: string;
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
    ["manage_tenants", "manage_security", "manage_users", "manage_roles"].includes(
      p
    )
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
    },
    create: {
      tenantId,
      titleText,
      footerText,
      logoLightUrl: input.logoLightUrl ?? null,
      logoDarkUrl: input.logoDarkUrl ?? null,
      faviconUrl: input.faviconUrl ?? null,
    },
  });

  // ✅ FIX: Revalidate the Layout so the Sidebar updates immediately
  revalidatePath("/", "layout"); 

}
