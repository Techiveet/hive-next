"use server";

import {
  UserAccountEmail,
  getUserAccountSubject,
} from "@/emails/user-account-template";

import React from "react";
import { getCurrentSession } from "@/lib/auth-server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { sendEmail } from "@/lib/send-email";
import { userSchema } from "@/lib/validations/security";

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

/* --- Authorization Helper --- */
async function authorizeUserAction(tenantId: string | null | undefined) {
  const { user } = await getCurrentSession();
  if (!user?.id) throw new Error("UNAUTHORIZED");

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
    if (!isCentral) throw new Error("FORBIDDEN_CENTRAL_ACCESS");
  }

  return { actorId: user.id };
}

/* --- Action 1: Create or Update User --- */
export async function createOrUpdateUserAction(rawData: unknown) {
  // 1. Validation
  const result = userSchema.safeParse(rawData);
  if (!result.success) {
    throw new Error(result.error.issues[0].message);
  }
  const input = result.data;

  // 2. Auth Guard
  await authorizeUserAction(input.tenantId ?? null);

  const plainPassword = input.password || undefined;
  const hashedPassword = input.password ? await hash(input.password, 10) : null;

  // 3. Verify Role belongs to Context
  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw new Error("ROLE_NOT_FOUND");
  if (input.tenantId && role.tenantId !== input.tenantId)
    throw new Error("ROLE_TENANT_MISMATCH");
  if (!input.tenantId && role.scope !== "CENTRAL")
    throw new Error("ROLE_SCOPE_MISMATCH");

    const { tenantName, tenantDomain, loginUrl } = await getTenantMeta(
    input.tenantId
  );

  // 4. Email uniqueness
  const existingByEmail = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existingByEmail && existingByEmail.id !== input.id) {
    throw new Error("EMAIL_IN_USE");
  }

  let user;
  let changedName = false;
  let changedPassword = false;
  let changedRole = false;

  if (input.id) {
    // ---------- UPDATE ----------
    const existing = await prisma.user.findUnique({
      where: { id: input.id },
      include: { userRoles: true },
    });
    if (!existing) throw new Error("USER_NOT_FOUND");

    // name
    changedName = existing.name !== input.name;

    // role
    let previousRoleForContext = existing.userRoles.find((ur) =>
      input.tenantId ? ur.tenantId === input.tenantId : ur.tenantId === null
    );
    changedRole =
      !!previousRoleForContext &&
      previousRoleForContext.roleId !== input.roleId;

    // password
    changedPassword = !!hashedPassword;

    // Update user basic fields
    user = await prisma.user.update({
      where: { id: input.id },
      data: {
        name: input.name,
        // if you later allow email update:
        // email: input.email,
      },
    });

    // Password change
    if (hashedPassword) {
      await prisma.account.deleteMany({
        where: { userId: user.id, providerId: "password" },
      });

      await prisma.account.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          accountId: input.email,
          providerId: "password",
          password: hashedPassword,
        },
      });
    }
  } else {
    // ---------- CREATE ----------
    if (!hashedPassword) throw new Error("PASSWORD_REQUIRED_FOR_NEW_USER");

    user = await prisma.user.create({
      data: {
        id: randomUUID(),
        name: input.name,
        email: input.email,
        isActive: true,
        accounts: {
          create: {
            id: randomUUID(),
            accountId: input.email,
            providerId: "password",
            password: hashedPassword,
          },
        },
      },
    });

    // when creating, treat everything as "set", but email template doesn't
    // use the changed* flags for created anyway
    changedName = false;
    changedPassword = false;
    changedRole = false;
  }

  // 5. Link Tenant & Role
  if (input.tenantId) {
    // tenant context
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
      data: { userId: user.id, roleId: input.roleId, tenantId: input.tenantId },
    });
  } else {
    // central context
    await prisma.userRole.deleteMany({
      where: { userId: user.id, tenantId: null },
    });

    await prisma.userRole.create({
      data: { userId: user.id, roleId: input.roleId, tenantId: null },
    });
  }

  // for update, if we changed the role link, mark changedRole true
  if (input.id && !changedRole) {
    // double-check after relink if you prefer, but usually above is enough
  }

  // 6. Send Email
  const status = user.isActive ? "ACTIVE" : "INACTIVE";
  const kind = input.id ? ("updated" as const) : ("created" as const);

  // Only include password in the email when we actually want to show it:
  // - on create
  // - on password change
  const passwordForEmail =
    kind === "created" || changedPassword ? plainPassword : undefined;

  await sendEmail({
    to: user.email,
    subject: getUserAccountSubject(kind),
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
      loginUrl,
    }),
  });
}

/* --- Action 2: Delete User --- */
export async function deleteUserAction(input: {
  userId: string;
  tenantId?: string | null;
}) {
  const { actorId } = await authorizeUserAction(input.tenantId ?? null);

  if (input.userId === actorId) {
    throw new Error("CANNOT_DELETE_SELF");
  }

  if (input.tenantId) {
    const tenantUsersCount = await prisma.userTenant.count({
      where: { tenantId: input.tenantId },
    });
    if (tenantUsersCount <= 1) {
      throw new Error("CANNOT_DELETE_LAST_USER");
    }

    await prisma.userTenant.delete({
      where: {
        userId_tenantId: {
          userId: input.userId,
          tenantId: input.tenantId,
        },
      },
    });
    await prisma.userRole.deleteMany({
      where: { userId: input.userId, tenantId: input.tenantId },
    });
  } else {
    await prisma.user.delete({ where: { id: input.userId } });
  }
}

/* --- Action 3: Toggle Active Status --- */
export async function toggleUserActiveAction(input: {
  userId: string;
  newActive: boolean;
  tenantId?: string | null;
}) {
  const { actorId } = await authorizeUserAction(input.tenantId ?? null);

  if (input.userId === actorId) {
    throw new Error("CANNOT_DEACTIVATE_SELF");
  }

  const user = await prisma.user.update({
    where: { id: input.userId },
    data: { isActive: input.newActive },
  });

  const status = input.newActive ? "ACTIVE" : "INACTIVE";
  const kind = input.newActive ? ("updated" as const) : ("deactivated" as const);

  // NEW: tenant meta for email
  const { tenantName, tenantDomain, loginUrl } = await getTenantMeta(
    input.tenantId
  );

  await sendEmail({
    to: user.email,
    subject: getUserAccountSubject(kind, tenantName),
    react: React.createElement(UserAccountEmail, {
      kind,
      name: user.name || user.email,
      email: user.email,
      status,
      // NEW
      tenantName,
      tenantDomain,
      loginUrl,
    }),
  });
}
