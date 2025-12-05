"use server";

import fs from "fs/promises";
import { generateBackup } from "@/lib/backup-service";
import { getStorageProvider } from "@/lib/storage-factory";
import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { runBackupCleanup } from "@/lib/backup-cleanup";

function resolveTenantId(tenant: { id: string; slug: string } | null) {
  if (!tenant || tenant.slug === "central-hive") return null;
  return tenant.id;
}

// 1. Fetch Settings
export async function getBackupSettingsAction() {
  const { tenant } = await getTenantAndUser();
  const tenantId = resolveTenantId(tenant); 

  const settings = await prisma.backupSettings.findFirst({
    where: { tenantId: tenantId }
  });

  return settings || { enabled: false, frequency: "DAILY", time: "00:00", retention: 7 };
}

// 2. Save Settings
export async function saveBackupSettingsAction(settings: any) {
  const { tenant } = await getTenantAndUser();
  if (tenant && tenant.slug !== "central-hive") throw new Error("Unauthorized");
  
  const tenantId = resolveTenantId(tenant);
  const existing = await prisma.backupSettings.findFirst({ where: { tenantId } });

  if (existing) {
      await prisma.backupSettings.update({ where: { id: existing.id }, data: { ...settings, tenantId } });
  } else {
      await prisma.backupSettings.create({ data: { ...settings, tenantId } });
  }
  revalidatePath("/settings");
}

// 3. Manual Backup
export async function performManualBackupAction(scope: "database" | "files" | "full" = "full") {
  console.log("🔘 Manual Backup Started...");
  const { tenant } = await getTenantAndUser();
  if (tenant && tenant.slug !== "central-hive") throw new Error("Unauthorized");

  const tenantId = resolveTenantId(tenant);

  try {
    const result = await generateBackup(tenantId, scope);

    const record = await prisma.backupHistory.create({
      data: {
        tenantId: tenantId,
        filename: result.filename,
        path: result.path,
        size: BigInt(result.size),
        status: "SUCCESS",
        type: `MANUAL_${scope.toUpperCase()}`,
      },
    });

    // ✅ Automatic Delete Trigger (Even on Manual)
    const settings = await prisma.backupSettings.findFirst({ where: { tenantId } });
    if (settings && settings.retention >= 0) {
        await runBackupCleanup(tenantId, settings.retention, record.id);
    }

    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    console.error("❌ Backup Failed:", error);
    return { success: false, error: error.message };
  }
}

// 4. Delete Backup
export async function deleteBackupAction(id: string) {
  const record = await prisma.backupHistory.findUnique({ where: { id } });
  if (!record) return;

  const storage = await getStorageProvider(null); // Always Central

  try {
      await storage.delete(record.path);
  } catch (e) {}

  await prisma.backupHistory.delete({ where: { id } });
  revalidatePath("/settings");
}

// 5. Get History
export async function getBackupHistoryAction() {
   const { tenant } = await getTenantAndUser();
   const targetTenantId = resolveTenantId(tenant);

   const history = await prisma.backupHistory.findMany({
     where: { tenantId: targetTenantId },
     orderBy: { createdAt: 'desc' },
     take: 10
   });
   
   return history.map(h => ({ ...h, size: h.size.toString() }));
}

// ✅ 6. Bulk Delete Action
export async function deleteManyBackupsAction(ids: string[]) {
  const { tenant } = await getTenantAndUser();
  // Security check
  if (tenant && tenant.slug !== "central-hive") throw new Error("Unauthorized");

  const targetTenantId = resolveTenantId(tenant);

  // Find all records to ensure we have paths
  const records = await prisma.backupHistory.findMany({
    where: { 
      id: { in: ids },
      tenantId: targetTenantId // Security: ensure they belong to this context
    }
  });

  const storage = await getStorageProvider(targetTenantId);

  // Loop through and delete files
  for (const record of records) {
    try {
      await storage.delete(record.path);
      console.log(`[Backup] Deleted file: ${record.filename}`);
    } catch (e: any) {
      console.warn(`[Backup] File delete warning: ${e.message}`);
    }
  }

  // Bulk delete DB records
  await prisma.backupHistory.deleteMany({
    where: { 
      id: { in: ids },
      tenantId: targetTenantId
    }
  });

  revalidatePath("/settings");
}