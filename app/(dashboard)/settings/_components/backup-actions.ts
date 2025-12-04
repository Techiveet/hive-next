"use server";

import fs from "fs/promises";
import { generateBackup } from "@/lib/backup-service";
import { getTenantAndUser } from "@/lib/get-tenant-and-user";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ✅ 1. Fetch Settings (Restored)
export async function getBackupSettingsAction() {
  const { tenant } = await getTenantAndUser();
  const tenantId = tenant?.id ?? null; 

  // Use findFirst to handle Central Admin (null tenantId) correctly
  const settings = await prisma.backupSettings.findFirst({
    where: { tenantId: tenantId }
  });

  return settings || { enabled: false, frequency: "DAILY", time: "00:00", retention: 7 };
}

// ✅ 2. Save Settings
export async function saveBackupSettingsAction(settings: any) {
  const { tenant } = await getTenantAndUser();
  if (tenant && tenant.slug !== "central-hive") throw new Error("Unauthorized");

  const tenantId = tenant?.id ?? null;

  const existing = await prisma.backupSettings.findFirst({
      where: { tenantId }
  });

  if (existing) {
      await prisma.backupSettings.update({
          where: { id: existing.id },
          data: {
            enabled: settings.enabled,
            frequency: settings.frequency,
            time: settings.time,
            retention: settings.retention
          }
      });
  } else {
      await prisma.backupSettings.create({
          data: {
            tenantId,
            enabled: settings.enabled,
            frequency: settings.frequency,
            time: settings.time,
            retention: settings.retention
          }
      });
  }
  
  revalidatePath("/settings");
}

// ✅ 3. Manual Backup (With Scope Support Restored)
// Accepts 'database' | 'files' | 'full' to match your UI buttons
export async function performManualBackupAction(scope: "database" | "files" | "full" = "full") {
  const { tenant } = await getTenantAndUser();
  if (tenant && tenant.slug !== "central-hive") throw new Error("Unauthorized");

  try {
    // Pass the scope to the generator
    const result = await generateBackup(tenant?.id, scope);

    await prisma.backupHistory.create({
      data: {
        tenantId: tenant?.id,
        filename: result.filename,
        path: result.path,
        size: BigInt(result.size),
        status: "SUCCESS",
        type: `MANUAL_${scope.toUpperCase()}`,
      },
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (error: any) {
    console.error(error);
    return { success: false, error: error.message };
  }
}

// ✅ 4. Delete Backup
export async function deleteBackupAction(id: string) {
  const record = await prisma.backupHistory.findUnique({ where: { id } });
  if (!record) return;

  try {
    await fs.unlink(record.path);
  } catch (e) {
    console.error("File not found on disk, deleting record anyway");
  }

  await prisma.backupHistory.delete({ where: { id } });
  revalidatePath("/settings");
}

// ✅ 5. Get History
export async function getBackupHistoryAction() {
   const { tenant } = await getTenantAndUser();
   const history = await prisma.backupHistory.findMany({
     where: { tenantId: tenant?.id },
     orderBy: { createdAt: 'desc' },
     take: 10
   });
   
   return history.map(h => ({
       ...h,
       size: h.size.toString() // Convert BigInt for Client Component
   }));
}