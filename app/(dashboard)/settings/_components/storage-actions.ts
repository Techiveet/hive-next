"use server";

import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getStorageSettingsAction() {
  const { tenant } = await getTenantAndUser();
  // Resolve Central Admin ID to null logic if needed, similar to backups
  const tenantId = tenant?.slug === "central-hive" ? null : tenant?.id;

  return await prisma.storageSettings.findFirst({ where: { tenantId } });
}

export async function saveStorageSettingsAction(data: any) {
  const { tenant } = await getTenantAndUser();
  if (tenant && tenant.slug !== "central-hive") throw new Error("Unauthorized");
  
  const tenantId = null; // Central Admin System Storage

  const existing = await prisma.storageSettings.findFirst({ where: { tenantId } });

  if (existing) {
    await prisma.storageSettings.update({
      where: { id: existing.id },
      data
    });
  } else {
    await prisma.storageSettings.create({
      data: { ...data, tenantId }
    });
  }
  revalidatePath("/settings");
}