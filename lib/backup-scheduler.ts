// lib/backup-scheduler.ts

import { CronJob } from "cron";
import { generateBackup } from "@/lib/backup-service";
import { prisma } from "@/lib/prisma";
import { runBackupCleanup } from "@/lib/backup-cleanup";
import { sendBackupNotification } from "@/lib/backup-notifier";

function resolveTenantId(tenant: { id: string; slug: string } | null) {
  if (!tenant || tenant.slug === "central-hive") return null;
  return tenant.id;
}

async function runScheduledBackupForTenant(tenantId: string | null) {
  console.log(`[Auto-Backup] Starting scheduled backup for tenant: ${tenantId || 'central'}`);
  
  let settings = null;
  let result = null;
  
  try {
    // Get backup settings for this tenant
    settings = await prisma.backupSettings.findFirst({
      where: { tenantId },
    });

    console.log(`[Auto-Backup] Settings for tenant ${tenantId || 'central'}:`, {
      hasSettings: !!settings,
      enabled: settings?.enabled,
      notificationEmail: settings?.notificationEmail
    });

    if (!settings || !settings.enabled) {
      console.log(`[Auto-Backup] Backup disabled or no settings for tenant: ${tenantId || 'central'}`);
      return;
    }

    // Run the backup
    console.log(`[Auto-Backup] Generating backup for tenant: ${tenantId || 'central'}`);
    result = await generateBackup(tenantId, "full");
    const sizeBigInt = BigInt(result.size);
    const backupType = `SCHEDULED_FULL`;

    console.log(`[Auto-Backup] Backup generated successfully: ${result.filename}, size: ${result.size}`);

    // Create backup record
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

    console.log(`[Auto-Backup] Backup record created: ${record.id}`);

    // Run cleanup
    if (settings.retention >= 0) {
      console.log(`[Auto-Backup] Running cleanup with retention: ${settings.retention} days`);
      await runBackupCleanup(tenantId, settings.retention, record.id);
    }

    // Send notification using the settings email
    console.log(`[Auto-Backup] Sending notification to: ${settings.notificationEmail || 'No email configured'}`);
    await sendBackupNotification({
      tenantId,
      filename: result.filename,
      size: sizeBigInt,
      type: backupType,
      status: "SUCCESS",
      recipientEmail: settings.notificationEmail || undefined,
    });

    console.log(`[Auto-Backup] Completed for tenant: ${tenantId || 'central'}, filename: ${result.filename}`);
  } catch (error: any) {
    console.error(`[Auto-Backup] Failed for tenant ${tenantId || 'central'}:`, error);
    
    // Send failure notification
    try {
      console.log(`[Auto-Backup] Sending failure notification to: ${settings?.notificationEmail || 'No email configured'}`);
      await sendBackupNotification({
        tenantId,
        filename: result?.filename || "N/A",
        size: result ? BigInt(result.size) : BigInt(0),
        type: "SCHEDULED_FULL",
        status: "FAILED",
        error: error.message,
        recipientEmail: settings?.notificationEmail || undefined,
      });
    } catch (notificationError) {
      console.error(`[Auto-Backup] Failed to send notification:`, notificationError);
    }
  }
}

async function runAllScheduledBackups() {
  console.log(`[Auto-Backup] ===== Running all scheduled backups at ${new Date().toISOString()} =====`);
  
  try {
    // Get all tenants with backup settings
    const allSettings = await prisma.backupSettings.findMany({
      include: {
        tenant: {
          select: { id: true, slug: true }
        }
      },
      where: { enabled: true }
    });

    console.log(`[Auto-Backup] Found ${allSettings.length} enabled backup settings`);

    if (allSettings.length === 0) {
      console.log(`[Auto-Backup] No enabled backup settings found. Exiting.`);
      return;
    }

    // Run backups for each enabled tenant
    const promises = allSettings.map(async (settings, index) => {
      console.log(`[Auto-Backup] Processing setting ${index + 1}/${allSettings.length}`);
      const tenantId = resolveTenantId(settings.tenant);
      await runScheduledBackupForTenant(tenantId);
    });

    await Promise.all(promises);
    
    console.log(`[Auto-Backup] ===== All scheduled backups completed =====`);
  } catch (error) {
    console.error(`[Auto-Backup] Global error:`, error);
  }
}

// Advanced version that reads backup time from settings
async function getBackupCronTime(): Promise<string> {
  try {
    // Get all enabled backup settings
    const allSettings = await prisma.backupSettings.findMany({
      where: { enabled: true }
    });
    
    console.log(`[Scheduler] Found ${allSettings.length} enabled settings for cron time`);
    
    // For simplicity, use the first enabled setting's time
    // Or you could schedule multiple cron jobs
    if (allSettings.length > 0) {
      const time = allSettings[0].time || "00:00";
      const [hours, minutes] = time.split(':');
      const cronTime = `${minutes || 0} ${hours || 0} * * *`;
      console.log(`[Scheduler] Using cron time: ${cronTime} (from settings time: ${time})`);
      return cronTime;
    }
  } catch (error) {
    console.error("[Scheduler] Error reading backup time:", error);
  }
  
  // Default to midnight
  console.log(`[Scheduler] No enabled settings found, using default: 0 0 * * * (midnight)`);
  return '0 0 * * *';
}

export async function startBackupScheduler() {
  // Check if already started
  if (global.backupSchedulerStarted) {
    console.log(`[Scheduler] Scheduler already started`);
    return;
  }
  
  console.log(`[Scheduler] Starting backup scheduler...`);
  
  try {
    // Get the cron schedule from settings
    const cronTime = await getBackupCronTime();
    
    console.log(`[Scheduler] Creating cron job with schedule: ${cronTime}`);
    
    const job = new CronJob(
      cronTime,
      () => {
        console.log(`[Scheduler] Cron job triggered at ${new Date().toISOString()}`);
        runAllScheduledBackups();
      },
      null,
      true,
      'UTC'
    );
    
    job.start();
    global.backupSchedulerStarted = true;
    
    console.log(`[Scheduler] Scheduler started successfully. Next run: ${job.nextDate().toISOString()}`);
    
    return job;
  } catch (error) {
    console.error(`[Scheduler] Failed to start scheduler:`, error);
    return null;
  }
}

// For Next.js API route usage
export async function triggerBackupNow() {
  console.log(`[Scheduler] Manually triggering scheduled backups`);
  return runAllScheduledBackups();
}

// Add type declaration for global
declare global {
  var backupSchedulerStarted: boolean | undefined;
}