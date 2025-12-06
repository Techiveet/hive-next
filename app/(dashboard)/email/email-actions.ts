"use server";

import { getCurrentSession } from "@/lib/auth-server"; // Adjust path to your auth
import { prisma } from "@/lib/prisma"; // Adjust path to your prisma
import { revalidatePath } from "next/cache";

// ==========================================
// 1. SEND EMAIL
// ==========================================
export async function sendEmailAction(data: {
  toIds: string[];
  subject: string;
  body: string;
}) {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Unauthorized");

  // 1. Create the email record
  const email = await prisma.email.create({
    data: {
      subject: data.subject,
      body: data.body,
      senderId: user.id,
      senderFolder: "sent", // Explicitly set as sent
      recipients: {
        create: data.toIds.map((id) => ({
          userId: id,
          folder: "inbox",
          isRead: false,
        })),
      },
    },
  });

  // 2. Trigger Real-time Notifications (Socket)
  try {
    const senderNameStr = user.name || user.email || "Unknown Sender";
    const preview = (data.body || "").substring(0, 50) + "...";
    
    const notificationPayload = {
      id: email.id,
      subject: email.subject || "(No Subject)",
      senderId: user.id,
      senderName: senderNameStr,
      preview,
      createdAt: email.createdAt,
    };

    const SOCKET_URL = "http://localhost:3001/trigger-email"; // Ensure this matches your server
    
    // Notify Recipients
    await fetch(SOCKET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toIds: data.toIds,
        emailData: notificationPayload,
        type: "new-email" 
      }),
    });

    // Notify Sender (so their 'Sent' folder updates instantly)
    await fetch(SOCKET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toIds: [user.id],
        emailData: { id: email.id },
        type: "email-sent"
      }),
    });
  } catch (error) {
    console.error("⚠️ Socket error:", error);
    // Don't block the function if socket fails
  }

  revalidatePath("/email");
  return { success: true };
}

// ==========================================
// 2. SAVE DRAFT
// ==========================================
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
      senderFolder: "drafts", // Save to drafts
      // We don't create recipients for drafts yet
    },
  });

  revalidatePath("/email");
  return { success: true, id: email.id };
}

// ==========================================
// 3. ARCHIVE EMAILS (The Fix)
// ==========================================
export async function archiveEmailsAction(emailIds: string[]) {
  const { user } = await getCurrentSession();
  if (!user) return;

  // We run two updates in parallel to cover both cases:
  // 1. If the user is a RECIPIENT of these emails
  // 2. If the user is the SENDER of these emails
  
  await Promise.all([
    // Update received emails: Change folder to 'archive'
    prisma.emailRecipient.updateMany({
      where: { 
        userId: user.id, 
        emailId: { in: emailIds } 
      },
      data: { folder: "archive" },
    }),

    // Update sent emails: Change senderFolder to 'archive'
    prisma.email.updateMany({
      where: { 
        senderId: user.id, 
        id: { in: emailIds } 
      },
      data: { senderFolder: "archive" },
    }),
  ]);
  
  revalidatePath("/email");
}

// ==========================================
// 4. DELETE / TRASH EMAILS
// ==========================================
export async function deleteEmailsAction(emailIds: string[], currentFolder: string) {
  const { user } = await getCurrentSession();
  if (!user) return;

  if (currentFolder === "trash") {
    // 🛑 HARD DELETE (Permanently remove)
    await Promise.all([
      // Delete recipient records
      prisma.emailRecipient.deleteMany({
        where: { userId: user.id, emailId: { in: emailIds } },
      }),
      // Delete sent records (Only if I sent them)
      prisma.email.deleteMany({
        where: { senderId: user.id, id: { in: emailIds } }
      })
    ]);
  } else {
    // ♻️ SOFT DELETE (Move to Trash)
    await Promise.all([
      // Move received emails to trash
      prisma.emailRecipient.updateMany({
        where: { userId: user.id, emailId: { in: emailIds } },
        data: { folder: "trash" },
      }),
      // Move sent emails to trash
      prisma.email.updateMany({
        where: { senderId: user.id, id: { in: emailIds } },
        data: { senderFolder: "trash" },
      }),
    ]);
  }
  
  revalidatePath("/email");
}

// ==========================================
// 5. TOGGLE STAR
// ==========================================
export async function toggleStarAction(emailId: string, isStarred: boolean) {
  const { user } = await getCurrentSession();
  if (!user) return;

  await Promise.all([
    // Update if I received it
    prisma.emailRecipient.updateMany({
      where: { emailId, userId: user.id },
      data: { isStarred },
    }),
    // Update if I sent it
    prisma.email.updateMany({
      where: { id: emailId, senderId: user.id },
      data: { isStarred },
    }),
  ]);

  revalidatePath("/email");
}

// ==========================================
// 6. MARK AS READ
// ==========================================
export async function markEmailAsReadAction(emailId: string) {
  const { user } = await getCurrentSession();
  if (!user) return;

  await prisma.emailRecipient.updateMany({
    where: { 
      emailId: emailId, 
      userId: user.id, 
      isRead: false 
    },
    data: { isRead: true },
  });
  
  revalidatePath("/email"); 
}