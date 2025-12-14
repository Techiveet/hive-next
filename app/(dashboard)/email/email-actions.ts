"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

// Helper to trigger sidebar refresh events
async function triggerSidebarEvents(actionType: string, details?: any) {
  revalidateTag("sidebar-counts");
  revalidateTag("emails");

  try {
    const socketUrl = process.env.INTERNAL_SOCKET_URL || "http://localhost:3001";
    await fetch(`${socketUrl}/trigger-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: actionType,
        ...details,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("Socket trigger error:", error);
  }
}

// =========================================================
// 1. SEND EMAIL
// =========================================================
export async function sendEmailAction(data: {
  toIds: string[];
  ccIds: string[];
  bccIds: string[];
  subject: string;
  body: string;
  fileIds?: string[];
  isE2EE?: boolean;
  draftId?: string; // ✅ when sending from drafts
}) {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Unauthorized");

  const fileIds = data.fileIds ?? [];

  const allRecipients = [
    ...data.toIds.map((id) => ({ userId: id, type: "TO" as const })),
    ...data.ccIds.map((id) => ({ userId: id, type: "CC" as const })),
    ...data.bccIds.map((id) => ({ userId: id, type: "BCC" as const })),
  ];

  const socketUrl = process.env.INTERNAL_SOCKET_URL || "http://localhost:3001";
  const SOCKET_ENDPOINT = `${socketUrl}/trigger-email`;

  const email = await prisma.$transaction(async (tx) => {
    // ✅ CASE 1: Sending from a draft → convert draft to sent
    if (data.draftId) {
      const draft = await tx.email.findFirst({
        where: {
          id: data.draftId,
          senderId: user.id,
          senderFolder: "drafts",
        },
        select: { id: true },
      });

      if (!draft) {
        // fallback: if draft not found, just send normally (avoid crashing)
        return tx.email.create({
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
      }

      // 1) Update draft content and move to sent
      const updated = await tx.email.update({
        where: { id: data.draftId },
        data: {
          subject: data.subject,
          body: data.body,
          senderFolder: "sent",
          isE2EE: data.isE2EE || false,

          // Optional but recommended so it appears as "just sent"
          createdAt: new Date(),
        },
      });

      // 2) Replace recipients (draft should have none, but safe)
      await tx.emailRecipient.deleteMany({ where: { emailId: updated.id } });
      if (allRecipients.length) {
        await tx.emailRecipient.createMany({
          data: allRecipients.map((r) => ({
            emailId: updated.id,
            userId: r.userId,
            folder: "inbox",
            isRead: false,
            type: r.type,
            createdAt: new Date(),
          })),
        });
      }

      // 3) Replace attachments
      await tx.emailAttachment.deleteMany({ where: { emailId: updated.id } });

      if (fileIds.length) {
        const files = await tx.file.findMany({
          where: { id: { in: fileIds } },
          select: { id: true, mimeType: true },
        });

        if (files.length) {
          await tx.emailAttachment.createMany({
            data: files.map((file) => ({
              emailId: updated.id,
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

      return updated;
    }

    // ✅ CASE 2: Normal send (not from draft)
    const created = await tx.email.create({
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

    if (fileIds.length) {
      const files = await tx.file.findMany({
        where: { id: { in: fileIds } },
        select: { id: true, mimeType: true },
      });

      if (files.length) {
        await tx.emailAttachment.createMany({
          data: files.map((file) => ({
            emailId: created.id,
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

    return created;
  });

  // ✅ sockets (same as before)
  try {
    const previewBody = data.isE2EE
      ? "(Encrypted Message)"
      : (data.body || "").substring(0, 50) + "...";
    const previewSubject = data.isE2EE ? "(Encrypted Subject)" : data.subject;

    if (allRecipients.length > 0) {
      const recipientIds = allRecipients.map((r) => r.userId);
      await fetch(SOCKET_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toIds: recipientIds,
          emailData: {
            id: email.id,
            subject: previewSubject,
            senderId: user.id,
            senderName: user.name || user.email,
            preview: previewBody,
            createdAt: email.createdAt,
          },
          type: "new-email",
        }),
      });
    }

    await fetch(SOCKET_ENDPOINT, {
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
  return { success: true, id: email.id };
}

// =========================================================
// 2. SAVE DRAFT  ✅ upgraded
// =========================================================
export async function saveDraftAction(data: {
  toIds: string[];
  ccIds?: string[];
  bccIds?: string[];
  subject: string;
  body: string;
  fileIds?: string[];
}) {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Unauthorized");

  const email = await prisma.email.create({
    data: {
      subject: data.subject,
      body: data.body,
      senderId: user.id,
      senderFolder: "drafts",

      // If you have these columns (recommended). If you don't, remove them.
      // toIds: data.toIds,
      // ccIds: data.ccIds ?? [],
      // bccIds: data.bccIds ?? [],
    },
  });

  const fileIds = data.fileIds ?? [];
  if (fileIds.length) {
    const files = await prisma.file.findMany({
      where: { id: { in: fileIds } },
      select: { id: true, mimeType: true },
    });

    if (files.length) {
      await prisma.emailAttachment.createMany({
        data: files.map((f) => ({
          emailId: email.id,
          fileId: f.id,
          type: f.mimeType?.startsWith("image/")
            ? "IMAGE"
            : f.mimeType?.startsWith("video/")
            ? "VIDEO"
            : "FILE",
        })),
      });
    }
  }

  revalidatePath("/email");
  return { success: true, id: email.id };
}

// =========================================================
// ✅ 2b. UPDATE DRAFT (NEW)
// =========================================================
export async function updateDraftAction(data: {
  id: string;
  toIds: string[];
  ccIds: string[];
  bccIds: string[];
  subject: string;
  body: string;
  fileIds?: string[];
}) {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Unauthorized");

  await prisma.$transaction(async (tx) => {
    // Ensure it is really MY draft
    const draft = await tx.email.findFirst({
      where: { id: data.id, senderId: user.id, senderFolder: "drafts" },
      select: { id: true },
    });

    if (!draft) throw new Error("Draft not found");

    await tx.email.update({
      where: { id: data.id },
      data: {
        subject: data.subject,
        body: data.body,
        senderFolder: "drafts",

        // If you have these columns (recommended). If you don't, remove them.
        // toIds: data.toIds,
        // ccIds: data.ccIds,
        // bccIds: data.bccIds,
      },
    });

    // replace attachments
    await tx.emailAttachment.deleteMany({ where: { emailId: data.id } });

    const fileIds = data.fileIds ?? [];
    if (fileIds.length) {
      const files = await tx.file.findMany({
        where: { id: { in: fileIds } },
        select: { id: true, mimeType: true },
      });

      if (files.length) {
        await tx.emailAttachment.createMany({
          data: files.map((f) => ({
            emailId: data.id,
            fileId: f.id,
            type: f.mimeType?.startsWith("image/")
              ? "IMAGE"
              : f.mimeType?.startsWith("video/")
              ? "VIDEO"
              : "FILE",
          })),
        });
      }
    }
  });

  revalidatePath("/email");
  return { success: true };
}

// =========================================================
// 3. ARCHIVE
// =========================================================
export async function archiveEmailsAction(ids: string[]) {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Unauthorized");

  try {
    let archivedCount = 0;

    await prisma.$transaction(async (tx) => {
      const recipientResult = await tx.emailRecipient.updateMany({
        where: {
          userId: user.id,
          id: { in: ids },
          folder: { not: "archive" },
        },
        data: { folder: "archive" },
      });

      const sentResult = await tx.email.updateMany({
        where: {
          senderId: user.id,
          id: { in: ids },
          senderFolder: { not: "archive" },
        },
        data: { senderFolder: "archive" },
      });

      archivedCount = recipientResult.count + sentResult.count;
    });

    await triggerSidebarEvents("archive", { ids, count: archivedCount, userId: user.id });

    return {
      success: true,
      archivedCount,
      message: `${archivedCount} email${archivedCount !== 1 ? "s" : ""} archived`,
    };
  } catch (error) {
    console.error("Archive action failed:", error);
    throw error;
  }
}

// =========================================================
// 4. DELETE / TRASH
// =========================================================
export async function deleteEmailsAction(ids: string[], currentFolder: string) {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Unauthorized");

  let deletedCount = 0;
  const isHardDelete = currentFolder === "trash";

  try {
    if (isHardDelete) {
      await prisma.$transaction(async (tx) => {
        const recipientResult = await tx.emailRecipient.deleteMany({
          where: { userId: user.id, id: { in: ids } },
        });

        const senderEmails = await tx.email.findMany({
          where: { senderId: user.id, id: { in: ids } },
          select: { id: true },
        });

        const senderEmailIds = senderEmails.map((e) => e.id);

        let senderSoftDeleted = 0;
        let senderHardDeleted = 0;

        if (senderEmailIds.length) {
          const recipientCounts = await tx.emailRecipient.groupBy({
            by: ["emailId"],
            where: { emailId: { in: senderEmailIds } },
            _count: { _all: true },
          });

          const hasRecipients = new Set(
            recipientCounts
              .filter((r) => r._count._all > 0)
              .map((r) => r.emailId)
          );

          const idsWithRecipients = senderEmailIds.filter((id) => hasRecipients.has(id));
          const idsWithoutRecipients = senderEmailIds.filter((id) => !hasRecipients.has(id));

          if (idsWithRecipients.length) {
            const upd = await tx.email.updateMany({
              where: { senderId: user.id, id: { in: idsWithRecipients } },
              data: { senderFolder: "deleted", isStarred: false },
            });
            senderSoftDeleted = upd.count;
          }

          if (idsWithoutRecipients.length) {
            const del = await tx.email.deleteMany({
              where: { senderId: user.id, id: { in: idsWithoutRecipients } },
            });
            senderHardDeleted = del.count;
          }
        }

        deletedCount = recipientResult.count + senderSoftDeleted + senderHardDeleted;
      });
    } else {
      await prisma.$transaction(async (tx) => {
        const recipientResult = await tx.emailRecipient.updateMany({
          where: { userId: user.id, id: { in: ids }, folder: { not: "trash" } },
          data: { folder: "trash", isStarred: false },
        });

        const sentResult = await tx.email.updateMany({
          where: { senderId: user.id, id: { in: ids }, senderFolder: { not: "trash" } },
          data: { senderFolder: "trash", isStarred: false },
        });

        deletedCount = recipientResult.count + sentResult.count;
      });
    }

    await triggerSidebarEvents(isHardDelete ? "permanent-delete" : "trash", {
      ids,
      count: deletedCount,
      isHardDelete,
      userId: user.id,
    });

    return {
      success: true,
      deletedCount,
      isHardDelete,
      message: isHardDelete
        ? `${deletedCount} email${deletedCount !== 1 ? "s" : ""} permanently deleted`
        : `${deletedCount} email${deletedCount !== 1 ? "s" : ""} moved to trash`,
    };
  } catch (error) {
    console.error("Delete action failed:", error);
    throw error;
  }
}

// =========================================================
// 5. MARK AS SPAM
// =========================================================
export async function markAsSpamAction(ids: string[], currentFolder: string) {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Unauthorized");

  try {
    let spamCount = 0;

    if (currentFolder === "sent" || currentFolder === "drafts") {
      const result = await prisma.email.updateMany({
        where: { senderId: user.id, id: { in: ids }, senderFolder: { not: "spam" } },
        data: { senderFolder: "spam" },
      });
      spamCount = result.count;
    } else {
      const result = await prisma.emailRecipient.updateMany({
        where: { userId: user.id, id: { in: ids }, folder: { not: "spam" } },
        data: { folder: "spam" },
      });
      spamCount = result.count;
    }

    await triggerSidebarEvents("spam", { ids, count: spamCount, currentFolder, userId: user.id });

    return {
      success: true,
      spamCount,
      message: `${spamCount} email${spamCount !== 1 ? "s" : ""} marked as spam`,
    };
  } catch (error) {
    console.error("Mark as spam action failed:", error);
    throw error;
  }
}

// ✅ Spam by Email.id (works everywhere)
// Uses your existing markAsSpamAction() internally.
export async function markAsSpamByEmailIdAction(emailId: string, currentFolder: string) {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Unauthorized");

  // Sender-side (sent/drafts): markAsSpamAction expects Email.id
  if (currentFolder === "sent" || currentFolder === "drafts") {
    return markAsSpamAction([emailId], currentFolder);
  }

  // Receiver-side (inbox/all/archive/starred/trash/etc): markAsSpamAction expects EmailRecipient.id
  const recipientRow = await prisma.emailRecipient.findFirst({
    where: { userId: user.id, emailId },
    select: { id: true },
  });

  if (!recipientRow) throw new Error("Recipient record not found for this email");

  return markAsSpamAction([recipientRow.id], currentFolder);
}

// =========================================================
// 6. STAR / UNSTAR
// =========================================================
export async function updateEmailStarStatusAction(ids: string[], isStarred: boolean) {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Unauthorized");

  try {
    let updatedCount = 0;

    await prisma.$transaction(async (tx) => {
      const recipientResult = await tx.emailRecipient.updateMany({
        where: {
          userId: user.id,
          id: { in: ids },
          folder: { notIn: ["trash", "spam"] },
        },
        data: { isStarred },
      });

      const sentResult = await tx.email.updateMany({
        where: {
          senderId: user.id,
          id: { in: ids },
          senderFolder: { notIn: ["trash", "spam"] },
        },
        data: { isStarred },
      });

      updatedCount = recipientResult.count + sentResult.count;
    });

    await triggerSidebarEvents(isStarred ? "star" : "unstar", {
      ids,
      isStarred,
      count: updatedCount,
      userId: user.id,
    });

    return {
      success: true,
      updatedCount,
      message: `${updatedCount} email${updatedCount !== 1 ? "s" : ""} ${isStarred ? "starred" : "unstarred"}`,
    };
  } catch (error) {
    console.error("Star action failed:", error);
    throw error;
  }
}

export async function toggleStarAction(id: string, isStarred: boolean) {
  return updateEmailStarStatusAction([id], isStarred);
}

// =========================================================
// 7. READ / UNREAD
// =========================================================
export async function updateEmailReadStatusAction(ids: string[], isRead: boolean) {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Unauthorized");

  try {
    const result = await prisma.emailRecipient.updateMany({
      where: {
        userId: user.id,
        id: { in: ids },
        isRead: !isRead,
      },
      data: { isRead },
    });

    await triggerSidebarEvents(isRead ? "read" : "unread", {
      ids,
      count: result.count,
      isRead,
      userId: user.id,
    });

    return {
      success: true,
      updatedCount: result.count,
      message: `${result.count} email${result.count !== 1 ? "s" : ""} marked as ${isRead ? "read" : "unread"}`,
    };
  } catch (error) {
    console.error("Read status action failed:", error);
    throw error;
  }
}

// ✅ Detail-page helper: mark read using Email ID (not recipient row id)
export async function markEmailAsReadByEmailIdAction(emailId: string) {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Unauthorized");

  const result = await prisma.emailRecipient.updateMany({
    where: {
      userId: user.id,
      emailId,
      isRead: false,
    },
    data: { isRead: true },
  });

  // refresh sidebar + realtime
  await triggerSidebarEvents("read", {
    ids: [emailId],
    count: result.count,
    isRead: true,
    userId: user.id,
  });

  return { success: true, updatedCount: result.count };
}

// ✅ Detail-page helper: toggle read/unread using Email ID (not recipient row id)
export async function toggleReadByEmailIdAction(emailId: string, isRead: boolean) {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Unauthorized");

  const result = await prisma.emailRecipient.updateMany({
    where: {
      userId: user.id,
      emailId,
    },
    data: { isRead },
  });

  await triggerSidebarEvents(isRead ? "read" : "unread", {
    ids: [emailId],
    count: result.count,
    isRead,
    userId: user.id,
  });

  return { success: true, updatedCount: result.count };
}

export async function toggleReadStatusAction(id: string, isRead: boolean) {
  return updateEmailReadStatusAction([id], isRead);
}

// =========================================================
// 8. SIDEBAR COUNTS
// =========================================================
export async function getSidebarCountsAction() {
  const { user } = await getCurrentSession();
  if (!user) return null;

  const userId = user.id;

  const [
    inboxCount,
    sentCount,
    draftsCount,

    archiveReceived,
    archiveSent,

    trashReceived,
    trashSent,

    spamReceived,
    spamSent,

    starredReceived,
    starredSent,

    allReceived,
    allSent,
  ] = await Promise.all([
    prisma.emailRecipient.count({ where: { userId, folder: "inbox" } }),

    prisma.email.count({ where: { senderId: userId, senderFolder: "sent" } }),

    prisma.email.count({ where: { senderId: userId, senderFolder: "drafts" } }),

    prisma.emailRecipient.count({ where: { userId, folder: "archive" } }),
    prisma.email.count({ where: { senderId: userId, senderFolder: "archive" } }),

    prisma.emailRecipient.count({ where: { userId, folder: "trash" } }),
    prisma.email.count({ where: { senderId: userId, senderFolder: "trash" } }),

    prisma.emailRecipient.count({ where: { userId, folder: "spam" } }),
    prisma.email.count({ where: { senderId: userId, senderFolder: "spam" } }),

    prisma.emailRecipient.count({
      where: { userId, isStarred: true, folder: { notIn: ["trash", "spam"] } },
    }),
    prisma.email.count({
      where: {
        senderId: userId,
        isStarred: true,
        senderFolder: { notIn: ["trash", "spam", "deleted"] },
      },
    }),

    prisma.emailRecipient.count({
      where: { userId, folder: { notIn: ["trash", "spam"] } },
    }),
    prisma.email.count({
      where: {
        senderId: userId,
        senderFolder: { notIn: ["trash", "spam", "drafts", "deleted"] },
      },
    }),
  ]);

  return {
    all: allReceived + allSent,
    inbox: inboxCount,
    sent: sentCount,
    drafts: draftsCount,
    trash: trashReceived + trashSent,
    starred: starredReceived + starredSent,
    archive: archiveReceived + archiveSent,
    spam: spamReceived + spamSent,
  };
}
