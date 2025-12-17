"use client";

import { useEffect, useState } from "react";

import { DashboardTourMount } from "@/components/tour/dashboard-tour-mount";
import { Navbar } from "@/components/navbar";
import { RbacProvider } from "@/lib/security/rbac-context";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import type { UnreadEmailData } from "@/components/email-menu";

type DashboardShellProps = {
  user: { id: string; name: string | null; email: string; image?: string | null };
  permissions: string[];
  brand?: { titleText?: string | null; logoLightUrl?: string | null; logoDarkUrl?: string | null; sidebarIconUrl?: string | null };
  currentLocale?: string;
  languages?: { code: string; name: string }[];
  emailData?: { count: number; items: UnreadEmailData[] };
  tenantKey: string;
  children: ReactNode;
};

export function DashboardShell({
  children,
  user,
  permissions,
  brand,
  currentLocale,
  languages,
  emailData,
  tenantKey,
}: DashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const openSidebar = () => setIsSidebarOpen(true);
    window.addEventListener("start-app-tour", openSidebar);
    return () => window.removeEventListener("start-app-tour", openSidebar);
  }, []);

  return (
    <RbacProvider permissions={permissions}>
      <DashboardTourMount userId={user.id} tenantKey={tenantKey} />

      <div className="flex min-h-screen bg-background text-foreground dark:bg-slate-950 dark:text-slate-50">
        <Sidebar
          user={{ name: user.name, email: user.email }}
          permissions={permissions}
          brand={brand}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
        />

        <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
          <Navbar user={user} currentLocale={currentLocale} languages={languages} emailData={emailData} />

          {/* ✅ content selector lives here always */}
          <main
            data-tour="content"
            className="flex-1 overflow-y-auto bg-background px-4 py-6 lg:px-6 xl:px-8 dark:bg-slate-950"
          >
            <div className="w-full">{children}</div>
          </main>
        </div>
      </div>
    </RbacProvider>
  );
}
