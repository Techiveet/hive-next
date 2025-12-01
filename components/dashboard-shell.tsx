// components/dashboard-shell.tsx

import { Navbar } from "@/components/navbar";
import { RbacProvider } from "@/lib/security/rbac-context";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";

type DashboardShellProps = {
  user: { name: string | null; email: string };
  permissions: string[];
  // ✅ Ensure this type definition exists
  brand?: {
    titleText?: string | null;
    logoLightUrl?: string | null;
    logoDarkUrl?: string | null;
    sidebarIconUrl?: string | null;
  };
  children: ReactNode;
};

export function DashboardShell({
  children,
  user,
  permissions = [],
  brand, // ✅ 1. Receive it here
}: DashboardShellProps) {
  return (
    <RbacProvider permissions={permissions}>
      <div className="flex min-h-screen bg-background text-foreground dark:bg-slate-950 dark:text-slate-50">
        
        {/* ✅ 2. Pass it down here! */}
        <Sidebar user={user} permissions={permissions} brand={brand} />

        <div className="flex min-h-screen flex-1 flex-col">
          <Navbar user={user} />
          <main className="flex-1 bg-background px-4 py-6 lg:px-6 xl:px-8 dark:bg-slate-950">
            <div className="w-full">{children}</div>
          </main>
        </div>
      </div>
    </RbacProvider>
  );
}