// lib/security-capabilities.ts
export type SecurityCapabilities = {
  canSeeSecurity: boolean;

  canCreateUsers: boolean;
  canUpdateUsers: boolean;
  canDeleteUsers: boolean;
  canToggleUserActive: boolean;

  canCreateRoles: boolean;
  canUpdateRoles: boolean;
  canDeleteRoles: boolean;

  canCreatePermissions: boolean;
  canUpdatePermissions: boolean;
  canDeletePermissions: boolean;
};

export function buildSecurityCapabilities(perms: string[]): SecurityCapabilities {
  const has = (k: string) => perms.includes(k);
  const hasAny = (keys: string[]) => keys.some(has);

  const canSeeSecurity = hasAny([
    "view_security",
    "manage_security",
    "manage_users",
    "manage_roles",
    "permissions.view",
  ]);

  // --- Users ---
  const canCreateUsers = hasAny([
    "users.create",
    "manage_users",
    "manage_security",
  ]);
  const canUpdateUsers = hasAny([
    "users.update",
    "manage_users",
    "manage_security",
  ]);
  const canDeleteUsers = hasAny([
    "users.delete",
    "manage_users",
    "manage_security",
  ]);
  const canToggleUserActive = canUpdateUsers; // same gate

  // --- Roles ---
  const canCreateRoles = hasAny([
    "roles.create",
    "manage_roles",
    "manage_security",
  ]);
  const canUpdateRoles = hasAny([
    "roles.update",
    "manage_roles",
    "manage_security",
  ]);
  const canDeleteRoles = hasAny([
    "roles.delete",
    "manage_roles",
    "manage_security",
  ]);

  // --- Permissions ---
  const canCreatePermissions = hasAny([
    "permissions.create",
    "manage_roles",
    "manage_security",
  ]);
  const canUpdatePermissions = hasAny([
    "permissions.update",
    "manage_roles",
    "manage_security",
  ]);
  const canDeletePermissions = hasAny([
    "permissions.delete",
    "manage_roles",
    "manage_security",
  ]);

  return {
    canSeeSecurity,
    canCreateUsers,
    canUpdateUsers,
    canDeleteUsers,
    canToggleUserActive,
    canCreateRoles,
    canUpdateRoles,
    canDeleteRoles,
    canCreatePermissions,
    canUpdatePermissions,
    canDeletePermissions,
  };
}
