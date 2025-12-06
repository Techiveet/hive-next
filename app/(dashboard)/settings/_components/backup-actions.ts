"use server";

import { generateBackup } from "@/lib/backup-service";
import { getStorageProvider } from "@/lib/storage-factory";
import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { runBackupCleanup } from "@/lib/backup-cleanup";
import { sendBackupNotification } from "@/lib/backup-notifier";

function resolveTenantId(tenant: { id: string; slug: string } | null) {
  if (!tenant || tenant.slug === "central-hive") return null;
  return tenant.id;
}

/**
 * 1. Fetch Settings
 */
export async function getBackupSettingsAction() {
  const { tenant } = await getTenantAndUser();
  const tenantId = resolveTenantId(tenant);

  const settings = await prisma.backupSettings.findFirst({
    where: { tenantId },
  });

  // include notificationEmail in default
  return (
    settings || {
      enabled: false,
      frequency: "DAILY",
      time: "00:00",
      retention: 7,
      notificationEmail: "",
    }
  );
}

/**
 * 2. Save Settings
 *    – uses the email from the UI (settings.notificationEmail)
 */
export async function saveBackupSettingsAction(settings: any) {
  const { tenant } = await getTenantAndUser();

  if (tenant && tenant.slug !== "central-hive") throw new Error("Unauthorized");

  const tenantId = resolveTenantId(tenant);
  const existing = await prisma.backupSettings.findFirst({ where: { tenantId } });

  const dataToSave = {
    enabled: !!settings.enabled,
    frequency: settings.frequency || "DAILY",
    time: settings.time || "00:00",
    retention:
      typeof settings.retention === "number"
        ? settings.retention
        : parseInt(String(settings.retention ?? 7), 10),
    notificationEmail: settings.notificationEmail || null,
    tenantId,
  };

  if (existing) {
    await prisma.backupSettings.update({
      where: { id: existing.id },
      data: dataToSave,
    });
  } else {
    await prisma.backupSettings.create({
      data: dataToSave,
    });
  }

  revalidatePath("/settings");
}

/**
 * 3. Manual Backup
 */
export async function performManualBackupAction(
  scope: "database" | "files" | "full" = "full"
) {
  console.log("🔘 Manual Backup Started...");

  const { tenant, user } = await getTenantAndUser();
  if (!user) throw new Error("Unauthorized");

  if (tenant && tenant.slug !== "central-hive") throw new Error("Unauthorized");
  const tenantId = resolveTenantId(tenant);

  try {
    const result = await generateBackup(tenantId, scope);
    const sizeBigInt = BigInt(result.size);
    const backupType = `MANUAL_${scope.toUpperCase()}`;

    const record = await prisma.backupHistory.create({
      data: {
        tenantId,
        filename: result.filename,
        path: result.path,
        size: sizeBigInt,
        status: "SUCCESS",
        type: backupType,
      },
    });

    const settings = await prisma.backupSettings.findFirst({ where: { tenantId } });
    if (settings && settings.retention >= 0) {
      await runBackupCleanup(tenantId, settings.retention, record.id);
    }

    // Notify logged-in user
    await sendBackupNotification({
      tenantId,
      filename: result.filename,
      size: sizeBigInt,
      type: backupType,
      status: "SUCCESS",
      recipientEmail: user.email,
      recipientName: user.name || "User",
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    console.error("❌ Backup Failed:", error);

    await sendBackupNotification({
      tenantId,
      filename: "N/A",
      size: BigInt(0),
      type: `MANUAL_${scope.toUpperCase()}`,
      status: "FAILED",
      error: error.message,
      recipientEmail: user.email,
      recipientName: user.name || "User",
    });

    return { success: false, error: error.message };
  }
}

/**
 * 4. Delete single backup
 */
export async function deleteBackupAction(id: string) {
  const { user } = await getTenantAndUser();

  const record = await prisma.backupHistory.findUnique({ where: { id } });
  if (!record) return;

  const storage = await getStorageProvider(null); // always central

  try {
    await storage.delete(record.path);
  } catch (e) {
    console.warn(
      "Could not delete file from storage, removing DB record only.",
      e
    );
  }

  await prisma.backupHistory.delete({ where: { id } });

  if (user) {
    await sendBackupNotification({
      tenantId: record.tenantId,
      filename: record.filename,
      size: BigInt(0),
      type: "MANUAL_DELETE",
      status: "SUCCESS",
      count: 1,
      recipientEmail: user.email,
      recipientName: user.name || "User",
    });
  }

  revalidatePath("/settings");
}

/**
 * 5. Get History
 */
export async function getBackupHistoryAction() {
  const { tenant } = await getTenantAndUser();
  const targetTenantId = resolveTenantId(tenant);

  const history = await prisma.backupHistory.findMany({
    where: { tenantId: targetTenantId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return history.map((h) => ({ ...h, size: h.size.toString() }));
}

/**
 * 6. Bulk Delete
 */
export async function deleteManyBackupsAction(ids: string[]) {
  const { tenant, user } = await getTenantAndUser();

  if (tenant && tenant.slug !== "central-hive") throw new Error("Unauthorized");
  const targetTenantId = resolveTenantId(tenant);

  const records = await prisma.backupHistory.findMany({
    where: { id: { in: ids }, tenantId: targetTenantId },
  });

  const storage = await getStorageProvider(targetTenantId);

  for (const record of records) {
    try {
      await storage.delete(record.path);
      console.log(`[Backup] Deleted file: ${record.filename}`);
    } catch (e: any) {
      console.warn(`[Backup] File delete warning: ${e.message}`);
    }
  }

  await prisma.backupHistory.deleteMany({
    where: { id: { in: ids }, tenantId: targetTenantId },
  });

  if (user && records.length > 0) {
    await sendBackupNotification({
      tenantId: targetTenantId,
      filename: "Multiple Files",
      size: BigInt(0),
      type: "MANUAL_BULK_DELETE",
      status: "SUCCESS",
      count: records.length,
      recipientEmail: user.email,
      recipientName: user.name || "User",
    });
  }

  revalidatePath("/settings");
}
