import { BackupNotificationEmail } from "@/emails/backup-notification-template";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/send-email";

export async function sendBackupNotification(data: {
  tenantId: string | null;
  filename: string;
  size: bigint;
  type: string;
  status: "SUCCESS" | "FAILED";
  error?: string;
  count?: number;
  recipientEmail?: string; 
  recipientName?: string;
}) {
  let emailToSendTo = data.recipientEmail;
  let adminName = data.recipientName || "Administrator";
  let tenantName = "System";

  // 1. Resolve Tenant Name
  if (data.tenantId) {
    const tenant = await prisma.tenant.findUnique({
        where: { id: data.tenantId },
        select: { name: true }
    });
    if (tenant) tenantName = tenant.name;
  }

  // 2. AUTOMATIC MODE: If no specific email is provided, check DB
  if (!emailToSendTo) {
      if (data.tenantId) {
        // Find Tenant Superadmin
        const adminUser = await prisma.user.findFirst({
            where: { 
                userRoles: { 
                    some: { 
                        tenantId: data.tenantId, 
                        role: { key: 'tenant_superadmin' } 
                    } 
                } 
            },
            select: { email: true, name: true }
        });
        
        if (adminUser) {
            emailToSendTo = adminUser.email;
            adminName = adminUser.name || "Tenant Admin";
        }
      } else {
          // Find Central Superadmin (using exact names you provided)
          const centralAdmin = await prisma.user.findFirst({
            where: { 
                userRoles: { 
                    some: { 
                        role: { 
                            OR: [
                                { key: 'central_superadmin' }, 
                                { name: 'Central Superadmin' },
                                { name: 'Central Super Administrator' }
                            ]
                        },
                        tenantId: null 
                    } 
                } 
            },
            orderBy: { createdAt: 'asc' }, // Fallback to oldest admin
            select: { email: true, name: true }
          });

          if(centralAdmin) {
              emailToSendTo = centralAdmin.email;
              adminName = centralAdmin.name || "System Admin";
          }
      }
  }

  // 3. Fallback to Env Var
  if (!emailToSendTo) {
      emailToSendTo = process.env.ADMIN_EMAIL; 
  }

  // 4. Safety Check
  if (!emailToSendTo) {
      console.warn(`⚠️ [Backup Notifier] Could not find an admin email to notify for ${data.type}`);
      return;
  }

  // 5. Format Data
  const mb = Number(data.size) / (1024 * 1024);
  const formattedSize = mb < 1 ? "< 1 MB" : `${mb.toFixed(2)} MB`;

  // 6. Send Email
  try {
    await sendEmail({
      to: emailToSendTo,
      subject: `[Hive Backup] ${data.status === "SUCCESS" ? "Success" : "Failed"} - ${tenantName}`,
      react: BackupNotificationEmail({
        adminName,
        tenantName,
        filename: data.filename,
        size: formattedSize,
        type: data.type,
        status: data.status,
        error: data.error,
        count: data.count,
      }),
    });
    console.log(`📧 Backup notification sent to ${emailToSendTo}`);
  } catch (err) {
    console.error("❌ Failed to send backup email:", err);
  }
}