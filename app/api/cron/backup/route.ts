import { NextRequest, NextResponse } from "next/server";
import { format, subMinutes } from "date-fns";

import { generateBackup } from "@/lib/backup-service";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { runBackupCleanup } from "@/lib/backup-cleanup";
import { runCronJob } from "@/lib/cron-service";

export async function GET(req: NextRequest) {
  return runCronJob("backup", async () => {
    const { searchParams } = new URL(req.url);
    const forceMode = searchParams.get("force") === "true";

    const now = new Date();
    const currentTime = format(now, "HH:mm");

    console.log(`[Cron] 🕒 Time: ${currentTime} | Force: ${forceMode}`);

    const targets = await prisma.backupSettings.findMany({
      where: {
        enabled: true,
        ...(forceMode ? {} : { time: currentTime }), 
      },
    });

    if (targets.length === 0) {
      return { success: true, message: "No backups due." };
    }

    const results = [];

    for (const setting of targets) {
      try {
        const tenantId = setting.tenantId;

        // Deduplication
        if (!forceMode) {
            const lastRun = await prisma.backupHistory.findFirst({
              where: { tenantId, type: "AUTOMATIC", createdAt: { gt: subMinutes(now, 1) } },
            });
            if (lastRun) continue; 
        }
        
        console.log(`[Cron] 🚀 Auto Backup...`);
        const backup = await generateBackup(tenantId, "full"); 

        const newRecord = await prisma.backupHistory.create({
          data: {
            tenantId: tenantId,
            filename: backup.filename,
            path: backup.path,
            size: BigInt(backup.size),
            status: "SUCCESS",
            type: "AUTOMATIC",
          },
        });

        // ✅ Run Auto-Delete
        if (setting.retention >= 0) {
            await runBackupCleanup(tenantId, setting.retention, newRecord.id);
        }

        results.push({ tenantId, status: "Success" });
      } catch (e: any) {
        console.error(`[Cron] Error:`, e);
        results.push({ tenantId: setting.tenantId, status: "Failed" });
      }
    }

    revalidatePath("/settings"); 
    return { success: true, ran: results.length, details: results };
  });
}