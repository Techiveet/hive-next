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

/* ----------------------------- Types ----------------------------- */

type RoleLite = {
  id: number;
  key: string;
  name: string;
};

type UserForClient = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string; // ISO string
  isActive: boolean;
  userRoles: {
    id: string;
    role: { key: string; name: string; scope: string };
    tenantId: string | null;
  }[];
};

/* ----------------------------- Helpers ----------------------------- */

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

/* ----------------------------- Component ----------------------------- */

export function UsersTabClient({
  users,
  assignableRoles,
  centralRoleMap, // still accepted, even if unused
  currentUserId,
  tenantId,
  tenantName,
}: {
  users: UserForClient[];
  assignableRoles: RoleLite[];
  centralRoleMap: Record<number, string>;
  currentUserId: string;
  tenantId?: string | null;
  tenantName?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  // --- Dialog States ---
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [viewDialogOpen, setViewDialogOpen] = React.useState(false);

  // --- Selected Data States ---
  const [editingUser, setEditingUser] = React.useState<UserForClient | null>(
    null
  );
  const [viewUser, setViewUser] = React.useState<UserForClient | null>(null);

  // --- Form States ---
  const [formName, setFormName] = React.useState("");
  const [formEmail, setFormEmail] = React.useState("");
  const [formPassword, setFormPassword] = React.useState("");
  const [formConfirmPassword, setFormConfirmPassword] = React.useState("");
  const [formRoleId, setFormRoleId] = React.useState<number | "">("");

  const isTenantContext = !!tenantId;

  // --- Auth & Protection Logic ---
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

  // --- Helper to get Role Name ---
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

  // --- Handlers ---

  function resetForm() {
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormConfirmPassword("");
    setFormRoleId(assignableRoles[0]?.id ?? "");
  }

  function openCreate() {
    setEditingUser(null);
    resetForm();
    setCreateDialogOpen(true);
  }

  function openEdit(user: UserForClient) {
    setEditingUser(user);
    setFormName(user.name || "");
    setFormEmail(user.email);
    setFormPassword("");
    setFormConfirmPassword("");

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
    setViewUser(user);
    setViewDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

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

        toast.success(
          editingUser
            ? "User updated successfully"
            : "User created successfully"
        );
        setCreateDialogOpen(false);
        router.refresh();
      } catch (err: any) {
        console.error(err);
        const msg = err.message || "";
        if (msg.includes("EMAIL_IN_USE"))
          toast.error("Email is already taken.");
        else if (msg.includes("FORBIDDEN"))
          toast.error("You do not have permission.");
        else if (msg.includes("PASSWORD_REQUIRED_FOR_NEW_USER"))
          toast.error("Password is required for new users.");
        else toast.error("Failed to save user.");
      }
    });
  }

  // --- Table Columns (with exportValue) ---
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
        meta: {
          align: "center",
          exportable: false,
          printable: false,
        },
      },
      {
        id: "name",
        accessorFn: (row) => `${row.name} ${row.email}`,
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
                <span className="text-xs text-muted-foreground">
                  {u.email}
                </span>
              </div>
            </div>
          );
        },
        meta: {
          exportValue: (u: UserForClient) =>
            `${u.name ?? ""} ${u.email}`.trim(),
        },
      },
      {
        id: "role",
        header: "Role",
        cell: ({ row }) => (
          <Badge variant="outline" className="bg-muted/50 font-normal">
            {getPrimaryRoleName(row.original)}
          </Badge>
        ),
        meta: {
          exportValue: (u: UserForClient) => getPrimaryRoleName(u),
        },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const u = row.original;
          const disabled = isProtectedUser(u) || isPending;
          return (
            <div className="flex items-center gap-2">
              <Switch
                checked={u.isActive}
                disabled={disabled}
                onCheckedChange={() =>
                  startTransition(async () => {
                    try {
                      await toggleUserActiveAction({
                        userId: u.id,
                        newActive: !u.isActive,
                        tenantId,
                      });
                      router.refresh();
                      toast.success(
                        `User ${!u.isActive ? "activated" : "deactivated"}`
                      );
                    } catch (err: any) {
                      const msg = err.message || "";
                      if (msg.includes("CANNOT_DEACTIVATE_SELF"))
                        toast.error("You cannot deactivate yourself.");
                      else toast.error("Failed to update status");
                    }
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
        meta: {
          exportValue: (u: UserForClient) =>
            u.isActive ? "Active" : "Inactive",
        },
      },
      {
        id: "createdAt",
        header: "Joined",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </span>
        ),
        meta: {
          exportValue: (u: UserForClient) =>
            new Date(u.createdAt).toLocaleDateString(),
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const u = row.original;
          const protectedUser = isProtectedUser(u);

          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-blue-500 hover:bg-blue-50 hover:text-blue-600"
                onClick={() => openView(u)}
                title="View Details"
              >
                <Eye className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-500 hover:bg-amber-50 hover:text-amber-600"
                onClick={() => openEdit(u)}
                title="Edit User"
              >
                <Pencil className="h-4 w-4" />
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                    disabled={protectedUser}
                    title="Delete User"
                  >
                    {protectedUser ? (
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
                      Are you sure you want to remove <b>{u.email}</b>? This
                      action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 text-white hover:bg-red-700"
                      onClick={() =>
                        startTransition(async () => {
                          try {
                            await deleteUserAction({ userId: u.id, tenantId });
                            router.refresh();
                            toast.success("User deleted");
                          } catch (err: any) {
                            const msg = err.message || "";
                            if (msg.includes("CANNOT_DELETE_SELF"))
                              toast.error("Cannot delete yourself.");
                            else if (msg.includes("CANNOT_DELETE_LAST_USER"))
                              toast.error("Cannot delete the last admin.");
                            else toast.error("Failed to delete user.");
                          }
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
        meta: {
          align: "right",
          exportable: false,
          printable: false,
        },
      },
    ],
    [isProtectedUser, isPending, router, tenantId]
  );

  return (
    <div className="space-y-4">
      {/* --- HEADER --- */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-1">
        <div>
          <h2 className="text-lg font-bold tracking-tight">
            {isTenantContext ? "Team Members" : "System Users"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage access and roles for {tenantName || "the platform"}.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* --- TABLE --- */}
      <div className="rounded-md border bg-card shadow-sm">
        <DataTable
          columns={columns}
          data={users}
          searchColumnId="name"
          searchPlaceholder="Filter by name or email..."
          onRefresh={() => router.refresh()}
          onDeleteRows={async (rows) => {
            const deletable = rows.filter((u) => !isProtectedUser(u));
            if (!deletable.length) {
              toast.error("No deletable users selected.");
              return;
            }

            let errors = 0;

            await Promise.all(
              deletable.map(async (u) => {
                try {
                  await deleteUserAction({ userId: u.id, tenantId });
                } catch (err: any) {
                  errors++;
                  const msg = err?.message || "";
                  if (msg.includes("CANNOT_DELETE_SELF")) {
                    toast.error("Cannot delete yourself.");
                  } else if (msg.includes("CANNOT_DELETE_LAST_USER")) {
                    toast.error("Cannot delete the last admin.");
                  }
                }
              })
            );

            router.refresh();

            if (errors && errors < deletable.length) {
              toast.warning("Some users could not be deleted.");
            } else if (errors === deletable.length) {
              toast.error("Failed to delete selected users.");
            } else {
              toast.success("Selected users deleted.");
            }
          }}
        />
      </div>

      {/* --- CREATE / EDIT MODAL --- */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "Add New User"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Update user details and role assignment."
                : "Create a new user account for this workspace."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Full Name</label>
              <input
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Email Address</label>
              <input
                type="email"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                required
                placeholder="john@example.com"
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  {editingUser ? "New Password (Optional)" : "Password"}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const p = generateStrongPassword();
                    setFormPassword(p);
                    setFormConfirmPassword(p);
                  }}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                >
                  <RefreshCw className="h-3 w-3" /> Generate
                </button>
              </div>
              <input
                type="text"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 font-mono text-sm shadow-sm"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder={
                  editingUser
                    ? "Leave blank to keep current"
                    : "Secure password"
                }
              />
            </div>
            {formPassword && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Confirm Password</label>
                <input
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 font-mono text-sm shadow-sm"
                  value={formConfirmPassword}
                  onChange={(e) => setFormConfirmPassword(e.target.value)}
                />
              </div>
            )}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Role Assignment</label>
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
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
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

      {/* --- VIEW MODAL --- */}
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
    </div>
  );
}
