// lib/security/rbac-context.tsx
"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

// ✅ FIX: Export this type so Can.tsx can use it
export type PermissionKey = string;

type RbacContextValue = {
  permissions: string[];
  has: (perm: string) => boolean;
  canAny: (perms: string[] | string) => boolean;
  canAll: (perms: string[] | string) => boolean;
};

const RbacContext = createContext<RbacContextValue | null>(null);

export function RbacProvider({
  permissions,
  children,
}: {
  permissions: string[];
  children: ReactNode;
}) {
  const value = useMemo<RbacContextValue>(() => {
    const set = new Set(permissions ?? []);

    const normalize = (ps: string | string[]) =>
      Array.isArray(ps) ? ps : [ps];

    const has = (p: string) => set.has(p);
    const canAny = (ps: string[] | string) =>
      normalize(ps).some((p) => set.has(p));
    const canAll = (ps: string[] | string) =>
      normalize(ps).every((p) => set.has(p));

    const ctxValue: RbacContextValue = {
      permissions: [...set],
      has,
      canAny,
      canAll,
    };

    if (process.env.NODE_ENV !== "production") {
      console.debug("[RBAC] permissions:", ctxValue.permissions);
    }

    return ctxValue;
  }, [permissions]);

  return (
    <RbacContext.Provider value={value}>{children}</RbacContext.Provider>
  );
}

export function useRbac() {
  const ctx = useContext(RbacContext);
  if (!ctx) throw new Error("useRbac must be used within <RbacProvider>");
  return ctx;
}

export function useCan() {
  const { has, canAny, canAll, permissions } = useRbac();

  return {
    permissions,
    can: has,
    canAny,
    canAll,
  };
}