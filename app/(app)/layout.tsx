// src/app/(app)/layout.tsx

import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { getCurrentSession } from "@/lib/auth-server";
import { getCurrentUserPermissions } from "@/lib/rbac";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  // 1) Current user (Better Auth)
  const { user } = await getCurrentSession();

  // 2) Determine tenant context (null = central)
  // If later you resolve tenant from domain/URL, replace null.
  const currentTenantId: string | null = null;

  // 3) Load permissions for this user in this context
  const permissions = await getCurrentUserPermissions(currentTenantId);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50">
      <Sidebar
        user={
          user
            ? {
                name: user.name ?? null,
                email: user.email!,
              }
            : undefined
        }
        permissions={permissions}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
