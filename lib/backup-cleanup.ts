import { getStorageProvider } from "@/lib/storage-factory";
import { prisma } from "@/lib/prisma";
import { subDays } from "date-fns";

export async function runBackupCleanup(tenantId: string | null, retentionDays: number, safeId?: string) {
  if (retentionDays === undefined || retentionDays === null) return;

  // Calculate cutoff. If 0 (Test Mode), current time is cutoff (delete everything)
  const cutoffDate = retentionDays === 0 ? new Date() : subDays(new Date(), retentionDays);
  
  console.log(`[Cleanup] Running... Deleting backups older than ${retentionDays} days.`);

  // We always use Central storage for backups
  const storage = await getStorageProvider(null);

  const oldBackups = await prisma.backupHistory.findMany({
    where: {
      tenantId: tenantId,
      createdAt: { lt: cutoffDate },
      // Prevent deleting the file we literally just created
      ...(safeId ? { id: { not: safeId } } : {})
    }
  });

  if (oldBackups.length === 0) return;

  console.log(`[Cleanup] 🧹 Found ${oldBackups.length} expired backups. Deleting...`);

  for (const backup of oldBackups) {
    try {
      // 1. Delete from Cloud/Disk
      await storage.delete(backup.path);
      console.log(`[Cleanup] Deleted file: ${backup.filename}`);
    } catch (err: any) {
      console.warn(`[Cleanup] Warning: Could not delete file (might be missing): ${err.message}`);
    }

    // 2. Delete from Database
    await prisma.backupHistory.delete({ where: { id: backup.id } });
  }
}