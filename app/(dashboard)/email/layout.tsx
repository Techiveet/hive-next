// app/(dashboard)/email/layout.tsx

import { ComposeDialog } from "./_components/compose-dialog";
import { EmailSidebar } from "./_components/email-sidebar";
import { getCurrentSession } from "@/lib/auth-server";
import { getSidebarCountsAction } from "./email-actions"; // Import the shared count logic
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
  }).then((list) => list.map((item) => item.userId));
}

export default async function EmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await getCurrentSession();
  if (!user) redirect("/sign-in");

  // =========================================================================
  // 1. RECIPIENT FILTERING LOGIC (Keep existing logic)
  // =========================================================================
  const currentUserTenancies = await prisma.userTenant.findMany({
    where: { userId: user.id },
    select: { tenantId: true },
  });

  const isSingleTenantUser = currentUserTenancies.length === 1;
  const userTenantId = isSingleTenantUser ? currentUserTenancies[0].tenantId : null;

  let users: { id: string; name: string | null; email: string }[];

  if (isSingleTenantUser && userTenantId) {
    // A. TENANT USER: Filter recipients to users within the same tenant AND Central Admins.
    
    // Find IDs of all users associated with this tenant
    const tenantUserIds = await prisma.userTenant.findMany({
      where: { tenantId: userTenantId },
      select: { userId: true },
    }).then((list) => list.map((item) => item.userId));

    // Find Central Admin IDs
    const centralAdminIds = await getCentralAdminIds();

    const allAllowedIds = Array.from(new Set([...tenantUserIds, ...centralAdminIds]));

    // Fetch the actual user data for those IDs
    users = await prisma.user.findMany({
      where: {
        id: { in: allAllowedIds },
      },
      select: { id: true, name: true, email: true },
    });
  } else {
    // B. CENTRAL / MULTI-TENANT USER: Can see all users.
    users = await prisma.user.findMany({
      select: { id: true, name: true, email: true },
    });
  }

  // Final filter: exclude the current user from the TO/CC/BCC selection list
  const filteredRecipients = users.filter((u) => u.id !== user.id);


  // =========================================================================
  // 2. FETCH COUNTS (Using the shared Server Action)
  // =========================================================================
  // This ensures the initial load matches the realtime updates perfectly.
  const counts = await getSidebarCountsAction() || {
    all: 0,
    inbox: 0,
    sent: 0,
    drafts: 0,
    trash: 0,
    starred: 0,
    archive: 0,
    spam: 0,
  };

  // =========================================================================
  // 3. RENDER LAYOUT
  // =========================================================================
  return (
    <div className="h-[calc(100vh-64px)] w-full bg-slate-50/50 p-4 dark:bg-slate-950 print:bg-white print:h-auto print:p-0 print:overflow-visible">
      <div className="mx-auto grid h-full max-w-[1600px] grid-cols-1 gap-4 lg:grid-cols-[240px_380px_1fr] print:block">
        
        {/* Sidebar Area */}
        <aside className="hidden h-full flex-col gap-4 lg:flex print:hidden">
          <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
             <ComposeDialog users={filteredRecipients} />
          </div>
          <EmailSidebar initialCounts={counts} userId={user.id} />
        </aside>
        
        {/* Main Content (Email List + Detail) */}
        {children}
      </div>
    </div>
  );
}