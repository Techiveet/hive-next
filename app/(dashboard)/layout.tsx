// app/(dashboard)/layout.tsx

import { DashboardShell } from "@/components/dashboard-shell";
import type { ReactNode } from "react";
import { getCurrentSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = await getCurrentSession();

  if (!user) {
    redirect("/sign-in?callbackURL=/");
  }

  return (
    <DashboardShell
      user={{ name: user.name ?? null, email: user.email }}
    >
      {children}
    </DashboardShell>
  );
}
