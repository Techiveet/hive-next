// components/rbac-provider-client.tsx
"use client";

import { RbacProvider } from "@/lib/security/rbac-context";
import { ReactNode } from "react";

type Props = {
  userId: string;
  tenantId: string | null;
  roleKeys?: string[];       // Changed from RoleKey to string[]
  permissionKeys: string[];  // Changed from PermissionKey to string[]
  children: ReactNode;
};

export function RbacProviderClient({
  userId,
  tenantId,
  roleKeys = [],
  permissionKeys,
  children,
}: Props) {
  // The RbacProvider in your lib only accepts 'permissions'
  // We pass 'permissionKeys' to it. 
  // (userId, tenantId, and roleKeys are currently ignored by the provider context based on your code)
  return (
    <RbacProvider permissions={permissionKeys}>
      {children}
    </RbacProvider>
  );
}