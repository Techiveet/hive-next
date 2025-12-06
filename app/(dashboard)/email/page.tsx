import { EmailList } from "./_components/email-list";
import { Mail } from "lucide-react";
import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const { user } = await getCurrentSession();
  if (!user) redirect("/sign-in");

  const params = await searchParams;
  const folder = params.folder || "inbox";

  let emails = [];

  if (folder === "sent") {
    // ✅ Fix: Only show items explicitly in 'sent' folder (not trash/archive)
    emails = await prisma.email.findMany({
      where: { 
        senderId: user.id,
        senderFolder: "sent" 
      },
      include: { sender: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
  } else if (folder === "all") {
    // ✅ Fix: Get everything NOT in trash
    const [sent, received] = await Promise.all([
      prisma.email.findMany({
        where: { 
            senderId: user.id,
            senderFolder: { not: "trash" } // Exclude trash from All Mails
        },
        include: { sender: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.emailRecipient.findMany({
        where: { 
            userId: user.id,
            folder: { not: "trash" } // Exclude trash
        },
        include: {
          email: { include: { sender: { select: { name: true, email: true } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Deduplicate
    const uniqueMap = new Map();
    [...sent, ...received].forEach((item) => {
      // @ts-ignore
      const id = item.email?.id || item.id;
      if (!uniqueMap.has(id)) uniqueMap.set(id, item);
    });

    emails = Array.from(uniqueMap.values()).sort((a, b) => {
      // @ts-ignore
      const dateA = new Date(a.createdAt || a.email?.createdAt).getTime();
      // @ts-ignore
      const dateB = new Date(b.createdAt || b.email?.createdAt).getTime();
      return dateB - dateA;
    });

  } else if (folder === "trash") {
     // ✅ Fix: Fetch Trash from BOTH sides
     const [sentTrash, receivedTrash] = await Promise.all([
      prisma.email.findMany({
        where: { senderId: user.id, senderFolder: "trash" },
        include: { sender: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.emailRecipient.findMany({
        where: { userId: user.id, folder: "trash" },
        include: {
          email: { include: { sender: { select: { name: true, email: true } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    emails = [...sentTrash, ...receivedTrash].sort((a, b) => {
        // @ts-ignore
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  } else if (folder === "starred") {
      // ✅ Fix: Fetch Starred from BOTH sides
      const [sentStarred, receivedStarred] = await Promise.all([
        prisma.email.findMany({
            where: { senderId: user.id, isStarred: true, senderFolder: { not: "trash" } },
            include: { sender: { select: { name: true, email: true } } },
        }),
        prisma.emailRecipient.findMany({
            where: { userId: user.id, isStarred: true, folder: { not: "trash" } },
            include: { email: { include: { sender: { select: { name: true, email: true } } } } },
        }),
      ]);
      // Deduplicate & Sort
      const uniqueMap = new Map();
      [...sentStarred, ...receivedStarred].forEach((item) => {
        // @ts-ignore
        const id = item.email?.id || item.id;
        if (!uniqueMap.has(id)) uniqueMap.set(id, item);
      });
      emails = Array.from(uniqueMap.values()).sort((a, b) => {
        // @ts-ignore
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

  } else {
    // Generic Folders (Inbox, Archive, Drafts)
    // For Sent/Drafts we might need to check Email table if we used senderFolder logic there
    // But for now assuming Inbox/Archive/Drafts exist in Recipients logic for simplicity
    // EXCEPT drafts which we pushed to sender logic.
    
    if (folder === "drafts") {
         emails = await prisma.email.findMany({
            where: { senderId: user.id, senderFolder: "drafts" },
            include: { sender: { select: { name: true, email: true } } },
            orderBy: { createdAt: "desc" },
         });
    } else {
         emails = await prisma.emailRecipient.findMany({
            where: { userId: user.id, folder: folder },
            include: {
                email: { include: { sender: { select: { name: true, email: true } } } },
            },
            orderBy: { createdAt: "desc" },
         });
    }
  }

  // Transform data
  const formattedEmails = emails.map((e) => {
    // @ts-ignore
    const emailData = e.email || e;
    return {
      id: emailData.id,
      // @ts-ignore
      isRead: e.isRead ?? true,
      // @ts-ignore
      isStarred: e.isStarred ?? emailData.isStarred ?? false, // Check both
      email: {
        id: emailData.id,
        subject: emailData.subject,
        body: emailData.body,
        createdAt: emailData.createdAt,
        sender: emailData.sender,
      },
    };
  });

  return (
    <>
      {/* COL 2: EMAIL LIST */}
      <div className="h-full w-full lg:w-[380px] min-w-0">
        <EmailList
          initialEmails={formattedEmails}
          currentUserId={user.id}
          folderName={folder}
        />
      </div>

      {/* COL 3: PLACEHOLDER */}
      <div className="hidden flex-1 lg:flex h-full flex-col items-center justify-center rounded-xl bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 p-8 text-center">
        <div className="relative mb-6 rounded-full bg-slate-50 p-6 dark:bg-slate-800">
          <Mail className="h-12 w-12 text-slate-300" />
          <div className="absolute right-5 top-5 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-slate-900" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Select an email to read
        </h2>
        <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto">
          Choose a message from the list to view its details.
        </p>
      </div>
    </>
  );
}