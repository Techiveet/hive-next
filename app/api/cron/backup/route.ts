import { NextResponse } from "next/server";
import { format } from "date-fns";
import { generateBackup } from "@/lib/backup-service";
import { prisma } from "@/lib/prisma";

// This route is hit by your Cron Job (or PowerShell loop) every minute
export async function GET() {
  try {
    // 1. Get current time (Server Time)
    const now = new Date();
    const currentTime = format(now, "HH:mm"); // e.g., "14:30"

    console.log(`[Cron] Checking backup schedule for: ${currentTime}`);

    // 2. Find settings that match NOW and are ENABLED
    const targets = await prisma.backupSettings.findMany({
      where: {
        enabled: true,
        time: currentTime, 
      },
    });

    if (targets.length === 0) {
      return NextResponse.json({ message: "No backups scheduled for this time." });
    }

    // 3. Run Backups
    const results = [];
    for (const setting of targets) {
      try {
        const tenantId = setting.tenantId;
        
        console.log(`[Cron] Starting AUTOMATIC backup for ${tenantId || "Central System"}...`);
        
        // ✅ CRITICAL: We pass "full" here to ensure Database + Public Folder are included
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
        results.push({ tenantId, status: "Success", file: backup.filename });
      } catch (e: any) {
        console.error(`[Cron] Failed for ${setting.tenantId}`, e);
        results.push({ tenantId: setting.tenantId, status: "Failed", error: e.message });
      }
    }

    return NextResponse.json({ success: true, ran: results.length, details: results });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}