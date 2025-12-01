"use server";

import {
  assertSingleCentralSuperadmin,
  getUserWithRoles,
  isCentralSuperadmin,
} from "@/lib/rbac";

import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendAccountEmail } from "@/lib/send-email";

type UserFormInput = {
  name: string;
  email: string;
  tempPassword?: string;
  makeCentralSuperadmin?: boolean;
};

function ensureCentralOnly(
  user: Awaited<ReturnType<typeof getUserWithRoles>> | null
) {
  if (!user || !isCentralSuperadmin(user)) {
    throw new Error("Only the central superadmin can manage central accounts.");
  }
}

/**
 * CREATE central-level user (managed only by central superadmin).
 */
export async function createCentralUser(data: UserFormInput) {
  const { user: currentSessionUser } = await getCurrentSession();
  const current = await getUserWithRoles(currentSessionUser?.id ?? "");
  ensureCentralOnly(current);

  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existing) {
    throw new Error("A user with this email already exists.");
  }

  const user = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      emailVerified: false,
      isActive: true,
      // if you use password-based auth, hash tempPassword here
    },
  });

  // Assign central_superadmin if requested
  if (data.makeCentralSuperadmin) {
    const role = await prisma.role.findFirst({
      where: { key: "central_superadmin", tenantId: null },
    });
    if (!role) throw new Error("central_superadmin role missing");

    await assertSingleCentralSuperadmin(user.id);

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
        tenantId: null,
      },
    });
  }

  // Email
  await sendAccountEmail({
    to: user.email,
    type: "account_created",
    payload: {
      name: user.name,
      email: user.email,
      tempPassword: data.tempPassword,
    },
  });

  revalidatePath("/central/admin/users");
  return { ok: true, userId: user.id };
}

/**
 * UPDATE central user (name, email, roles etc.)
 */
export async function updateCentralUser(
  userId: string,
  data: Partial<UserFormInput>
) {
  const { user: currentSessionUser } = await getCurrentSession();
  const current = await getUserWithRoles(currentSessionUser?.id ?? "");
  ensureCentralOnly(current);

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      email: data.email,
    },
  });

  // Reassign central_superadmin if flag changed
  if (typeof data.makeCentralSuperadmin === "boolean") {
    const role = await prisma.role.findFirst({
      where: { key: "central_superadmin", tenantId: null },
    });
    if (!role) throw new Error("central_superadmin role missing");

    const existingRole = await prisma.userRole.findFirst({
      where: {
        userId,
        roleId: role.id,
        tenantId: null,
      },
    });

    if (data.makeCentralSuperadmin && !existingRole) {
      await assertSingleCentralSuperadmin(user.id);
      await prisma.userRole.create({
        data: {
          userId,
          roleId: role.id,
          tenantId: null,
        },
      });
    }

    if (!data.makeCentralSuperadmin && existingRole) {
      // ✅ simpler + type-safe: just use deleteMany with a normal filter
      await prisma.userRole.deleteMany({
        where: {
          roleId: role.id,
          userId,
          tenantId: null,
        },
      });
    }
  }

  await sendAccountEmail({
    to: user.email,
    type: "account_updated",
    payload: { name: user.name, email: user.email },
  });

  revalidatePath("/central/admin/users");
  return { ok: true };
}

/**
 * ENABLE / DISABLE user.
 */
export async function toggleCentralUserActive(
  userId: string,
  isActive: boolean
) {
  const { user: currentSessionUser } = await getCurrentSession();
  const current = await getUserWithRoles(currentSessionUser?.id ?? "");
  ensureCentralOnly(current);

  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  });

  await sendAccountEmail({
    to: user.email,
    type: "account_status_changed",
    payload: {
      name: user.name,
      email: user.email,
      isActive,
    },
  });

  revalidatePath("/central/admin/users");
  return { ok: true };
}
