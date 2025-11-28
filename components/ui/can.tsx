// components/ui/can.tsx
"use client";

import { usePermissions } from "@/components/providers/permissions-provider";

interface CanProps {
  permission: string | string[]; // Single string or array of strings (OR check)
  children: React.ReactNode;
}

export function Can({ permission, children }: CanProps) {
  const { has, hasAny } = usePermissions();

  if (Array.isArray(permission)) {
    return hasAny(permission) ? <>{children}</> : null;
  }

  return has(permission) ? <>{children}</> : null;
}