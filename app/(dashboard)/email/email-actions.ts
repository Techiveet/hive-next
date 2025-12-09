//app/(dashboard)/email/email-actions.tsx
"use server";

import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// =========================================================
// 1. SEND EMAIL (Supports Multiple Recipients, CC, BCC, Attachments, E2EE)
// =========================================================
export async function sendEmailAction(data: {
  toIds: string[];
  ccIds: string[];
  bccIds: string[];
  subject: string;
  body: string;
  fileIds?: string[]; 
  isE2EE?: boolean; 
}) {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Unauthorized");

  const fileIds = data.fileIds ?? [];

  // 1. Prepare recipients with types
  const allRecipients = [
    ...data.toIds.map((id) => ({ userId: id, type: "TO" as const })),
    ...data.ccIds.map((id) => ({ userId: id, type: "CC" as const })),
    ...data.bccIds.map((id) => ({ userId: id, type: "BCC" as const })),
  ];

  // 2. Create Email & Recipients
  const email = await prisma.email.create({
    data: {
      subject: data.subject,
      body: data.body,
      senderId: user.id,
      senderFolder: "sent",
      isE2EE: data.isE2EE || false,
      recipients: {
        create: allRecipients.map((r) => ({
          userId: r.userId,
          folder: "inbox",
          isRead: false,
          type: r.type,
        })),
      },
    },
  });

  // 3. Link uploaded files as attachments 
  if (fileIds.length > 0) {
    const files = await prisma.file.findMany({
      where: { id: { in: fileIds } },
      select: { id: true, mimeType: true },
    });

    if (files.length) {
      await prisma.emailAttachment.createMany({
        data: files.map((file) => ({
          emailId: email.id,
          fileId: file.id,
          type: file.mimeType?.startsWith("image/")
            ? "IMAGE"
            : file.mimeType?.startsWith("video/")
            ? "VIDEO"
            : "FILE",
        })),
      });
    }
  }

  // 4. Real-time Notifications (Fire & Forget)
  try {
    const SOCKET_URL = "http://localhost:3001/trigger-email";

    // NOTE: If the subject/body is E2EE, we send the encrypted subject/a generic preview
    // to the socket.
    const previewBody = data.isE2EE ? "(Encrypted Message)" : (data.body || "").substring(0, 50) + "...";
    const previewSubject = data.isE2EE ? "(Encrypted Subject)" : data.subject;

    if (allRecipients.length > 0) {
      const recipientIds = allRecipients.map((r) => r.userId);
      const payload = {
        id: email.id,
        subject: previewSubject,
        senderId: user.id,
        senderName: user.name || user.email,
        preview: previewBody,
        createdAt: email.createdAt,
      };

      await fetch(SOCKET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toIds: recipientIds,
          emailData: payload,
          type: "new-email",
        }),
      });
    }

    await fetch(SOCKET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toIds: [user.id],
        emailData: { id: email.id },
        type: "email-sent",
      }),
    });
  } catch (error) {
    console.error("Socket error:", error);
  }

  revalidatePath("/email");
  return { success: true };
}

// =========================================================
// 2. SAVE DRAFT
// =========================================================
export async function saveDraftAction(data: {
  toIds: string[];
  subject: string;
  body: string;
}) {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Unauthorized");

  const email = await prisma.email.create({
    data: {
      subject: data.subject,
      body: data.body,
      senderId: user.id,
      senderFolder: "drafts",
    },
  });

  revalidatePath("/email");
  return { success: true, id: email.id };
}

// =========================================================
// 3. ARCHIVE (Multi-Support)
// =========================================================
export async function archiveEmailsAction(emailIds: string[]) {
  const { user } = await getCurrentSession();
  if (!user) return;

  await Promise.all([
    prisma.emailRecipient.updateMany({
      where: {
        userId: user.id,
        emailId: { in: emailIds },
      },
      data: { folder: "archive" },
    }),
    prisma.email.updateMany({
      where: {
        senderId: user.id,
        id: { in: emailIds },
      },
      data: { senderFolder: "archive" },
    }),
  ]);

  revalidatePath("/email");
}

// =========================================================
// 4. DELETE / TRASH (Multi-Support & Hard/Soft Delete)
// =========================================================
export async function deleteEmailsAction(
    emailIds: string[],
    currentFolder: string
) {
    const { user } = await getCurrentSession();
    if (!user) return;

    if (currentFolder === "trash") {
        // 1. HARD DELETE (User is deleting from their trash)

        // Hard delete the current user's recipient record
        await prisma.emailRecipient.deleteMany({
            where: { userId: user.id, emailId: { in: emailIds } },
        });
        
        // Hard delete the sender's record if the current user was the sender.
        // This is necessary because the Email model is tied to the sender.
        await prisma.email.deleteMany({ 
            where: { senderId: user.id, id: { in: emailIds } },
        });


        // Check if the *Email* record itself can be deleted globally
        for (const emailId of emailIds) {
            
            // Count remaining recipient views (any user still holding a record)
            const remainingRecipients = await prisma.emailRecipient.count({
                where: { emailId: emailId },
            });
            
            // Check the sender's status in the main Email table
            const senderEmail = await prisma.email.findUnique({
                where: { id: emailId },
                select: { senderFolder: true, senderId: true },
            });

            // isSenderDeleted will be TRUE if the sender record was deleted by the line above, 
            // OR if it exists and senderFolder is 'trash'.
            const isSenderDeleted = !senderEmail || senderEmail.senderFolder === 'trash';

            // Perform the true, permanent email record deletion only if all user views are gone.
            if (remainingRecipients === 0 && isSenderDeleted) {
                // FIX: Use deleteMany instead of delete() to avoid failure if the record 
                // was already deleted by the `deleteEmailsAction` above.
                await prisma.email.deleteMany({ where: { id: emailId } });
            }
        }

    } else {
        // 2. SOFT DELETE: Move to trash folder
        await Promise.all([
            // Update the recipient record for the current user
            prisma.emailRecipient.updateMany({
                where: { userId: user.id, emailId: { in: emailIds } },
                data: { folder: "trash" },
            }),
            // Update the sender record for the current user
            prisma.email.updateMany({
                where: { senderId: user.id, id: { in: emailIds } },
                data: { senderFolder: "trash" },
            }),
        ]);
    }

    revalidatePath("/email");
}

// =========================================================
// 5. STAR / UNSTAR (Multi-Support)
// =========================================================
export async function updateEmailStarStatusAction(
  emailIds: string[],
  isStarred: boolean
) {
  const { user } = await getCurrentSession();
  if (!user) return;

  await Promise.all([
    prisma.emailRecipient.updateMany({
      where: { userId: user.id, emailId: { in: emailIds } },
      data: { isStarred },
    }),
    prisma.email.updateMany({
      where: { senderId: user.id, id: { in: emailIds } },
      data: { isStarred },
    }),
  ]);

  revalidatePath("/email");
}

export async function toggleStarAction(emailId: string, isStarred: boolean) {
  return updateEmailStarStatusAction([emailId], isStarred);
}

// =========================================================
// 6. READ / UNREAD (Multi-Support)
// =========================================================
export async function updateEmailReadStatusAction(
  emailIds: string[],
  isRead: boolean
) {
  const { user } = await getCurrentSession();
  if (!user) return;

  await prisma.emailRecipient.updateMany({
    where: {
      userId: user.id,
      emailId: { in: emailIds },
    },
    data: { isRead },
  });

  revalidatePath("/email");
}

export async function toggleReadStatusAction(
  emailId: string,
  isRead: boolean
) {
  return updateEmailReadStatusAction([emailId], isRead);
}

export async function markEmailAsReadAction(emailId: string) {
  return updateEmailReadStatusAction([emailId], true);
}