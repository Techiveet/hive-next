import { ComposeDialog } from "./_components/compose-dialog";
import { EmailSidebar } from "./_components/email-sidebar";
import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function EmailLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getCurrentSession();
  if (!user) redirect("/sign-in");

  const users = await prisma.user.findMany({
    where: { id: { not: user.id } },
    select: { id: true, name: true, email: true }
  });

  // ✅ Fetch Counts (Checking BOTH tables for full accuracy)
  const [
    inboxCount, 
    sentCount, 
    draftCount, 
    trashRecipients, trashSent,
    archiveRecipients, archiveSent,
    starredRecipients, starredSent
  ] = await Promise.all([
    // Inbox
    prisma.emailRecipient.count({ where: { userId: user.id, folder: "inbox" } }),
    // Sent (only actual sent, not trash/drafts)
    prisma.email.count({ where: { senderId: user.id, senderFolder: "sent" } }),
    // Drafts
    prisma.email.count({ where: { senderId: user.id, senderFolder: "drafts" } }),
    // Trash (Combine both)
    prisma.emailRecipient.count({ where: { userId: user.id, folder: "trash" } }),
    prisma.email.count({ where: { senderId: user.id, senderFolder: "trash" } }),
    // Archive (Combine both)
    prisma.emailRecipient.count({ where: { userId: user.id, folder: "archive" } }),
    prisma.email.count({ where: { senderId: user.id, senderFolder: "archive" } }),
    // Starred (Combine both)
    prisma.emailRecipient.count({ where: { userId: user.id, isStarred: true } }),
    prisma.email.count({ where: { senderId: user.id, isStarred: true } }),
  ]);

  const counts = {
    all: inboxCount + sentCount + archiveRecipients + archiveSent,
    inbox: inboxCount, 
    sent: sentCount,
    drafts: draftCount,
    trash: trashRecipients + trashSent, 
    starred: starredRecipients + starredSent, 
    archive: archiveRecipients + archiveSent
  };

  return (
    <div className="h-[calc(100vh-64px)] w-full bg-slate-50/50 p-4 dark:bg-slate-950">
      <div className="mx-auto grid h-full max-w-[1600px] grid-cols-1 gap-4 lg:grid-cols-[240px_380px_1fr]">
        <aside className="hidden h-full flex-col gap-4 lg:flex">
          <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
             <ComposeDialog users={users} />
          </div>
          <EmailSidebar initialCounts={counts} userId={user.id} />
        </aside>
        {children}
      </div>
    </div>
  );
}