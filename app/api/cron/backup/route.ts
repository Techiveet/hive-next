import { NextRequest, NextResponse } from "next/server";
import { format, subDays, subMinutes } from "date-fns";

import { generateBackup } from "@/lib/backup-service";
import { getStorageProvider } from "@/lib/storage-factory";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { runCronJob } from "@/lib/cron-service";

export async function GET(req: NextRequest) {
  return runCronJob("backup", async () => {
    const { searchParams } = new URL(req.url);
    const forceMode = searchParams.get("force") === "true";

    const now = new Date();
    const currentTime = format(now, "HH:mm"); 

    console.log(`[Cron] 🕒 Server Time: ${currentTime} | Force Mode: ${forceMode}`);

    // 1. Fetch ALL enabled settings first to debug
    const allEnabled = await prisma.backupSettings.findMany({
      where: { enabled: true }
    });

    // 2. Filter in memory (easier to debug than Prisma query sometimes)
    const targets = forceMode 
        ? allEnabled 
        : allEnabled.filter(s => s.time === currentTime);

    if (targets.length === 0) {
      if (allEnabled.length > 0) {
          // Log what we found to help you debug
          console.log(`[Cron] ⚠️  No match. Server is ${currentTime}, but you scheduled: ${allEnabled.map(s => s.time).join(", ")}`);
      } else {
          console.log(`[Cron] No backups are enabled.`);
      }
      return { success: true, message: `No backups due.` };
    }

    console.log(`[Cron] ✅ Found ${targets.length} backups to run.`);

    const results = [];

    for (const setting of targets) {
      try {
        const tenantId = setting.tenantId;

        // Deduplication
        if (!forceMode) {
            const alreadyRan = await prisma.backupHistory.findFirst({
                where: {
                    tenantId: tenantId,
                    type: "AUTOMATIC",
                    createdAt: { gt: subMinutes(now, 1) },
                },
            });

            if (alreadyRan) {
                console.log(`[Cron] Skipping duplicate for ${tenantId || "System"}`);
                continue; 
            }
        }
        
        console.log(`[Cron] 🚀 Running backup for ${tenantId || "System"}...`);
        const backup = await generateBackup(tenantId, "full"); 

        await prisma.backupHistory.create({
          data: {
            tenantId: tenantId,
            filename: backup.filename,
            path: backup.path,
            size: BigInt(backup.size),
            status: "SUCCESS",
            type: "AUTOMATIC",
          },
        });

        // Cleanup
        if (setting.retention > 0) {
            await cleanupOldBackups(tenantId, setting.retention);
        }

        results.push({ tenantId, status: "Success", file: backup.filename });
      } catch (e: any) {
        console.error(`[Cron] ❌ Failed:`, e);
        results.push({ tenantId: setting.tenantId, status: "Failed", error: e.message });
      }
    }

    revalidatePath("/settings"); 
    return { success: true, ran: results.length, details: results };
  });
}

async function cleanupOldBackups(tenantId: string | null, retentionDays: number) {
    const cutoffDate = subDays(new Date(), retentionDays);
    const storage = await getStorageProvider(tenantId); 

    const oldBackups = await prisma.backupHistory.findMany({
        where: { tenantId, createdAt: { lt: cutoffDate } }
    });

    for (const backup of oldBackups) {
        try {
            await storage.delete(backup.path);
            console.log(`[Cleanup] Deleted: ${backup.filename}`);
        } catch (err) {}
        await prisma.backupHistory.delete({ where: { id: backup.id } });
    }
}