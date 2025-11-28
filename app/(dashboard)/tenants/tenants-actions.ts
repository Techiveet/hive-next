// app/(dashboard)/tenants/tenants-actions.ts
"use server";

import * as React from "react";

import {
  UserAccountEmail,
  getUserAccountSubject,
} from "@/emails/user-account-template";

import { auth } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/rbac"; // ← make sure this path matches rbac.ts
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/send-email";
import { syncTenantDefaultRolesPermissions } from "@/lib/rbac"; // ← NEW

/* ------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------ */

export type UpsertTenantInput = {
  id?: string | null;
  name: string;
  slug?: string;
  domain?: string;
  isActive: boolean;
};

export type TenantSuperadminInput = {
  tenantId: string;
  name: string;
  email: string;
  password: string;
};

/* ------------------------------------------------------------------
 * Auth helper – central-only manage_tenants / manage_security
 * ------------------------------------------------------------------ */

async function authorizeTenantManagement() {
  const { user } = await getCurrentSession();
  if (!user?.id) {
    throw new Error("UNAUTHORIZED");
  }

  // central context → tenantId = null
  const perms = await getCurrentUserPermissions(null);

  const allowed =
    perms.includes("manage_tenants") ||
    perms.includes("manage_security") ||
    perms.includes("manage_users");

  if (!allowed) {
    throw new Error("FORBIDDEN_INSUFFICIENT_PERMISSIONS");
  }

  return { actorId: user.id };
}

/* ------------------------------------------------------------------
 * Helper to get tenant meta (for emails / links)
 * ------------------------------------------------------------------ */

async function getTenantMeta(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { domains: true },
  });

  if (!tenant) {
    return {
      tenantName: undefined as string | undefined,
      tenantDomain: undefined as string | undefined,
      loginUrl: undefined as string | undefined,
    };
  }

  const primaryDomain = tenant.domains[0]?.domain;
  const loginUrl = primaryDomain
    ? primaryDomain.startsWith("http")
      ? primaryDomain
      : `https://${primaryDomain}`
    : undefined;

  return {
    tenantName: tenant.name,
    tenantDomain: primaryDomain,
    loginUrl,
  };
}

/* ------------------------------------------------------------------
 * CREATE / UPDATE TENANT
 * ------------------------------------------------------------------ */

export async function upsertTenantAction(input: UpsertTenantInput) {
  await authorizeTenantManagement();

  const name = input.name.trim();
  if (!name) throw new Error("TENANT_NAME_REQUIRED");

  let slug =
    (input.slug || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  if (!slug) throw new Error("TENANT_SLUG_REQUIRED");

  const domain = input.domain?.trim() || undefined;

  // slug must be unique
  const existingSlug = await prisma.tenant.findFirst({
    where: {
      slug,
      ...(input.id ? { id: { not: input.id } } : {}),
    },
  });

  if (existingSlug) {
    throw new Error("TENANT_SLUG_IN_USE");
  }

  const tenant = await prisma.$transaction(async (tx) => {
    let t;

    if (input.id) {
      // UPDATE TENANT
      t = await tx.tenant.update({
        where: { id: input.id },
        data: {
          name,
          slug,
          isActive: input.isActive,
        },
      });

      // clear existing domains (1:1 relationship in schema)
      await tx.tenantDomain.deleteMany({
        where: { tenantId: t.id },
      });
    } else {
      // CREATE TENANT
      t = await tx.tenant.create({
        data: {
          name,
          slug,
          isActive: input.isActive,
        },
      });
    }

    // recreate domain if provided
    if (domain) {
      await tx.tenantDomain.create({
        data: {
          tenantId: t.id,
          domain,
        },
      });
    }

    return t;
  });

  return tenant;
}

/* ------------------------------------------------------------------
 * DELETE TENANT
 * ------------------------------------------------------------------ */

export async function deleteTenantAction(input: { tenantId: string }) {
  await authorizeTenantManagement();

  // You can add extra guards here (e.g. cannot delete last tenant)
  await prisma.tenant.delete({
    where: { id: input.tenantId },
  });

  return { ok: true };
}

/* ------------------------------------------------------------------
 * TOGGLE TENANT ACTIVE + EMAIL TENANT SUPERADMINS
 * ------------------------------------------------------------------ */

export async function toggleTenantActiveAction(input: {
  tenantId: string;
  newActive: boolean;
}) {
  await authorizeTenantManagement();

  const { tenantId, newActive } = input;

  // 1) Update tenant
  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { isActive: newActive },
  });

  // 2) Fetch tenant superadmins (users with tenant_superadmin role in this tenant)
  const tenantAdmins = await prisma.user.findMany({
    where: {
      userRoles: {
        some: {
          tenantId,
          role: { key: "tenant_superadmin" },
        },
      },
    },
  });

  if (!tenantAdmins.length) {
    return tenant;
  }

  // 3) Meta for email
  const { tenantName, tenantDomain, loginUrl } = await getTenantMeta(tenantId);
  const status = newActive ? ("ACTIVE" as const) : ("INACTIVE" as const);
  const kind = newActive ? ("updated" as const) : ("deactivated" as const);
  const subject = getUserAccountSubject(kind, tenantName);

  // 4) Notify all tenant superadmins
  await Promise.all(
    tenantAdmins.map((admin) =>
      sendEmail({
        to: admin.email,
        subject,
        react: React.createElement(UserAccountEmail, {
          kind,
          name: admin.name || admin.email,
          email: admin.email,
          status,
          tenantName,
          tenantDomain,
          loginUrl,
        }),
      })
    )
  );

  return tenant;
}
// Give a tenant_superadmin role the standard tenant permissions
async function ensureTenantSuperadminPermissions(tenantId: string, roleId: number) {
  // Use GLOBAL permissions (tenantId = null), same logic as seed.ts:
  const perms = await prisma.permission.findMany({
    where: {
      tenantId: null,
      NOT: { key: "manage_tenants" }, // tenants cannot manage other tenants
    },
    select: { id: true, key: true },
  });

  if (!perms.length) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[ensureTenantSuperadminPermissions] No global perms found for tenant",
        tenantId
      );
    }
    return;
  }

  // Clear existing mapping for this role to avoid duplicates / stale perms
  await prisma.rolePermission.deleteMany({
    where: { roleId },
  });

  await prisma.rolePermission.createMany({
    data: perms.map((p) => ({
      roleId,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(
      "[ensureTenantSuperadminPermissions] Synced tenant_superadmin role",
      { tenantId, roleId, permCount: perms.length }
    );
  }
}

/* ------------------------------------------------------------------
 * UPSERT TENANT SUPERADMIN
 *
 * - creates OR updates the tenant owner superadmin
 * - ensures one tenant_superadmin user per tenant
 * - reuses the tenant_superadmin role that was seeded
 *   (and therefore reuses the common permissions from the seeder)
 * - sends account email on create / update
 * ------------------------------------------------------------------ */

export async function upsertTenantSuperadminAction(
  input: TenantSuperadminInput
) {
  await authorizeTenantManagement();

  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    include: { domains: true },
  });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");

  const { tenantName, tenantDomain, loginUrl } = await getTenantMeta(
    tenant.id
  );

  // -------- ENSURE tenant_superadmin ROLE FOR THIS TENANT --------
  let role = await prisma.role.findFirst({
    where: {
      key: "tenant_superadmin",
      tenantId: tenant.id,
    },
  });

  if (!role) {
    role = await prisma.role.create({
      data: {
        key: "tenant_superadmin",
        name: "Tenant Superadmin",
        scope: "TENANT",
        tenantId: tenant.id,
      },
    });
  }

  // 🔥 NEW: Ensure this role has the standard tenant permissions
  await ensureTenantSuperadminPermissions(tenant.id, role.id);

  const plainPassword = input.password.trim();
  if (!plainPassword) throw new Error("PASSWORD_REQUIRED");

  let user = await prisma.user.findFirst({
    where: { email: input.email.trim() },
  });

  let kind: "created" | "updated" = "created";
  let changedName = false;
  let changedPassword = false;

  if (!user) {
    // -------- CREATE USER THROUGH AUTH --------
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: input.email.trim(),
        password: plainPassword,
        name: input.name.trim(),
      },
      asResponse: false,
      headers: await headers(),
    });

    if (!signUpResult?.user) {
      throw new Error("FAILED_TO_CREATE_USER_AUTH");
    }

    user = await prisma.user.findUnique({
      where: { id: signUpResult.user.id },
    });
    if (!user) throw new Error("USER_CREATED_BUT_NOT_FOUND");

    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        isActive: true,
        name: input.name.trim(),
      },
    });

    kind = "created";
    changedName = true;
    changedPassword = true;
  } else {
    // -------- UPDATE EXISTING USER --------
    kind = "updated";
    changedName = (user.name || "") !== input.name.trim();
    changedPassword = true;

    if (changedName) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: input.name.trim() },
      });
    }

    // reset password in Account table
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash(plainPassword);
    const normalizedEmail = user.email.toLowerCase().trim();

    await prisma.account.deleteMany({
      where: { userId: user.id, providerId: "email" },
    });

    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        accountId: normalizedEmail,
        providerId: "email",
        password: hashedPassword,
      },
    });
  }

  // -------- MEMBERSHIP + ROLE (ONE SUPERADMIN PER TENANT) --------
  await prisma.$transaction(async (tx) => {
    // membership (owner)
    await tx.userTenant.upsert({
      where: {
        userId_tenantId: { userId: user!.id, tenantId: tenant.id },
      },
      create: {
        userId: user!.id,
        tenantId: tenant.id,
        isOwner: true,
      },
      update: {
        isOwner: true,
      },
    });

    // ensure only this user has tenant_superadmin for this tenant
    await tx.userRole.deleteMany({
      where: {
        tenantId: tenant.id,
        roleId: role!.id,
      },
    });

    await tx.userRole.create({
      data: {
        userId: user!.id,
        roleId: role!.id,
        tenantId: tenant.id,
      },
    });
  });

  // -------- EMAIL NOTIFICATION --------
  const status = user.isActive ? "ACTIVE" : "INACTIVE";
  const passwordForEmail =
    kind === "created" || changedPassword ? plainPassword : undefined;

  await sendEmail({
    to: user.email,
    subject: getUserAccountSubject(kind, tenantName),
    react: React.createElement(UserAccountEmail, {
      kind,
      name: user.name || user.email,
      email: user.email,
      status,
      roleName: role.name,
      password: passwordForEmail,
      changedName: kind === "updated" ? changedName : undefined,
      changedPassword: kind === "updated" ? changedPassword : undefined,
      changedRole: undefined,
      tenantName,
      tenantDomain,
      loginUrl,
    }),
  });
}
