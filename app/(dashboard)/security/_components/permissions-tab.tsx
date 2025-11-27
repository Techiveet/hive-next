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
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type PermissionWithFlag = {
  id: number;
  key: string;
  name: string;
  isGlobal: boolean;
};

export function PermissionsTab({
  permissions,
  tenantId,
}: {
  permissions: PermissionWithFlag[];
  tenantId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  // Modals
  const [createOpen, setCreateOpen] = React.useState(false);
  const [viewOpen, setViewOpen] = React.useState(false);

  // Data
  const [viewPerm, setViewPerm] =
    React.useState<PermissionWithFlag | null>(null);
  const [form, setForm] = React.useState<{
    id: number | null;
    name: string;
    key: string;
  }>({ id: null, name: "", key: "" });

  function openCreate() {
    setForm({ id: null, name: "", key: "" });
    setCreateOpen(true);
  }

  function openEdit(p: PermissionWithFlag) {
    // tenant cannot edit global/system permissions
    if (tenantId && p.isGlobal) return;
    setForm({ id: p.id, name: p.name, key: p.key });
    setCreateOpen(true);
  }

  function openView(p: PermissionWithFlag) {
    setViewPerm(p);
    setViewOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await upsertPermissionAction({ ...form, tenantId });
        toast.success(form.id ? "Permission updated" : "Permission created");
        setCreateOpen(false);
        router.refresh();
      } catch (e: any) {
        toast.error(e.message || "Error saving permission");
      }
    });
  }

  /* -------------------- TABLE COLUMNS (with select + export) -------------------- */
  const columns = React.useMemo<ColumnDef<PermissionWithFlag>[]>(
    () => [
      // Select column so the FAB copy/export/delete works
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex justify-center">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(val) =>
                table.toggleAllPageRowsSelected(!!val)
              }
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
        meta: { align: "center", exportable: false, printable: false },
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
        meta: {
          exportValue: (p: PermissionWithFlag) => p.name,
        },
      },
      {
        accessorKey: "key",
        header: "Key",
        cell: ({ row }) => (
          <code className="bg-muted px-1 py-0.5 rounded text-[10px]">
            {row.original.key}
          </code>
        ),
        meta: {
          exportValue: (p: PermissionWithFlag) => p.key,
        },
      },
      {
        id: "type",
        header: "Type",
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
        meta: {
          exportValue: (p: PermissionWithFlag) =>
            p.isGlobal ? "System" : "Custom",
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const p = row.original;
          const isLocked = tenantId && p.isGlobal;

          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-blue-500 hover:bg-blue-50"
                onClick={() => openView(p)}
              >
                <Eye className="h-4 w-4" />
              </Button>

              {isLocked ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground cursor-not-allowed opacity-50"
                >
                  <Lock className="h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-amber-500 hover:bg-amber-50"
                    onClick={() => openEdit(p)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Permission?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This may break features if roles depend on it.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600"
                          onClick={() =>
                            startTransition(async () => {
                              await deletePermissionAction(p.id, tenantId);
                              router.refresh();
                            })
                          }
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          );
        },
        meta: { align: "right", exportable: false, printable: false },
      },
    ],
    [tenantId, router, startTransition]
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
        <Button
          onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Add Permission
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <DataTable
          columns={columns}
          data={permissions}
          searchColumnId="name"
          searchPlaceholder="Filter permissions..."
          onRefresh={() => router.refresh()}
          onDeleteRows={async (rows) => {
            if (!rows.length) return;

            let errors = 0;

            await Promise.all(
              rows.map(async (p) => {
                try {
                  await deletePermissionAction(p.id, tenantId);
                } catch (e: any) {
                  errors++;
                  toast.error(
                    e?.message || `Failed to delete "${p.name}" permission.`
                  );
                }
              })
            );

            router.refresh();

            if (errors === 0)
              toast.success("Selected permissions deleted successfully.");
            else if (errors === rows.length)
              toast.error("Failed to delete selected permissions.");
            else
              toast.warning(
                "Some permissions could not be deleted. Check the errors."
              );
          }}
        />
      </div>

      {/* CREATE/EDIT */}
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
                  setForm({ ...form, name: e.target.value })
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
                  setForm({ ...form, key: e.target.value })
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
