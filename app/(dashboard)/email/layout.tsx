





// app/(dashboard)/email/layout.tsx
"use server";

import { ComposeDialog } from "./_components/compose-dialog";
import { EmailSidebar } from "./_components/email-sidebar";
import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

// Helper function to get Central Admin IDs
async function getCentralAdminIds() {
    const centralRole = await prisma.role.findFirst({
        where: { key: "central_superadmin", tenantId: null },
        select: { id: true },
    });

    if (!centralRole) return [];

    return prisma.userRole.findMany({
        where: { roleId: centralRole.id, tenantId: null },
        select: { userId: true },
    }).then(list => list.map(item => item.userId));
}

export default async function EmailLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getCurrentSession();
  if (!user) redirect("/sign-in");

  // --- RECIPIENT FILTERING LOGIC ---
  const currentUserTenancies = await prisma.userTenant.findMany({
      where: { userId: user.id },
      select: { tenantId: true }
  });
  
  const isSingleTenantUser = currentUserTenancies.length === 1;
  const userTenantId = isSingleTenantUser ? currentUserTenancies[0].tenantId : null;
  
  let users: { id: string; name: string | null; email: string }[];
  
  if (isSingleTenantUser && userTenantId) {
    // 1. TENANT USER: Filter recipients to users within the same tenant AND Central Admins.
    
    // Find IDs of all users associated with this tenant
    const tenantUserIds = await prisma.userTenant.findMany({
        where: { tenantId: userTenantId },
        select: { userId: true }
    }).then(list => list.map(item => item.userId));

    // Find Central Admin IDs
    const centralAdminIds = await getCentralAdminIds(); // <== NEW: Get Central Admin IDs

    const allAllowedIds = Array.from(new Set([...tenantUserIds, ...centralAdminIds]));

    // Fetch the actual user data for those IDs
    users = await prisma.user.findMany({
      where: {
        id: { in: allAllowedIds }, 
      },
      select: { id: true, name: true, email: true }
    });
    
  } else {
    // 2. CENTRAL / MULTI-TENANT USER: Can see all users.
    users = await prisma.user.findMany({
      select: { id: true, name: true, email: true }
    });
  }

  // Final filter: exclude the current user from the TO/CC/BCC selection list
  const filteredRecipients = users.filter(u => u.id !== user.id); 
  // ------------------------------------

  // ... rest of the component (Count calculation is unchanged) ...

  const [
    inboxCount, 
    sentCount, 
    draftCount, 
    trashRecipients, trashSent,
    archiveRecipients, archiveSent,
    starredRecipients, starredSent
  ] = await Promise.all([
    prisma.emailRecipient.count({ where: { userId: user.id, folder: "inbox" } }),
    prisma.email.count({ where: { senderId: user.id, senderFolder: "sent" } }),
    prisma.email.count({ where: { senderId: user.id, senderFolder: "drafts" } }),
    prisma.emailRecipient.count({ where: { userId: user.id, folder: "trash" } }),
    prisma.email.count({ where: { senderId: user.id, senderFolder: "trash" } }),
    prisma.emailRecipient.count({ where: { userId: user.id, folder: "archive" } }),
    prisma.email.count({ where: { senderId: user.id, senderFolder: "archive" } }),
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
    <div className="h-[calc(100vh-64px)] w-full bg-slate-50/50 p-4 dark:bg-slate-950 print:bg-white print:h-auto print:p-0 print:overflow-visible">
      
      <div className="mx-auto grid h-full max-w-[1600px] grid-cols-1 gap-4 lg:grid-cols-[240px_380px_1fr] print:block">
        
        <aside className="hidden h-full flex-col gap-4 lg:flex print:hidden">
          <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
             <ComposeDialog users={filteredRecipients} />
          </div>
          <EmailSidebar initialCounts={counts} userId={user.id} />
        </aside>
        
        {children}
      </div>
    </div>
  );
}