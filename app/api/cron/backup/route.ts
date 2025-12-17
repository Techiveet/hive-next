// app/api/cron/backup/route.ts

import { format, subMinutes } from "date-fns";

import { NextRequest } from "next/server";
import { generateBackup } from "@/lib/backup-service";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { runBackupCleanup } from "@/lib/backup-cleanup";
import { runCronJob } from "@/lib/cron-service";
import { sendBackupNotification } from "@/lib/backup-notifier";

export const dynamic = "force-dynamic";

// Normalize DB time to "HH:mm"
function normalizeTime(value: string | null): string | null {
  if (!value) return null;

  // Already "HH:mm"
  if (/^\d{2}:\d{2}$/.test(value)) return value;

  // Handle "05:31 PM" / "5:31 pm"
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const ampm = match[3].toUpperCase();

  hour = hour % 12;
  if (ampm === "PM") hour += 12;

  return `${hour.toString().padStart(2, "0")}:${minute}`;
}

export async function GET(req: NextRequest) {
  return runCronJob("backup", async () => {
    const { searchParams } = new URL(req.url);
    const forceMode = searchParams.get("force") === "true";

    const now = new Date();
    const currentTime = format(now, "HH:mm");
    console.log(`[Cron] 🕒 Time: ${currentTime} | Force: ${forceMode}`);

    // 1) Load all enabled settings
    const allEnabled = await prisma.backupSettings.findMany({
      where: { enabled: true },
    });

    console.log(
      "[Cron] Enabled backup settings:",
      allEnabled.map((s) => ({
        tenantId: s.tenantId,
        rawTime: s.time,
        normTime: normalizeTime(s.time),
        notificationEmail: s.notificationEmail,
      }))
    );

    // 2) Figure out which ones are due
    const targets = forceMode
      ? allEnabled
      : allEnabled.filter((s) => normalizeTime(s.time) === currentTime);

    console.log(
      `[Cron] Found ${targets.length} target(s)`,
      targets.map((s) => ({
        tenantId: s.tenantId,
        time: s.time,
        normTime: normalizeTime(s.time),
      }))
    );

    if (targets.length === 0) {
      console.log("[Cron] No backups due.");
      return { success: true, message: "No backups due." }; // ✅ FIX 1: Ensure message is always present
    }

    const results: any[] = [];

    for (const setting of targets) {
      const tenantId = setting.tenantId ?? null;
      const recipientEmail =
        setting.notificationEmail || process.env.ADMIN_EMAIL || undefined;

      if (!recipientEmail) {
        console.warn(
          `[Cron] ⚠️ No notificationEmail / ADMIN_EMAIL for tenantId=${
            tenantId ?? "CENTRAL"
          } – will run backup but not send email`
        );
      }

      // distinguish forced vs scheduled
      const backupType = forceMode ? "AUTOMATIC_FORCED" : "AUTOMATIC_SCHEDULED";

      try {
        // 3) Only dedupe within 1 minute for scheduled runs
        if (!forceMode) {
          const lastRun = await prisma.backupHistory.findFirst({
            where: {
              tenantId,
              type: "AUTOMATIC_SCHEDULED",
              createdAt: { gt: subMinutes(now, 1) },
            },
          });

          if (lastRun) {
            console.log(
              `[Cron] Skipping ${tenantId ?? "Central"} (Already ran this minute)`
            );
            continue;
          }
        }

        console.log(
          `[Cron] 🚀 Auto Backup (${backupType}): ${
            tenantId ?? "Central"
          } | Notify: ${recipientEmail ?? "NO EMAIL"}`
        );

        // 4) Generate backup
        const backup = await generateBackup(tenantId, "full");

        // 5) Store history
        const newRecord = await prisma.backupHistory.create({
          data: {
            tenantId,
            filename: backup.filename,
            path: backup.path,
            size: BigInt(backup.size),
            status: "SUCCESS",
            type: backupType,
          },
        });

        // 6) Retention cleanup
        if (setting.retention >= 0) {
          await runBackupCleanup(tenantId, setting.retention, newRecord.id);
        }

        // 7) SUCCESS email
        if (recipientEmail) {
          console.log(
            `[Cron] 📧 Sending SUCCESS email to ${recipientEmail} for tenantId=${
              tenantId ?? "CENTRAL"
            }`
          );
          await sendBackupNotification({
            tenantId,
            filename: backup.filename,
            size: BigInt(backup.size),
            type: backupType,
            status: "SUCCESS",
            recipientEmail,
            recipientName: "Backup System",
          });
        }

        results.push({
          tenantId,
          status: "Success",
          message: "Backup completed successfully.",
        });
      } catch (e: any) {
        console.error(`[Cron] Error for ${tenantId ?? "CENTRAL"}:`, e);

        // 8) FAILURE email
        if (recipientEmail) {
          console.log(
            `[Cron] 📧 Sending FAILURE email to ${recipientEmail} for tenantId=${
              tenantId ?? "CENTRAL"
            }`
          );
          await sendBackupNotification({
            tenantId,
            filename: "N/A",
            size: BigInt(0),
            type: backupType,
            status: "FAILED",
            error: e.message,
            recipientEmail,
            recipientName: "Backup System",
          });
        }

        results.push({
          tenantId: setting.tenantId,
          status: "Failed",
          error: e.message,
          message: `Backup failed: ${e.message}`, // Ensure failure result also has a message
        });
      }
    }

    revalidatePath("/settings");
    // ✅ FIX 2: Ensure the final return object has a message property.
    return {
      success: true,
      ran: results.length,
      details: results,
      message: `Backup cron job executed for ${results.length} target(s).`,
    };
  });
}
