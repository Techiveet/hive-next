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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye,
  Globe,
  KeyRound,
  Lock,
  Pencil,
  PlusCircle,
  Trash2,
} from "lucide-react";

import {
  deletePermissionAction,
  upsertPermissionAction,
} from "../permissions-actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DataTable,
  type CompanySettingsInfo,
  type BrandingSettingsInfo,
} from "@/components/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// --- Types ---
export type PermissionWithFlag = {
  id: number;
  name: string;
  key: string;
  tenantId: string | null;
  isGlobal: boolean;
};

type Props = {
  permissions: PermissionWithFlag[];
  tenantId: string | null;
  permissionsList: string[];
  companySettings?: CompanySettingsInfo | null;
  brandingSettings?: BrandingSettingsInfo | null;
};

export function PermissionsTab({
  permissions,
  tenantId,
  permissionsList = [],
  companySettings,
  brandingSettings,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  // STRICT PERMISSIONS
  const has = (key: string) => permissionsList.includes(key);

  const canViewPermissions = has("permissions.view");
  const canCreatePermissions = has("permissions.create");
  const canUpdatePermissions = has("permissions.update");
  const canDeletePermissions = has("permissions.delete");

  // --- State ---
  const [createOpen, setCreateOpen] = React.useState(false);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [viewPerm, setViewPerm] = React.useState<PermissionWithFlag | null>(
    null
  );

  const [form, setForm] = React.useState<{
    id: number | null;
    name: string;
    key: string;
  }>({ id: null, name: "", key: "" });

  // helpers

  const openCreate = React.useCallback(() => {
    if (!canCreatePermissions) return;
    setForm({ id: null, name: "", key: "" });
    setCreateOpen(true);
  }, [canCreatePermissions]);

  const openEdit = React.useCallback(
    (p: PermissionWithFlag) => {
      if (!canUpdatePermissions) return;

      if (tenantId && p.isGlobal) {
        toast.error("Cannot edit system permissions.");
        return;
      }
      setForm({ id: p.id, name: p.name, key: p.key });
      setCreateOpen(true);
    },
    [canUpdatePermissions, tenantId]
  );

  const openView = React.useCallback(
    (p: PermissionWithFlag) => {
      if (!canViewPermissions) return;
      setViewPerm(p);
      setViewOpen(true);
    },
    [canViewPermissions]
  );

  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const isEdit = !!form.id;

      if (isEdit && !canUpdatePermissions) return;
      if (!isEdit && !canCreatePermissions) return;

      startTransition(async () => {
        try {
          await upsertPermissionAction({ ...form, tenantId });
          toast.success(isEdit ? "Permission updated" : "Permission created");
          setCreateOpen(false);
          router.refresh();
        } catch (e: any) {
          toast.error(e?.message || "Error saving permission");
        }
      });
    },
    [form, tenantId, canCreatePermissions, canUpdatePermissions, router]
  );

  // table columns
  const columns = React.useMemo<ColumnDef<PermissionWithFlag>[]>(
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
              disabled={!canDeletePermissions}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-center">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(val) => row.toggleSelected(!!val)}
              disabled={!canDeletePermissions}
            />
          </div>
        ),
      },
      {
        accessorKey: "name",
        header: "Permission Name",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.isGlobal ? (
              <Globe className="h-3 w-3 text-muted-foreground" />
            ) : (
              <KeyRound className="h-3 w-3 text-indigo-500" />
            )}
            <span className="font-medium text-sm">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: "key",
        header: "Key",
        cell: ({ row }) => (
          <code className="bg-muted px-1 py-0.5 rounded text-[10px] font-mono">
            {row.original.key}
          </code>
        ),
      },
      {
        id: "type",
        header: "Type",
        meta: {
          exportValue: (row: PermissionWithFlag) =>
            row.isGlobal ? "System" : "Custom",
        },
        cell: ({ row }) =>
          row.original.isGlobal ? (
            <Badge variant="secondary" className="text-[10px] font-normal">
              System
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] font-normal border-indigo-200 text-indigo-700 bg-indigo-50"
            >
              Custom
            </Badge>
          ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const p = row.original;
          const isSystemLocked = !!tenantId && p.isGlobal;

          const viewDisabled = !canViewPermissions;
          const editDisabled = isSystemLocked || !canUpdatePermissions;
          const deleteDisabled = isSystemLocked || !canDeletePermissions;

          return (
            <div className="flex justify-end gap-1">
              {/* VIEW */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-blue-500 hover:bg-blue-50"
                onClick={() => openView(p)}
                disabled={viewDisabled}
                title={viewDisabled ? "No permission" : "View Details"}
              >
                {viewDisabled ? (
                  <Lock className="h-4 w-4 opacity-50" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>

              {/* EDIT */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-500 hover:bg-amber-50"
                onClick={() => openEdit(p)}
                disabled={editDisabled}
                title={editDisabled ? "Cannot edit" : "Edit"}
              >
                {editDisabled ? (
                  <Lock className="h-4 w-4 opacity-50" />
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
                    title={deleteDisabled ? "Cannot delete" : "Delete"}
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
                    <AlertDialogTitle>Delete Permission?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. It may break features if
                      roles depend on it.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700 text-white"
                      onClick={() =>
                        startTransition(async () => {
                          try {
                            await deletePermissionAction(p.id, tenantId);
                            router.refresh();
                            toast.success("Permission deleted");
                          } catch (e: any) {
                            toast.error(
                              e?.message ||
                                `Failed to delete "${p.name}" permission.`
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
    [
      tenantId,
      canUpdatePermissions,
      canDeletePermissions,
      canViewPermissions,
      openEdit,
      openView,
      startTransition,
      router,
    ]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-1">
        <div>
          <h2 className="text-lg font-bold">Permissions Inventory</h2>
          <p className="text-sm text-muted-foreground">
            Fine-grained access controls.
          </p>
        </div>

        {canCreatePermissions && (
          <Button
            onClick={openCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Add Permission
          </Button>
        )}
      </div>

      <div className="rounded-md border bg-card">
        <DataTable
          columns={columns}
          data={permissions}
          searchColumnId="name"
          searchPlaceholder="Filter permissions..."
          onRefresh={() => router.refresh()}
          fileName="permissions"
          companySettings={companySettings ?? undefined}
          brandingSettings={brandingSettings ?? undefined}
          onDeleteRows={async (rows) => {
            if (!canDeletePermissions) {
              toast.error("You do not have permission to delete permissions.");
              return;
            }
            let errors = 0;
            await Promise.all(
              rows.map(async (p: PermissionWithFlag) => {
                try {
                  await deletePermissionAction(p.id, tenantId);
                } catch {
                  errors++;
                }
              })
            );
            router.refresh();
            if (errors === 0) toast.success("Selected permissions deleted.");
            else toast.warning("Some permissions could not be deleted.");
          }}
        />
      </div>

      {/* CREATE / EDIT */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Edit Permission" : "New Permission"}
            </DialogTitle>
            <DialogDescription>
              Define a unique key for code checks.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Name
              </label>
              <input
                className="w-full border rounded p-2 text-sm"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                required
                placeholder="e.g. Delete Reports"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Key
              </label>
              <input
                className="w-full border rounded p-2 text-sm font-mono"
                value={form.key}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, key: e.target.value }))
                }
                required
                placeholder="e.g. delete_reports"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
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

      {/* VIEW */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Permission Details</DialogTitle>
          </DialogHeader>
          {viewPerm && (
            <div className="grid gap-4 text-sm">
              <div className="grid grid-cols-3 items-center border-b pb-2">
                <span className="font-medium text-muted-foreground">Name</span>
                <span className="col-span-2 font-semibold">
                  {viewPerm.name}
                </span>
              </div>
              <div className="grid grid-cols-3 items-center border-b pb-2">
                <span className="font-medium text-muted-foreground">Key</span>
                <span className="col-span-2 font-mono bg-muted px-1 rounded">
                  {viewPerm.key}
                </span>
              </div>
              <div className="grid grid-cols-3 items-center border-b pb-2">
                <span className="font-medium text-muted-foreground">Type</span>
                <span className="col-span-2">
                  {viewPerm.isGlobal ? (
                    <Badge variant="secondary">System (Global)</Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-indigo-500 text-indigo-500"
                    >
                      Tenant Specific
                    </Badge>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-3 items-center">
                <span className="font-medium text-muted-foreground">ID</span>
                <span className="col-span-2 text-xs text-muted-foreground">
                  {viewPerm.id}
                </span>
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setViewOpen(false)}>
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
