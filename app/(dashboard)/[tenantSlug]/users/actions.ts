// app/(dashboard)/[[tenantSlug]]/users/actions.ts
"use server";

import {
  assertSingleTenantSuperadmin,
  getUserWithRoles,
  isTenantSuperadmin,
} from "@/lib/rbac";

import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendAccountEmail } from "@/lib/email";

type TenantUserFormInput = {
  name: string;
  email: string;
  tempPassword?: string;
  makeTenantSuperadmin?: boolean;
};

function ensureTenantSuperadmin(
  user: Awaited<ReturnType<typeof getUserWithRoles>> | null,
  tenantId: string
) {
  if (!user || !isTenantSuperadmin(user, tenantId)) {
    throw new Error("Only the tenant superadmin can manage tenant accounts.");
  }
}

export async function createTenantUser(data: TenantUserFormInput) {
  const { user: currentUser, tenant } = await getTenantAndUser();
  const current = await getUserWithRoles(currentUser.id);
  ensureTenantSuperadmin(current, tenant.id);

  let user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        name: data.name,
        email: data.email,
        emailVerified: false,
        isActive: true,
      },
    });
  }

  // Ensure membership to this tenant
  await prisma.userTenant.upsert({
    where: {
      userId_tenantId: {
        userId: user.id,
        tenantId: tenant.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      tenantId: tenant.id,
      isOwner: false,
    },
  });

  // Assign tenant_superadmin if requested
  if (data.makeTenantSuperadmin) {
    const role = await prisma.role.findFirst({
      where: { key: "tenant_superadmin", tenantId: tenant.id },
    });
    if (!role) throw new Error("tenant_superadmin role missing");

    await assertSingleTenantSuperadmin(user.id, tenant.id);

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
        tenantId: tenant.id,
      },
    });
  }

  await sendAccountEmail({
    to: user.email,
    type: "account_created",
    payload: {
      name: user.name,
      email: user.email,
      tempPassword: data.tempPassword,
    },
  });

  revalidatePath(`/tenants/${tenant.slug}/users`);
  return { ok: true, userId: user.id };
}

export async function updateTenantUser(
  userId: string,
  data: Partial<TenantUserFormInput>
) {
  const { user: currentUser, tenant } = await getTenantAndUser();
  const current = await getUserWithRoles(currentUser.id);
  ensureTenantSuperadmin(current, tenant.id);

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      email: data.email,
    },
  });

  // manage tenant_superadmin assignment
  if (typeof data.makeTenantSuperadmin === "boolean") {
    const role = await prisma.role.findFirst({
      where: { key: "tenant_superadmin", tenantId: tenant.id },
    });
    if (!role) throw new Error("tenant_superadmin role missing");

    const existingRole = await prisma.userRole.findFirst({
      where: {
        userId,
        roleId: role.id,
        tenantId: tenant.id,
      },
    });

    if (data.makeTenantSuperadmin && !existingRole) {
      await assertSingleTenantSuperadmin(userId, tenant.id);
      await prisma.userRole.create({
        data: {
          userId,
          roleId: role.id,
          tenantId: tenant.id,
        },
      });
    }

    if (!data.makeTenantSuperadmin && existingRole) {
      await prisma.userRole.deleteMany({
        where: {
          userId,
          roleId: role.id,
          tenantId: tenant.id,
        },
      });
    }
  }

  await sendAccountEmail({
    to: user.email,
    type: "account_updated",
    payload: { name: user.name, email: user.email },
  });

  revalidatePath(`/tenants/${tenant.slug}/users`);
  return { ok: true };
}

export async function toggleTenantUserActive(
  userId: string,
  isActive: boolean
) {
  const { user: currentUser, tenant } = await getTenantAndUser();
  const current = await getUserWithRoles(currentUser.id);
  ensureTenantSuperadmin(current, tenant.id);

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

  revalidatePath(`/tenants/${tenant.slug}/users`);
  return { ok: true };
}
