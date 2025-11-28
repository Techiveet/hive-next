// app/(dashboard)/security/_components/roles-tab.tsx
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
  CheckCircle2,
  CheckSquare,
  Circle,
  Eye,
  Lock,
  Pencil,
  PlusCircle,
  Search,
  ShieldCheck,
  SquareDashedBottom,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteRoleAction, upsertRoleAction } from "../roles-actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// --- Types ---
type RoleDto = {
  id: number;
  key: string;
  name: string;
  scope: "CENTRAL" | "TENANT";
  permissions: { id: number; key: string; name: string }[];
  tenantId: string | null;
};

type Props = {
  roles: RoleDto[];
  allPermissions: any[];
  scopeProp: "CENTRAL" | "TENANT";
  tenantId: string | null;
  permissions: string[];
};

type FilterType = "all" | "enabled" | "disabled";

export function RolesTab({
  roles,
  allPermissions,
  scopeProp,
  tenantId,
  permissions = [],
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  // 1. STRICT PERMISSIONS
  const has = (key: string) => permissions.includes(key);
  const canViewRoles = has("roles.view");
  const canCreateRoles = has("roles.create");
  const canUpdateRoles = has("roles.update");
  const canDeleteRoles = has("roles.delete");

  // --- State ---
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [viewModalOpen, setViewModalOpen] = React.useState(false);
  const [viewRole, setViewRole] = React.useState<RoleDto | null>(null);

  // Search & Filter State
  const [permissionSearch, setPermissionSearch] = React.useState("");
  const [permissionFilter, setPermissionFilter] =
    React.useState<FilterType>("all");

  const [form, setForm] = React.useState<{
    id: number | null;
    name: string;
    key: string;
    permissionIds: number[];
  }>({
    id: null,
    name: "",
    key: "",
    permissionIds: [],
  });

  const isProtected = (key: string) =>
    ["central_superadmin", "tenant_superadmin"].includes(key);

  // 🔍 FILTER LOGIC
  const filteredPermissions = React.useMemo(() => {
    let result = allPermissions;

    // 1. Filter by Search Text
    if (permissionSearch) {
      const lower = permissionSearch.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          p.key.toLowerCase().includes(lower)
      );
    }

    // 2. Filter by Status
    if (permissionFilter === "enabled") {
      result = result.filter((p) => form.permissionIds.includes(p.id));
    } else if (permissionFilter === "disabled") {
      result = result.filter((p) => !form.permissionIds.includes(p.id));
    }

    return result;
  }, [allPermissions, permissionSearch, permissionFilter, form.permissionIds]);

  // 🟢 NEW: BULK ASSIGN ACTIONS
  const handleSelectAll = () => {
    const idsToAdd = filteredPermissions.map((p) => p.id);
    setForm((prev) => ({
      ...prev,
      // Add new IDs to existing IDs, using Set to remove duplicates
      permissionIds: Array.from(new Set([...prev.permissionIds, ...idsToAdd])),
    }));
  };

  const handleDeselectAll = () => {
    const idsToRemove = filteredPermissions.map((p) => p.id);
    setForm((prev) => ({
      ...prev,
      // Keep only IDs that are NOT in the current filtered list
      permissionIds: prev.permissionIds.filter(
        (id) => !idsToRemove.includes(id)
      ),
    }));
  };

  function openCreate() {
    if (!canCreateRoles) return;
    setForm({ id: null, name: "", key: "", permissionIds: [] });
    setPermissionSearch("");
    setPermissionFilter("all");
    setCreateModalOpen(true);
  }

  function openEdit(role: RoleDto) {
    if (!canUpdateRoles) return;
    setForm({
      id: role.id,
      name: role.name,
      key: role.key,
      permissionIds: role.permissions.map((p) => p.id),
    });
    setPermissionSearch("");
    setPermissionFilter("all");
    setCreateModalOpen(true);
  }

  function openView(role: RoleDto) {
    if (!canViewRoles) return;
    setViewRole(role);
    setViewModalOpen(true);
  }

  function togglePermission(id: number) {
    setForm((prev) => {
      const exists = prev.permissionIds.includes(id);
      return {
        ...prev,
        permissionIds: exists
          ? prev.permissionIds.filter((x) => x !== id)
          : [...prev.permissionIds, id],
      };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isEdit = !!form.id;

    if (isEdit && !canUpdateRoles) return;
    if (!isEdit && !canCreateRoles) return;

    startTransition(async () => {
      try {
        await upsertRoleAction({ ...form, scope: scopeProp, tenantId });
        toast.success(isEdit ? "Role updated" : "Role created");
        setCreateModalOpen(false);
        router.refresh();
      } catch (err: any) {
        toast.error(err.message || "Failed to save role");
      }
    });
  }

  // --- Columns ---
  const columns = React.useMemo<ColumnDef<RoleDto>[]>(
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
        accessorKey: "name",
        header: "Role Name",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-500" />
            <span className="font-semibold text-foreground">
              {row.original.name}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "key",
        header: "System Key",
        cell: ({ row }) => (
          <Badge variant="secondary" className="font-mono text-[10px]">
            {row.original.key}
          </Badge>
        ),
      },
      {
        id: "permissions",
        header: "Permissions",
        meta: {
          // What goes into CSV / XLSX / PDF / Print
          exportValue: (role: RoleDto) =>
            role.permissions.length
              ? role.permissions.map((p) => p.name).join(", ")
              : "No permissions",
        },
        cell: ({ row }) => {
          const count = row.original.permissions.length;
          return (
            <span className="text-xs text-muted-foreground">
              {count} permission{count !== 1 ? "s" : ""} assigned
            </span>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const role = row.original;
          const protectedRole = isProtected(role.key);

          const viewDisabled = !canViewRoles;
          const editDisabled = !canUpdateRoles;
          const deleteDisabled = protectedRole || !canDeleteRoles;

          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-blue-500 hover:bg-blue-50"
                onClick={() => openView(role)}
                disabled={viewDisabled}
                title={viewDisabled ? "No permission" : "View Details"}
              >
                {viewDisabled ? (
                  <Lock className="h-4 w-4 opacity-70" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-500 hover:bg-amber-50"
                onClick={() => openEdit(role)}
                disabled={editDisabled}
                title={editDisabled ? "No permission" : "Edit Role"}
              >
                {editDisabled ? (
                  <Lock className="h-4 w-4 opacity-70" />
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
                    title={deleteDisabled ? "Cannot delete" : "Delete Role"}
                  >
                    {deleteDisabled ? (
                      <Lock className="h-4 w-4 opacity-50" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Role?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will detach permissions from users with this role.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={() =>
                        startTransition(async () => {
                          try {
                            await deleteRoleAction(role.id);
                            router.refresh();
                            toast.success("Role deleted");
                          } catch (e: any) {
                            toast.error(
                              e?.message ||
                                `Failed to delete role "${role.name}".`
                            );
                          }
                        })
                      }
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        },
      },
    ],
    [isProtected, canDeleteRoles, canUpdateRoles, canViewRoles]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-1">
        <div>
          <h2 className="text-lg font-bold">Roles &amp; Capabilities</h2>
          <p className="text-sm text-muted-foreground">
            Define what users can do in this workspace.
          </p>
        </div>

        {canCreateRoles && (
          <Button
            onClick={openCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Create Role
          </Button>
        )}
      </div>

      <div className="rounded-md border bg-card">
        <DataTable
          columns={columns}
          data={roles}
          searchColumnId="name"
          searchPlaceholder="Filter roles..."
          onRefresh={() => router.refresh()}
          onDeleteRows={async (rows) => {
            if (!canDeleteRoles) {
              toast.error("No permission to delete.");
              return;
            }
            const deletable = rows.filter((r) => !isProtected(r.key));
            let errors = 0;
            await Promise.all(
              deletable.map(async (role) => {
                try {
                  await deleteRoleAction(role.id);
                } catch (e: any) {
                  errors++;
                }
              })
            );
            router.refresh();
            if (errors === 0) toast.success("Selected roles deleted.");
            else toast.warning("Some roles could not be deleted.");
          }}
        />
      </div>

      {/* CREATE/EDIT MODAL */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Edit Role" : "Create New Role"}
            </DialogTitle>
            <DialogDescription>
              Configure role details and check permissions below.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase text-muted-foreground">
                  Name
                </label>
                <input
                  className="w-full rounded border p-2 text-sm"
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase text-muted-foreground">
                  Key
                </label>
                <input
                  className="w-full rounded border p-2 text-sm font-mono"
                  value={form.key}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, key: e.target.value }))
                  }
                  disabled={!!form.id}
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium uppercase text-muted-foreground">
                  Permissions
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {form.permissionIds.length} assigned
                </span>
              </div>

              {/* 🟢 CONTROLS: SEARCH + FILTER + SELECT ALL */}
              <div className="flex flex-col gap-2 bg-muted/30 p-2 rounded-md border">
                {/* Row 1: Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground" />
                  <input
                    placeholder="Search permissions..."
                    className="h-8 w-full rounded border bg-background pl-8 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    value={permissionSearch}
                    onChange={(e) => setPermissionSearch(e.target.value)}
                  />
                </div>

                {/* Row 2: Filters & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant={
                        permissionFilter === "all" ? "default" : "outline"
                      }
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => setPermissionFilter("all")}
                    >
                      All
                    </Button>
                    <Button
                      type="button"
                      variant={
                        permissionFilter === "enabled" ? "default" : "outline"
                      }
                      size="sm"
                      className={cn(
                        "h-6 text-[10px] px-2",
                        permissionFilter === "enabled" &&
                          "bg-emerald-600 hover:bg-emerald-700 text-white"
                      )}
                      onClick={() => setPermissionFilter("enabled")}
                    >
                      Assigned
                    </Button>
                    <Button
                      type="button"
                      variant={
                        permissionFilter === "disabled" ? "default" : "outline"
                      }
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => setPermissionFilter("disabled")}
                    >
                      Unassigned
                    </Button>
                  </div>

                  {/* 🟢 BULK ACTIONS (Respects Filter) */}
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                      onClick={handleSelectAll}
                      title="Select all visible"
                    >
                      <CheckSquare className="mr-1 h-3 w-3" /> Select All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={handleDeselectAll}
                      title="Deselect all visible"
                    >
                      <SquareDashedBottom className="mr-1 h-3 w-3" /> Clear
                    </Button>
                  </div>
                </div>
              </div>

              <ScrollArea className="h-[200px] rounded-md border p-2 bg-background">
                <div className="grid grid-cols-1 gap-1">
                  {filteredPermissions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                      <p className="text-xs">
                        No permissions found matching filters.
                      </p>
                    </div>
                  ) : (
                    filteredPermissions.map((p) => {
                      const isSelected = form.permissionIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={cn(
                            "flex items-center gap-3 rounded px-2 py-2 cursor-pointer transition-colors border border-transparent",
                            isSelected
                              ? "bg-indigo-50 border-indigo-100 dark:bg-indigo-950/30"
                              : "hover:bg-muted"
                          )}
                        >
                          {isSelected ? (
                            <CheckCircle2 className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => togglePermission(p.id)}
                            className="sr-only"
                          />
                          <div className="flex flex-col">
                            <div className="text-sm font-medium leading-none">
                              {p.name}
                            </div>
                            {p.isGlobal && (
                              <span className="text-[10px] text-muted-foreground mt-0.5">
                                System Level
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t mt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                Save Role
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* VIEW MODAL */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewRole?.name}
              {viewRole && (
                <Badge variant="outline" className="text-xs font-normal">
                  {viewRole.key}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Assigned permissions for this role.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[300px] pr-4">
            {viewRole?.permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No permissions assigned.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {viewRole?.permissions.map((p) => (
                  <Badge
                    key={p.id}
                    variant="secondary"
                    className="px-2 py-1 text-xs"
                  >
                    {p.name}
                  </Badge>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setViewModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
