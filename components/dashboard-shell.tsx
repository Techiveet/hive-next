"use client";

import { useEffect, useState } from "react";

import { DashboardTourMount } from "@/components/tour/dashboard-tour-mount";
import { Navbar } from "@/components/navbar";
import { RbacProvider } from "@/lib/security/rbac-context";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import type { UnreadEmailData } from "@/components/email-menu";

type DashboardShellProps = {
  user: {
    id: string;
    name: string | null;
    email: string;
    image?: string | null;
  };
  permissions: string[];
  brand?: {
    titleText?: string | null;
    logoLightUrl?: string | null;
    logoDarkUrl?: string | null;
    sidebarIconUrl?: string | null;
  };
  currentLocale?: string;
  languages?: { code: string; name: string }[];
  emailData?: {
    count: number;
    items: UnreadEmailData[];
  };

  // ✅ ADD: tenant key (tenant-aware tour)
  tenantKey: string;

  children: ReactNode;
};

export function DashboardShell({
  children,
  user,
  permissions = [],
  brand,
  currentLocale,
  languages,
  emailData,
  tenantKey,
}: DashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // ✅ When tour starts, ensure sidebar is open (important for mobile + selector existence)
  useEffect(() => {
    const handler = () => setIsSidebarOpen(true);
    window.addEventListener("start-app-tour", handler);
    return () => window.removeEventListener("start-app-tour", handler);
  }, []);

  return (
    <RbacProvider permissions={permissions}>
      {/* ✅ Mount tour ONLY HERE (client). Tenant-aware. */}
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
          <Navbar
            user={user}
            currentLocale={currentLocale}
            languages={languages}
            emailData={emailData}
          />

          <main
            data-tour="content"
            className="flex-1 bg-background px-4 py-6 lg:px-6 xl:px-8 dark:bg-slate-950 overflow-y-auto"
          >
            <div className="w-full">{children}</div>
          </main>
        </div>
      </div>
    </RbacProvider>
  );
}
