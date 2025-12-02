// app/(dashboard)/security/users/users-actions.ts
"use server";

import {
  UserAccountEmail,
  getUserAccountSubject,
} from "@/emails/user-account-template";

import React from "react";
import { auth } from "@/lib/auth";
import crypto from "crypto";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/rbac";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/send-email";
import { userSchema } from "@/lib/validations/security";

/* ------------------------------------------------------------------
 * Tenant helpers
 * ------------------------------------------------------------------ */

async function getTenantMeta(tenantId?: string | null) {
  if (!tenantId) {
    return {
      tenantName: undefined as string | undefined,
      tenantDomain: undefined as string | undefined,
      loginUrl: undefined as string | undefined,
    };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { domains: true },
  });

  if (!tenant) {
    return {
      tenantName: undefined,
      tenantDomain: undefined,
      loginUrl: undefined,
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
 * Auth + permission helper
 * ------------------------------------------------------------------ */

async function authorizeUserAction(
  tenantId: string | null | undefined,
  requiredPermissions: string[]
) {
  const { user } = await getCurrentSession();
  if (!user?.id) throw new Error("UNAUTHORIZED");

  // context / membership guard
  if (tenantId) {
    const membership = await prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId } },
    });

    if (!membership) {
      throw new Error("FORBIDDEN_INSUFFICIENT_PERMISSIONS");
    }
  } else {
    const isCentral = await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        tenantId: null,
        role: { key: "central_superadmin" },
      },
    });

    if (!isCentral) {
      throw new Error("FORBIDDEN_CENTRAL_ACCESS");
    }
  }

  // fine-grained permissions
  const perms = await getCurrentUserPermissions(tenantId ?? null);

  const hasRequired = requiredPermissions.some(
    (key) =>
      perms.includes(key) ||
      perms.includes("manage_users") ||
      perms.includes("manage_security")
  );

  if (!hasRequired) {
    throw new Error("FORBIDDEN_INSUFFICIENT_PERMISSIONS");
  }

  return { actorId: user.id };
}

/* ------------------------------------------------------------------
 * Password-setup token helpers (our own table)
 * ------------------------------------------------------------------ */

function generatePasswordSetupToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h
  return { token, expiresAt };
}

async function issuePasswordSetupToken(userId: string) {
  const { token, expiresAt } = generatePasswordSetupToken();

  await prisma.passwordSetupToken.deleteMany({
    where: { userId },
  });

  await prisma.passwordSetupToken.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/* ------------------------------------------------------------------
 * Shared password-change helper
 * ------------------------------------------------------------------ */

/**
 * Change a user's password via Better Auth.
 * Used both from the users actions (edit user) and from /api/setup-password.
 */
export async function changeUserPasswordInternal(
  userId: string,
  newPassword: string
) {
  const res = await auth.api.changePassword({
    body: {
      userId,
      newPassword,
    },
    asResponse: false,
  });

  if (res?.error) {
    console.error("[changeUserPasswordInternal] error", res.error);
    throw new Error("CHANGE_PASSWORD_FAILED");
  }
}

/* ------------------------------------------------------------------
 * CREATE / UPDATE USER
 * ------------------------------------------------------------------ */

export async function createOrUpdateUserAction(rawData: unknown) {
  const parsed = userSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "INVALID_INPUT");
  }
  const input = parsed.data;

  await authorizeUserAction(
    input.tenantId ?? null,
    input.id ? ["users.update"] : ["users.create"]
  );

  // Role validation
  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw new Error("ROLE_NOT_FOUND");

  if (input.tenantId && role.tenantId !== input.tenantId) {
    throw new Error("ROLE_TENANT_MISMATCH");
  }
  if (!input.tenantId && role.scope !== "CENTRAL") {
    throw new Error("ROLE_SCOPE_MISMATCH");
  }

  // Enforce unique central / tenant superadmin user
  if (role.key === "central_superadmin" && role.tenantId === null) {
    const existingHolder = await prisma.userRole.findFirst({
      where: {
        roleId: role.id,
        tenantId: null,
        ...(input.id ? { userId: { not: input.id } } : {}),
      },
    });
    if (existingHolder) {
      throw new Error("CENTRAL_SUPERADMIN_ALREADY_ASSIGNED");
    }
  }

  if (role.key === "tenant_superadmin" && role.tenantId) {
    const existingTenantSuper = await prisma.userRole.findFirst({
      where: {
        roleId: role.id,
        tenantId: role.tenantId,
        ...(input.id ? { userId: { not: input.id } } : {}),
      },
    });
    if (existingTenantSuper) {
      throw new Error("TENANT_SUPERADMIN_ALREADY_ASSIGNED");
    }
  }

  const { tenantName, tenantDomain, loginUrl } = await getTenantMeta(
    input.tenantId
  );

  let user;
  let changedName = false;
  let changedPassword = false;
  let changedRole = false;

  const plainPassword = (input.password ?? "").trim();
  const normalizedEmail = input.email.toLowerCase().trim();

  // For brand-new users we send a /setup-password link
  let passwordSetupUrl: string | undefined;

  if (input.id) {
    /* ---------------------- UPDATE USER ---------------------- */
    const existing = await prisma.user.findUnique({
      where: { id: input.id },
      include: { userRoles: true },
    });
    if (!existing) throw new Error("USER_NOT_FOUND");

    changedName = existing.name !== input.name;

    user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        avatarUrl: input.avatarUrl ?? null,
        image: input.avatarUrl ?? existing.image ?? null,
      },
    });

    const existingRoleForContext = existing.userRoles.find((ur) =>
      input.tenantId ? ur.tenantId === input.tenantId : ur.tenantId === null
    );
    changedRole = existingRoleForContext?.roleId !== input.roleId;

    if (plainPassword) {
      await changeUserPasswordInternal(existing.id, plainPassword);
      changedPassword = true;
    }
  } else {
    /* ---------------------- CREATE USER ---------------------- */
    if (!plainPassword) throw new Error("PASSWORD_REQUIRED_FOR_NEW_USER");

    const existingEmail = await prisma.user.findFirst({
      where: { email: normalizedEmail },
    });
    if (existingEmail) throw new Error("EMAIL_IN_USE");

    // Better Auth creates the account with the initial password
    const signUpResult = await auth.api.signUpEmail({
      body: {
        email: normalizedEmail,
        password: plainPassword,
        name: input.name,
      },
      asResponse: false,
      headers: await headers(),
    });

    if (!signUpResult?.user) {
      throw new Error("FAILED_TO_CREATE_USER_AUTH");
    }

    user = await prisma.user.update({
      where: { id: signUpResult.user.id },
      data: {
        name: input.name,
        email: normalizedEmail,
        emailVerified: true,
        isActive: true,
        avatarUrl: input.avatarUrl ?? null,
        image: input.avatarUrl ?? null,
      },
    });

    changedPassword = true;

    // 🔐 Issue our own password-setup token & build URL
    const { token } = await issuePasswordSetupToken(user.id);

    const baseAppUrl =
      loginUrl ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "http://localhost:3000";

    passwordSetupUrl = `${baseAppUrl.replace(
      /\/+$/,
      ""
    )}/setup-password?token=${encodeURIComponent(token)}`;
  }

  /* ----------------------------------------------------------------
   * Link tenant + role (one active role per context)
   * ---------------------------------------------------------------- */
  if (input.tenantId) {
    await prisma.userTenant.upsert({
      where: {
        userId_tenantId: { userId: user.id, tenantId: input.tenantId },
      },
      create: { userId: user.id, tenantId: input.tenantId },
      update: {},
    });

    await prisma.userRole.deleteMany({
      where: { userId: user.id, tenantId: input.tenantId },
    });

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: input.roleId,
        tenantId: input.tenantId,
      },
    });
  } else {
    await prisma.userRole.deleteMany({
      where: { userId: user.id, tenantId: null },
    });

    await prisma.userRole.create({
      data: { userId: user.id, roleId: input.roleId, tenantId: null },
    });
  }

  /* ----------------------------------------------------------------
   * Email notification
   * ---------------------------------------------------------------- */
  const status = user.isActive ? "ACTIVE" : "INACTIVE";
  const kind = input.id ? ("updated" as const) : ("created" as const);

  // No raw password in email; new users get the setup link
  const passwordForEmail = undefined;

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
      changedRole: kind === "updated" ? changedRole : undefined,
      tenantName,
      tenantDomain,
      // For brand-new users, button → /setup-password?token=...
      loginUrl: passwordSetupUrl ?? loginUrl,
    }),
  });
}

/* ------------------------------------------------------------------
 * DELETE USER
 * ------------------------------------------------------------------ */

export async function deleteUserAction(input: {
  userId: string;
  tenantId?: string | null;
}) {
  const tenantId = input.tenantId ?? null;
  const { actorId } = await authorizeUserAction(tenantId, ["users.delete"]);

  if (input.userId === actorId) throw new Error("CANNOT_DELETE_SELF");

  if (!tenantId) {
    // central: protect last central_superadmin
    const centralRole = await prisma.role.findFirst({
      where: { key: "central_superadmin", tenantId: null },
    });

    if (centralRole) {
      const isTargetCentralSuper = await prisma.userRole.findFirst({
        where: {
          userId: input.userId,
          roleId: centralRole.id,
          tenantId: null,
        },
      });
      if (isTargetCentralSuper) {
        const count = await prisma.userRole.count({
          where: { roleId: centralRole.id, tenantId: null },
        });
        if (count <= 1) throw new Error("CANNOT_DELETE_LAST_USER");
      }
    }

    await prisma.user.delete({ where: { id: input.userId } });
    return;
  }

  const tenantUsersCount = await prisma.userTenant.count({
    where: { tenantId },
  });
  if (tenantUsersCount <= 1) throw new Error("CANNOT_DELETE_LAST_USER");

  await prisma.userTenant.delete({
    where: { userId_tenantId: { userId: input.userId, tenantId } },
  });
  await prisma.userRole.deleteMany({
    where: { userId: input.userId, tenantId },
  });

  const remainingMemberships = await prisma.userTenant.count({
    where: { userId: input.userId },
  });
  const remainingCentralRoles = await prisma.userRole.count({
    where: { userId: input.userId, tenantId: null },
  });

  if (remainingMemberships === 0 && remainingCentralRoles === 0) {
    await prisma.user.delete({ where: { id: input.userId } });
  }
}

/* ------------------------------------------------------------------
 * TOGGLE ACTIVE
 * ------------------------------------------------------------------ */

export async function toggleUserActiveAction(input: {
  userId: string;
  newActive: boolean;
  tenantId?: string | null;
}) {
  const tenantId = input.tenantId ?? null;

  const { actorId } = await authorizeUserAction(tenantId, ["users.update"]);

  if (input.userId === actorId && !input.newActive) {
    throw new Error("CANNOT_DEACTIVATE_SELF");
  }

  // protect last central / tenant superadmin
  if (!input.newActive) {
    const roles = await prisma.userRole.findMany({
      where: { userId: input.userId },
      include: { role: true },
    });

    for (const ur of roles) {
      if (ur.role.key === "central_superadmin" && ur.tenantId === null) {
        const count = await prisma.userRole.count({
          where: { roleId: ur.roleId, tenantId: null },
        });
        if (count <= 1) throw new Error("CANNOT_DEACTIVATE_LAST_USER");
      }

      if (ur.role.key === "tenant_superadmin" && ur.tenantId) {
        const count = await prisma.userRole.count({
          where: { roleId: ur.roleId, tenantId: ur.tenantId },
        });
        if (count <= 1) throw new Error("CANNOT_DEACTIVATE_LAST_USER");
      }
    }
  }

  const user = await prisma.user.update({
    where: { id: input.userId },
    data: { isActive: input.newActive },
  });

  const status = input.newActive ? "ACTIVE" : "INACTIVE";
  const kind = input.newActive
    ? ("updated" as const)
    : ("deactivated" as const);

  const { tenantName, tenantDomain, loginUrl } = await getTenantMeta(tenantId);

  await sendEmail({
    to: user.email,
    subject: getUserAccountSubject(kind, tenantName),
    react: React.createElement(UserAccountEmail, {
      kind,
      name: user.name || user.email,
      email: user.email,
      status,
      tenantName,
      tenantDomain,
      loginUrl,
    }),
  });
}
