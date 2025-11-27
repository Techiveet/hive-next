// components/dashboard-shell.tsx

import { Navbar } from "@/components/navbar";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";

type DashboardShellProps = {
  children: ReactNode;
  user?: {
    name: string | null;
    email: string;
  };
  permissions?: string[]; // NEW
};

export function DashboardShell({
  children,
  user,
  permissions = [],
}: DashboardShellProps) {
  return (
    <div className="flex min-h-screen bg-background text-foreground dark:bg-slate-950 dark:text-slate-50">
      {/* Left sidebar */}
      <Sidebar user={user} permissions={permissions} />

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Top navbar */}
        <Navbar user={user} />

        {/* Page content */}
        <main className="flex-1 bg-background px-4 py-6 lg:px-6 xl:px-8 dark:bg-slate-950">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
