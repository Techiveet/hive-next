// lib/security/Can.tsx
"use client";

import { PermissionKey, useCan } from "./rbac-context";
import React, { ReactNode } from "react";

type Props = {
  anyOf?: PermissionKey[];
  allOf?: PermissionKey[];
  fallback?: ReactNode;
  children: ReactNode;
};

export function Can({ anyOf, allOf, fallback = null, children }: Props) {
  // ✅ FIX: Call hook unconditionally at the top level
  // Destructure the helper functions from the object returned by useCan()
  const { canAny, canAll } = useCan();

  // ✅ FIX: Use the helper functions directly
  const allowedAny = anyOf && anyOf.length ? canAny(anyOf) : true;
  const allowedAll = allOf && allOf.length ? canAll(allOf) : true;

  if (allowedAny && allowedAll) return <>{children}</>;
  return <>{fallback}</>;
}