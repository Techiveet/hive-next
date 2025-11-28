"use client";

import React, { createContext, useContext } from "react";

type PermissionsContextType = {
  permissions: string[];
  has: (permission: string) => boolean;
  hasAny: (permissions: string[]) => boolean;
};

const PermissionsContext = createContext<PermissionsContextType | undefined>(
  undefined
);

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: string[];
  children: React.ReactNode;
}) {
  // Check if a single permission exists
  const has = (permission: string) => {
    return permissions.includes(permission);
  };

  // Check if ANY of the provided permissions exist
  const hasAny = (keys: string[]) => {
    return keys.some((k) => permissions.includes(k));
  };

  return (
    <PermissionsContext.Provider value={{ permissions, has, hasAny }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}