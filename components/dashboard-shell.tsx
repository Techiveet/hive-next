"use client";

import { Navbar } from "@/components/navbar";
import { RbacProvider } from "@/lib/security/rbac-context";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { useState } from "react";

type DashboardShellProps = {
  user: { name: string | null; email: string };
  permissions: string[];
  brand?: {
    titleText?: string | null;
    logoLightUrl?: string | null;
    logoDarkUrl?: string | null;
    sidebarIconUrl?: string | null;
  };
  // ✅ 1. Add these types
  currentLocale?: string;
  languages?: { code: string; name: string }[];
  children: ReactNode;
};

export function DashboardShell({
  children,
  user,
  permissions = [],
  brand,
  // ✅ 2. Destructure them here
  currentLocale,
  languages,
}: DashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <RbacProvider permissions={permissions}>
      <div className="flex min-h-screen bg-background text-foreground dark:bg-slate-950 dark:text-slate-50">
        <Sidebar 
            user={user} 
            permissions={permissions} 
            brand={brand}
            isOpen={isSidebarOpen} 
            setIsOpen={setIsSidebarOpen} 
        />

        <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
          {/* ✅ 3. Pass them to Navbar here */}
          <Navbar 
             user={user} 
             currentLocale={currentLocale} 
             languages={languages} 
          />
          
          <main className="flex-1 bg-background px-4 py-6 lg:px-6 xl:px-8 dark:bg-slate-950 overflow-y-auto">
            <div className="w-full">{children}</div>
          </main>
        </div>
      </div>
    </RbacProvider>
  );
}