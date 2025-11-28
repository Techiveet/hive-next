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
  Lock,
  Mail,
  Pencil,
  PlusCircle,
  RefreshCw,
  Shield,
  Trash2,
  User as UserIcon,
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
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// --- Types ---
type RoleLite = { id: number; key: string; name: string };
type UserForClient = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  isActive: boolean;
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
};

// --- Helpers ---
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

export function UsersTabClient({
  users,
  assignableRoles,
  centralRoleMap,
  currentUserId,
  tenantId,
  tenantName,
  permissions = [],
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  // 1. STRICT PERMISSIONS
  const has = (key: string) => permissions.includes(key);

  const canViewUsers = has("users.view");
  const canCreateUsers = has("users.create");
  const canUpdateUsers = has("users.update");
  const canDeleteUsers = has("users.delete");
  const canToggleUserActive = canUpdateUsers;

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

  // Form State
  const [formName, setFormName] = React.useState("");
  const [formEmail, setFormEmail] = React.useState("");
  const [formPassword, setFormPassword] = React.useState("");
  const [formConfirmPassword, setFormConfirmPassword] = React.useState("");
  const [formRoleId, setFormRoleId] = React.useState<number | "">("");

  // 🔐 password visibility
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const isTenantContext = !!tenantId;

  // --- Logic ---
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
    setFormPassword("");
    setFormConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);

    let currentRoleKey: string | undefined;
    if (tenantId) {
      const r = user.userRoles.find((ur) => ur.tenantId === tenantId);
      currentRoleKey = r?.role.key;
    } else {
      const r = user.userRoles.find(
        (ur) => ur.role.scope === "CENTRAL" && ur.tenantId === null
      );
      currentRoleKey = r?.role.key;
    }

    const match = assignableRoles.find((r) => r.key === currentRoleKey);
    setFormRoleId(match?.id ?? "");
    setCreateDialogOpen(true);
  }

  function openView(user: UserForClient) {
    if (!canViewUsers) return;
    setViewUser(user);
    setViewDialogOpen(true);
  }

  // 🔑 generate + sync confirm password
  function handleGeneratePassword() {
    const pwd = generateStrongPassword();
    setFormPassword(pwd);
    setFormConfirmPassword(pwd);
    setShowPassword(true);
    setShowConfirmPassword(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isEdit = !!editingUser;

    if (isEdit && !canUpdateUsers) return;
    if (!isEdit && !canCreateUsers) return;

    if (formPassword && formPassword !== formConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!editingUser && !formPassword) {
      toast.error("Password is required for new users");
      return;
    }

    startTransition(async () => {
      try {
        await createOrUpdateUserAction({
          id: editingUser?.id ?? null,
          name: formName.trim(),
          email: formEmail.trim(),
          password: formPassword || null,
          roleId: Number(formRoleId),
          tenantId: tenantId ?? null,
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
          } catch (err: any) {
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

  // --- Table Columns ---
  const columns = React.useMemo<ColumnDef<UserForClient>[]>(
    () => [
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
          return (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-2 ring-background">
                {initials(u.name, u.email)}
              </div>
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

      // 👇 ADD accessorFn so Role is exported/printed
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

      // 👇 ADD accessorFn so Status is exported/printed
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

      // 👇 ADD accessorFn so Joined date is exported/printed
      {
        id: "createdAt",
        header: "Joined",
        accessorFn: (row) => new Date(row.createdAt).toLocaleDateString(), // what gets copied/exported/printed
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString()}
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
    ],
    [
      isProtectedUser,
      isPending,
      router,
      tenantId,
      canToggleUserActive,
      canUpdateUsers,
      canDeleteUsers,
      canViewUsers,
    ]
  );

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
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "Add New User"}
            </DialogTitle>
            <DialogDescription>
              {editingUser ? "Update details below." : "Create a new account."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Full Name</label>
              <input
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Email Address</label>
              <input
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                required
              />
            </div>

            {/* PASSWORD + GENERATOR + TOGGLE */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Password</label>
                {!editingUser && (
                  <button
                    type="button"
                    className="text-[11px] font-medium text-indigo-600 hover:underline"
                    onClick={handleGeneratePassword}
                  >
                    Generate strong password
                  </button>
                )}
                {editingUser && (
                  <button
                    type="button"
                    className="text-[11px] font-medium text-indigo-600 hover:underline"
                    onClick={handleGeneratePassword}
                  >
                    Generate &amp; overwrite
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 pr-9 py-1 text-sm shadow-sm"
                  value={formPassword}
                  onChange={(e) => {
                    setFormPassword(e.target.value);
                    if (!e.target.value) {
                      setFormConfirmPassword("");
                    }
                  }}
                  placeholder={
                    editingUser ? "Leave blank to keep current" : "Required"
                  }
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {editingUser
                  ? "Leave empty to keep the current password."
                  : "Use at least 8 characters. You can auto-generate a strong one."}
              </p>
            </div>

            {/* CONFIRM PASSWORD – only when password has value */}
            {formPassword && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 pr-9 py-1 text-sm shadow-sm"
                    value={formConfirmPassword}
                    onChange={(e) => setFormConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <label className="text-sm font-medium">Role</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={formRoleId}
                onChange={(e) => setFormRoleId(Number(e.target.value))}
                required
              >
                {assignableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* VIEW DIALOG */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                  {initials(viewUser.name, viewUser.email)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{viewUser.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" /> {viewUser.email}
                  </div>
                  <div className="mt-2">
                    <Badge
                      variant={viewUser.isActive ? "default" : "destructive"}
                      className="px-2 py-0.5 text-[10px]"
                    >
                      {viewUser.isActive ? "Active Account" : "Access Disabled"}
                    </Badge>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Shield className="h-3 w-3" /> Role
                  </span>
                  <p className="font-medium">{getPrimaryRoleName(viewUser)}</p>
                </div>
                <div className="space-y-1">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" /> Joined
                  </span>
                  <p className="font-medium">
                    {new Date(viewUser.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <UserIcon className="h-3 w-3" /> User ID
                  </span>
                  <p
                    className="truncate font-mono text-xs text-muted-foreground"
                    title={viewUser.id}
                  >
                    {viewUser.id}
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setViewDialogOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* BULK DELETE DIALOG */}
      <AlertDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {bulkDeletableUsers.length} selected
              user(s). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteConfirm}
              className="bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
