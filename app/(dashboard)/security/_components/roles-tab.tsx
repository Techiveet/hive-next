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
  Lock,
  Pencil,
  PlusCircle,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { deleteRoleAction, upsertRoleAction } from "../roles-actions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// ---------- Types ----------
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
};

export function RolesTab({
  roles,
  allPermissions,
  scopeProp,
  tenantId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  // Modals
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [viewModalOpen, setViewModalOpen] = React.useState(false);

  // State
  const [viewRole, setViewRole] = React.useState<RoleDto | null>(null);
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

  function openCreate() {
    setForm({ id: null, name: "", key: "", permissionIds: [] });
    setCreateModalOpen(true);
  }

  function openEdit(role: RoleDto) {
    setForm({
      id: role.id,
      name: role.name,
      key: role.key,
      permissionIds: role.permissions.map((p) => p.id),
    });
    setCreateModalOpen(true);
  }

  function openView(role: RoleDto) {
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
    startTransition(async () => {
      try {
        await upsertRoleAction({ ...form, scope: scopeProp, tenantId });
        toast.success(form.id ? "Role updated" : "Role created");
        setCreateModalOpen(false);
        router.refresh();
      } catch (err: any) {
        toast.error(err.message || "Failed to save role");
      }
    });
  }

  // ---------- Columns (with select + export meta) ----------
  const columns = React.useMemo<ColumnDef<RoleDto>[]>(
    () => [
      // select column for FAB (copy / export / delete)
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
        header: "Role Name",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-500" />
            <span className="font-semibold text-foreground">
              {row.original.name}
            </span>
          </div>
        ),
        meta: {
          exportValue: (r: RoleDto) => r.name,
        },
      },
      {
        accessorKey: "key",
        header: "System Key",
        cell: ({ row }) => (
          <Badge
            variant="secondary"
            className="font-mono text-[10px]"
          >
            {row.original.key}
          </Badge>
        ),
        meta: {
          exportValue: (r: RoleDto) => r.key,
        },
      },
      {
        id: "permissions",
        header: "Permissions",
        cell: ({ row }) => {
          const count = row.original.permissions.length;
          return (
            <span className="text-xs text-muted-foreground">
              {count} permission{count !== 1 ? "s" : ""} assigned
            </span>
          );
        },
        meta: {
          // export full permission names, comma separated
          exportValue: (r: RoleDto) =>
            r.permissions.map((p) => p.name).join(", "),
        },
      },
      {
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
          const role = row.original;
          const protectedRole = isProtected(role.key);

          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-blue-500 hover:bg-blue-50"
                onClick={() => openView(role)}
              >
                <Eye className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-amber-500 hover:bg-amber-50"
                onClick={() => openEdit(role)}
              >
                <Pencil className="h-4 w-4" />
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:bg-red-50"
                    disabled={protectedRole}
                  >
                    {protectedRole ? (
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
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() =>
                        startTransition(async () => {
                          await deleteRoleAction(role.id);
                          router.refresh();
                          toast.success("Role deleted");
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
        meta: { align: "right", exportable: false, printable: false },
      },
    ],
    [isProtected]
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
        <Button
          onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Create Role
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <DataTable
          columns={columns}
          data={roles}
          searchColumnId="name"
          searchPlaceholder="Filter roles..."
          onRefresh={() => router.refresh()}
          onDeleteRows={async (rows) => {
            const deletable = rows.filter((r) => !isProtected(r.key));
            if (!deletable.length) {
              toast.error("No deletable roles selected.");
              return;
            }

            let errors = 0;

            await Promise.all(
              deletable.map(async (role) => {
                try {
                  await deleteRoleAction(role.id);
                } catch (e: any) {
                  errors++;
                  toast.error(
                    e?.message ||
                      `Failed to delete role "${role.name}".`
                  );
                }
              })
            );

            router.refresh();

            if (errors === 0)
              toast.success("Selected roles deleted.");
            else if (errors === deletable.length)
              toast.error("Failed to delete selected roles.");
            else
              toast.warning(
                "Some roles could not be deleted. Check the errors."
              );
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
                    setForm({ ...form, name: e.target.value })
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
                    setForm({ ...form, key: e.target.value })
                  }
                  disabled={!!form.id}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase text-muted-foreground">
                Permissions
              </label>
              <ScrollArea className="h-[200px] rounded-md border p-4">
                <div className="grid grid-cols-1 gap-2">
                  {allPermissions.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 rounded hover:bg-muted/50 p-1 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.permissionIds.includes(p.id)}
                        onChange={() => togglePermission(p.id)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="text-sm">
                        <span className="font-medium">{p.name}</span>
                        {p.isGlobal && (
                          <span className="ml-2 text-[10px] text-muted-foreground border rounded px-1">
                            System
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="flex justify-end gap-2 pt-2">
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
                <Badge
                  variant="outline"
                  className="text-xs font-normal"
                >
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
            <Button
              variant="outline"
              onClick={() => setViewModalOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
