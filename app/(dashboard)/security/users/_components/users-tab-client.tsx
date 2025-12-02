// app/(dashboard)/security/users/_components/users-tab-client.tsx
"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Calendar,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Lock,
  Mail,
  Pencil,
  PlusCircle,
  RefreshCw,
  Shield,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createOrUpdateUserAction,
  deleteUserAction,
  toggleUserActiveAction,
} from "../users-actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DataTable,
  type CompanySettingsInfo,
  type BrandingSettingsInfo,
} from "@/components/data-table";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// --- Types ---
type RoleLite = { id: number; key: string; name: string };

export type UserForClient = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  isActive: boolean;
  avatarUrl?: string | null; // avatar from DB
  userRoles: {
    id: string;
    role: { key: string; name: string; scope: string };
    tenantId: string | null;
  }[];
};

type Props = {
  users: UserForClient[];
  assignableRoles: RoleLite[];
  centralRoleMap: Record<number, string>;
  currentUserId: string;
  tenantId: string | null;
  tenantName: string | null;
  permissions: string[];
  companySettings?: CompanySettingsInfo | null;
  brandingSettings?: BrandingSettingsInfo | null;
};

// --- Helpers ---

// Strong password generator (only used on interaction – no SSR impact)
function generateStrongPassword(length = 12) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

function initials(name?: string | null, email?: string) {
  const src = (name || email || "").trim();
  if (!src) return "??";
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src[0]!.toUpperCase();
}

// 🔐 Hydration-safe date formatter (same result on server & client)
const createdAtFormatter = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC",
});

function formatCreatedAt(dateStr: string) {
  try {
    return createdAtFormatter.format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function UsersTabClient({
  users,
  assignableRoles,
  centralRoleMap,
  currentUserId,
  tenantId,
  tenantName,
  permissions = [],
  companySettings,
  brandingSettings,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  // STRICT PERMISSIONS
  const has = (key: string) => permissions.includes(key);

  const canViewUsers = has("users.view") || has("manage_security");
  const canCreateUsers = has("users.create") || has("manage_security");
  const canUpdateUsers = has("users.update") || has("manage_security");
  const canDeleteUsers = has("users.delete") || has("manage_security");
  const canToggleUserActive = canUpdateUsers;

  const isTenantContext = !!tenantId;

  // --- State ---
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [viewDialogOpen, setViewDialogOpen] = React.useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = React.useState(false);
  const [bulkDeletableUsers, setBulkDeletableUsers] = React.useState<
    UserForClient[]
  >([]);
  const [editingUser, setEditingUser] = React.useState<UserForClient | null>(
    null
  );
  const [viewUser, setViewUser] = React.useState<UserForClient | null>(null);

  // detect if currently editing a superadmin for this context
  const isSuperadminEditing = React.useMemo(
    () =>
      editingUser
        ? editingUser.userRoles.some((ur) =>
            tenantId
              ? ur.role.key === "tenant_superadmin" && ur.tenantId === tenantId
              : ur.role.key === "central_superadmin" && ur.tenantId === null
          )
        : false,
    [editingUser, tenantId]
  );

  // Form State
  const [formName, setFormName] = React.useState("");
  const [formEmail, setFormEmail] = React.useState("");
  const [formPassword, setFormPassword] = React.useState("");
  const [formConfirmPassword, setFormConfirmPassword] = React.useState("");
  const [formRoleId, setFormRoleId] = React.useState<number | "">("");
  const [formAvatar, setFormAvatar] = React.useState<string | null>(null); // avatar url

  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const isProtectedUser = React.useCallback(
    (u: UserForClient) => {
      const isSelf = u.id === currentUserId;
      const isCentralSuperadmin = u.userRoles.some(
        (ur) => ur.role.key === "central_superadmin" && ur.tenantId === null
      );
      const isTenantSuperadmin = tenantId
        ? u.userRoles.some(
            (ur) =>
              ur.role.key === "tenant_superadmin" && ur.tenantId === tenantId
          )
        : false;
      return isSelf || isCentralSuperadmin || isTenantSuperadmin;
    },
    [currentUserId, tenantId]
  );

  function getPrimaryRoleName(u: UserForClient): string {
    if (tenantId) {
      const r = u.userRoles.find((ur) => ur.tenantId === tenantId);
      return r?.role.name ?? "Member";
    }
    const r = u.userRoles.find(
      (ur) => ur.role.scope === "CENTRAL" && ur.tenantId === null
    );
    return r?.role.name ?? "User";
  }

  function resetForm() {
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormConfirmPassword("");
    setFormRoleId(assignableRoles[0]?.id ?? "");
    setFormAvatar(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  function openCreate() {
    if (!canCreateUsers) return;
    setEditingUser(null);
    resetForm();
    setCreateDialogOpen(true);
  }

  function openEdit(user: UserForClient) {
    if (!canUpdateUsers) return;

    setEditingUser(user);
    setFormName(user.name || "");
    setFormEmail(user.email);
    setFormAvatar(user.avatarUrl ?? null);
    setShowPassword(false);
    setShowConfirmPassword(false);

    // detect if THIS user is superadmin in current context
    const isSuper = tenantId
      ? user.userRoles.some(
          (ur) =>
            ur.role.key === "tenant_superadmin" && ur.tenantId === tenantId
        )
      : user.userRoles.some(
          (ur) => ur.role.key === "central_superadmin" && ur.tenantId === null
        );

    if (isSuper) {
      // fake masked password, but we will NOT send it to backend
      setFormPassword("********");
      setFormConfirmPassword("********");
    } else {
      setFormPassword("");
      setFormConfirmPassword("");
    }

    // resolve roleId using centralRoleMap
    const primaryRoleName = getPrimaryRoleName(user);
    const roleEntry = Object.entries(centralRoleMap).find(
      ([, name]) => name === primaryRoleName
    );
    const resolvedRoleId = roleEntry ? Number(roleEntry[0]) : undefined;

    setFormRoleId(resolvedRoleId ?? "");
    setCreateDialogOpen(true);
  }

  function openView(user: UserForClient) {
    if (!canViewUsers) return;
    setViewUser(user);
    setViewDialogOpen(true);
  }

  function handleGeneratePassword() {
    const pwd = generateStrongPassword();
    setFormPassword(pwd);
    setFormConfirmPassword(pwd);
    setShowPassword(true);
    setShowConfirmPassword(true);
  }

  // File Manager avatar picker
  function handlePickAvatar() {
    if (typeof window === "undefined") return;

    window.dispatchEvent(
      new CustomEvent("open-file-manager", {
        detail: {
          filter: "images" as const,
          onSelect: (file: { url: string; id?: string; name?: string }) => {
            setFormAvatar(file.url);
          },
        },
      })
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isEdit = !!editingUser;

    if (isEdit && !canUpdateUsers) return;
    if (!isEdit && !canCreateUsers) return;

    // if editing superadmin, we completely skip password change
    const skipPasswordChange = isEdit && isSuperadminEditing;

    if (
      !skipPasswordChange &&
      formPassword &&
      formPassword !== formConfirmPassword
    ) {
      toast.error("Passwords do not match");
      return;
    }

    if (!isEdit && !formPassword) {
      toast.error("Password is required for new users");
      return;
    }

    const passwordToSend = skipPasswordChange
      ? null // never change superadmin password from this UI
      : formPassword || null;

    startTransition(async () => {
      try {
        await createOrUpdateUserAction({
          id: editingUser?.id ?? null,
          name: formName.trim(),
          email: formEmail.trim(),
          password: passwordToSend,
          roleId: Number(formRoleId),
          tenantId: tenantId ?? null,
          avatarUrl: formAvatar,
        });
        toast.success(isEdit ? "User updated successfully" : "User created");
        setCreateDialogOpen(false);
        router.refresh();
      } catch (err: any) {
        toast.error(err.message || "Failed to save user.");
      }
    });
  }

  function handleBulkDeleteConfirm() {
    if (!canDeleteUsers) return;
    startTransition(async () => {
      if (!bulkDeletableUsers.length) {
        setBulkDialogOpen(false);
        return;
      }
      let errors = 0;
      await Promise.all(
        bulkDeletableUsers.map(async (u) => {
          try {
            await deleteUserAction({ userId: u.id, tenantId });
          } catch {
            errors++;
          }
        })
      );
      router.refresh();
      if (errors > 0) toast.warning("Some users could not be deleted.");
      else toast.success("Selected users deleted.");
      setBulkDialogOpen(false);
      setBulkDeletableUsers([]);
    });
  }

  const columns = React.useMemo<ColumnDef<UserForClient>[]>(() => {
    return [
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex justify-center">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(val) => table.toggleAllPageRowsSelected(!!val)}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(val) => row.toggleSelected(!!val)}
            />
          </div>
        ),
      },
      {
        id: "name",
        accessorFn: (row) => `${row.name ?? ""} ${row.email}`,
        header: "User",
        cell: ({ row }) => {
          const u = row.original;
          const hasAvatar = !!u.avatarUrl;

          return (
            <div className="flex items-center gap-3">
              {hasAvatar ? (
                <div className="h-9 w-9 overflow-hidden rounded-full ring-2 ring-primary/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u.avatarUrl!}
                    alt={u.name || u.email}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-2 ring-background">
                  {initials(u.name, u.email)}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  {u.name || "Unknown"}
                </span>
                <span className="text-xs text-muted-foreground">{u.email}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: "role",
        header: "Role",
        accessorFn: (row) => getPrimaryRoleName(row),
        cell: ({ row }) => (
          <Badge variant="outline" className="bg-muted/50 font-normal">
            {getPrimaryRoleName(row.original)}
          </Badge>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (row) => (row.isActive ? "Active" : "Inactive"),
        cell: ({ row }) => {
          const u = row.original;
          const disabled =
            isProtectedUser(u) || isPending || !canToggleUserActive;

          return (
            <div className="flex items-center gap-2">
              <Switch
                checked={u.isActive}
                disabled={disabled}
                onCheckedChange={() =>
                  startTransition(async () => {
                    await toggleUserActiveAction({
                      userId: u.id,
                      newActive: !u.isActive,
                      tenantId,
                    });
                    router.refresh();
                    toast.success(
                      `User ${!u.isActive ? "activated" : "deactivated"}`
                    );
                  })
                }
              />
              <span
                className={`text-xs font-medium ${
                  u.isActive ? "text-emerald-600" : "text-muted-foreground"
                }`}
              >
                {u.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          );
        },
      },
      {
        id: "createdAt",
        header: "Joined",
        accessorFn: (row) => formatCreatedAt(row.createdAt),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatCreatedAt(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const u = row.original;
          const protectedUser = isProtectedUser(u);

          const viewDisabled = !canViewUsers;
          const editDisabled = !canUpdateUsers;
          const deleteDisabled = protectedUser || !canDeleteUsers;

          return (
            <div className="flex items-center justify-end gap-1">
              {/* VIEW */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-blue-500 hover:bg-blue-50"
                onClick={() => openView(u)}
                disabled={viewDisabled}
                title={viewDisabled ? "No permission" : "View Details"}
              >
                {viewDisabled ? (
                  <Lock className="h-3 w-3 opacity-70" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>

              {/* EDIT */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-500 hover:bg-amber-50"
                onClick={() => openEdit(u)}
                disabled={editDisabled}
                title={editDisabled ? "No permission" : "Edit User"}
              >
                {editDisabled ? (
                  <Lock className="h-3 w-3 opacity-70" />
                ) : (
                  <Pencil className="h-4 w-4" />
                )}
              </Button>

              {/* DELETE */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:bg-red-50"
                    disabled={deleteDisabled}
                    title={deleteDisabled ? "No permission" : "Delete User"}
                  >
                    {deleteDisabled ? (
                      <Lock className="h-3 w-3 opacity-50" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete User?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete <b>{u.email}</b>? This
                      action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 text-white"
                      onClick={() =>
                        startTransition(async () => {
                          await deleteUserAction({ userId: u.id, tenantId });
                          router.refresh();
                          toast.success("User deleted");
                        })
                      }
                    >
                      Delete User
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        },
      },
    ];
  }, [
    isProtectedUser,
    isPending,
    router,
    tenantId,
    canToggleUserActive,
    canUpdateUsers,
    canDeleteUsers,
    canViewUsers,
  ]);

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-1">
        <div>
          <h2 className="text-lg font-bold tracking-tight">
            {isTenantContext ? "Team Members" : "System Users"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage access for {tenantName || "the platform"}.
          </p>
        </div>

        {canCreateUsers && (
          <Button
            onClick={openCreate}
            className="bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      {/* TABLE */}
      <div className="rounded-md border bg-card shadow-sm">
        <DataTable
          columns={columns}
          data={users}
          searchColumnId="name"
          searchPlaceholder="Filter..."
          onRefresh={() => router.refresh()}
          fileName="users"
          companySettings={companySettings ?? undefined}
          brandingSettings={
            brandingSettings?.darkLogoUrl
              ? { darkLogoUrl: brandingSettings.darkLogoUrl }
              : undefined
          }
          onDeleteRows={async (rows) => {
            if (!canDeleteUsers) {
              toast.error("No permission to delete.");
              return;
            }
            setBulkDeletableUsers(rows.filter((u) => !isProtectedUser(u)));
            setBulkDialogOpen(true);
          }}
        />
      </div>

      {/* CREATE / EDIT DIALOG */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-primary" />
              {editingUser ? "Edit User" : "Create User"}
            </DialogTitle>
            <DialogDescription>
              Assign a role, credentials and profile photo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Avatar & basic info */}
            <div className="grid gap-4 md:grid-cols-[220px,1fr]">
              {/* Avatar card */}
              <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/40 p-4">
                <div className="relative h-20 w-20">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border bg-background shadow-sm">
                    {formAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={formAvatar}
                        alt={formName || formEmail || "Avatar"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-semibold text-primary">
                        {initials(formName, formEmail)}
                      </span>
                    )}
                  </div>
                  {formAvatar && (
                    <button
                      type="button"
                      className="absolute -right-1 -top-1 rounded-full bg-background p-1 shadow"
                      onClick={() => setFormAvatar(null)}
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2 text-center">
                  <p className="text-xs text-muted-foreground">
                    Profile photo (optional)
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handlePickAvatar}
                    className="justify-center"
                  >
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Choose from File Manager
                  </Button>
                </div>
              </div>

              {/* Name / Email / Role */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase text-muted-foreground">
                      Name
                    </label>
                    <input
                      className="w-full rounded border bg-background p-2 text-sm"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase text-muted-foreground">
                      Email
                    </label>
                    <input
                      type="email"
                      className="w-full rounded border bg-background p-2 text-sm"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      required
                      disabled={!!editingUser}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase text-muted-foreground">
                    Role
                  </label>

                  <select
                    className="w-full rounded border bg-background p-2 text-sm"
                    value={formRoleId}
                    onChange={(e) =>
                      setFormRoleId(
                        e.target.value ? Number(e.target.value) : ""
                      )
                    }
                    required
                    disabled={isSuperadminEditing}
                  >
                    {/* Normal users: allow selection */}
                    {!isSuperadminEditing && (
                      <option value="">Select role...</option>
                    )}

                    {/* Superadmin: show only their current role as fixed option */}
                    {isSuperadminEditing && editingUser && formRoleId && (
                      <option value={formRoleId}>
                        {getPrimaryRoleName(editingUser)}
                      </option>
                    )}

                    {/* Non-superadmin options */}
                    {!isSuperadminEditing &&
                      assignableRoles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>

                  {isSuperadminEditing && (
                    <p className="mt-1 text-[11px] text-amber-600">
                      Super administrator role cannot be changed.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Passwords */}
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Credentials
                </p>
                {!isSuperadminEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGeneratePassword}
                  >
                    <RefreshCw className="mr-1 h-3 w-3" /> Generate Password
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Password */}
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase text-muted-foreground">
                    {editingUser ? "New Password" : "Password"}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full rounded border bg-background p-2 pr-10 text-sm"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={editingUser ? "Leave blank to keep" : ""}
                      disabled={isSuperadminEditing && !!editingUser}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                      disabled={isSuperadminEditing && !!editingUser}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div className="space-y-1">
                  <label className="text-xs font-medium uppercase text-muted-foreground">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      className="w-full rounded border bg-background p-2 pr-10 text-sm"
                      value={formConfirmPassword}
                      onChange={(e) => setFormConfirmPassword(e.target.value)}
                      disabled={isSuperadminEditing && !!editingUser}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      disabled={isSuperadminEditing && !!editingUser}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {isSuperadminEditing && (
                <p className="pt-1 text-[11px] text-amber-600">
                  Super administrator password cannot be changed from this
                  screen.
                </p>
              )}
            </div>

            <div className="mt-2 flex justify-end gap-2 border-t pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {editingUser ? "Save Changes" : "Create User"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* VIEW USER DIALOG */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-primary" />
              {viewUser?.name || viewUser?.email}
            </DialogTitle>
            <DialogDescription>User account details</DialogDescription>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border bg-background shadow-sm">
                  {viewUser.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={viewUser.avatarUrl}
                      alt={viewUser.name || viewUser.email}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-semibold text-primary">
                      {initials(viewUser.name, viewUser.email)}
                    </span>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">
                    {viewUser.name || "Unnamed user"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getPrimaryRoleName(viewUser)}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{viewUser.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>{getPrimaryRoleName(viewUser)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Joined {formatCreatedAt(viewUser.createdAt)}
                  </span>
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">
                  All Roles
                </p>
                <div className="flex flex-wrap gap-1">
                  {viewUser.userRoles.map((ur) => (
                    <Badge
                      key={ur.id}
                      variant="secondary"
                      className="text-[10px]"
                    >
                      {ur.role.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewDialogOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* BULK DELETE CONFIRM */}
      <AlertDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected users?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to delete {bulkDeletableUsers.length} users. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mb-2 max-h-40 overflow-y-auto rounded border p-2 text-xs">
            {bulkDeletableUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-2">
                <span className="font-medium">{u.email}</span>
                <span className="text-muted-foreground">
                  ({getPrimaryRoleName(u)})
                </span>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleBulkDeleteConfirm}
            >
              Delete Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
