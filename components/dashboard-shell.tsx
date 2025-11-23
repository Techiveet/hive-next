import { Navbar } from "@/components/navbar";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";

type DashboardShellProps = {
  children: ReactNode;
  user?: {
    name: string | null;
    email: string;
  };
};

export function DashboardShell({ children, user }: DashboardShellProps) {
  return (
    <div className="flex min-h-screen bg-background text-foreground dark:bg-slate-950 dark:text-slate-50">
      <Sidebar user={user} />

      <div className="flex min-h-screen flex-1 flex-col">
        <Navbar user={user} />

        <main className="flex-1 bg-background px-4 py-6 dark:bg-slate-950">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
