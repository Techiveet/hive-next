"use client";

import type { Dispatch, SetStateAction } from "react"; // ✅ Import utility types

import { Navbar } from "@/components/navbar";
import { RbacProvider } from "@/lib/security/rbac-context";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import type { UnreadEmailData } from "@/components/email-menu";
import { useState } from "react";

// 1. Define the props expected by the Sidebar component
// This resolves the Type Error saying 'isOpen' does not exist on SidebarProps
type SidebarProps = {
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
  isOpen: boolean; // ⬅️ ADDED
  setIsOpen: Dispatch<SetStateAction<boolean>>; // ⬅️ ADDED
};

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

  // ✅ New Prop
  emailData?: {
    count: number;
    items: UnreadEmailData[];
  };

  children: ReactNode;
};

// 2. Type cast the Sidebar import to ensure it accepts the SidebarProps defined above
// This is done to satisfy the TypeScript error.
const TypedSidebar = Sidebar as React.FC<SidebarProps>;

export function DashboardShell({
  children,
  user,
  permissions = [],
  brand,
  currentLocale,
  languages,
  emailData,
}: DashboardShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <RbacProvider permissions={permissions}>
      <div className="flex min-h-screen bg-background text-foreground dark:bg-slate-950 dark:text-slate-50">
        {/* 3. Use the typed Sidebar component */}
        <TypedSidebar
          user={user}
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

          <main className="flex-1 bg-background px-4 py-6 lg:px-6 xl:px-8 dark:bg-slate-950 overflow-y-auto">
            <div className="w-full">{children}</div>
          </main>
        </div>
      </div>
    </RbacProvider>
  );
}
