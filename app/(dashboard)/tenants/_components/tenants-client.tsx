// app/(dashboard)/tenants/_components/tenants-client.tsx
"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  Globe2,
  PlusCircle,
  Trash2,
  Pencil,
  Shield,
  UserPlus,
  Eye as EyeIcon,
  EyeOff,
} from "lucide-react";

import {
  upsertTenantAction,
  toggleTenantActiveAction,
  deleteTenantAction,
  upsertTenantSuperadminAction,
  type UpsertTenantInput,
  type TenantSuperadminInput,
} from "../tenants-actions";

type TenantForClient = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  domain: string | null;
  superadmin: { id: string; name: string | null; email: string } | null;
};

type Props = {
  tenants: TenantForClient[];
  canManageTenants: boolean;
};

// small helper to generate strong-ish password
function generateStrongPassword(length = 12) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

export function TenantsClient({ tenants, canManageTenants }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  /* ============ TENANT FORM STATE ============ */

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingTenant, setEditingTenant] =
    React.useState<TenantForClient | null>(null);

  const [tenantForm, setTenantForm] = React.useState<{
    name: string;
    slug: string;
    domain: string;
    isActive: boolean;
  }>({
    name: "",
    slug: "",
    domain: "",
    isActive: true,
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [tenantToDelete, setTenantToDelete] =
    React.useState<TenantForClient | null>(null);

  function resetTenantForm() {
    setTenantForm({
      name: "",
      slug: "",
      domain: "",
      isActive: true,
    });
    setEditingTenant(null);
  }

  function openCreateTenant() {
    if (!canManageTenants) return;
    resetTenantForm();
    setDialogOpen(true);
  }

  function openEditTenant(t: TenantForClient) {
    if (!canManageTenants) return;
    setEditingTenant(t);
    setTenantForm({
      name: t.name,
      slug: t.slug,
      domain: t.domain ?? "",
      isActive: t.isActive,
    });
    setDialogOpen(true);
  }

  function handleTenantSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canManageTenants) return;

    const payload: UpsertTenantInput = {
      id: editingTenant?.id ?? null,
      name: tenantForm.name.trim(),
      slug: tenantForm.slug.trim() || undefined,
      domain: tenantForm.domain.trim() || undefined,
      isActive: tenantForm.isActive,
    };

    startTransition(async () => {
      try {
        await upsertTenantAction(payload);
        toast.success(editingTenant ? "Tenant updated" : "Tenant created");
        setDialogOpen(false);
        resetTenantForm();
        router.refresh();
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "Failed to save tenant");
      }
    });
  }

  function confirmDeleteTenant(t: TenantForClient) {
    if (!canManageTenants) return;
    setTenantToDelete(t);
    setDeleteDialogOpen(true);
  }

  function handleDeleteTenant() {
    if (!tenantToDelete) return;

    startTransition(async () => {
      try {
        await deleteTenantAction({ tenantId: tenantToDelete.id });
        toast.success("Tenant deleted");
        setDeleteDialogOpen(false);
        setTenantToDelete(null);
        router.refresh();
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "Failed to delete tenant");
      }
    });
  }

  function handleToggleActive(t: TenantForClient) {
    if (!canManageTenants) return;

    startTransition(async () => {
      try {
        await toggleTenantActiveAction({
          tenantId: t.id,
          newActive: !t.isActive,
        });
        toast.success(
          `Tenant ${!t.isActive ? "activated" : "deactivated"} successfully.`
        );
        router.refresh();
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "Failed to update status");
      }
    });
  }

  /* ============ SUPERADMIN MODAL STATE ============ */

  const [superDialogOpen, setSuperDialogOpen] = React.useState(false);
  const [targetTenant, setTargetTenant] =
    React.useState<TenantForClient | null>(null);

  const [superForm, setSuperForm] = React.useState<{
    name: string;
    email: string;
    password: string;
    confirm: string;
  }>({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });

  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  function openSuperadminModal(t: TenantForClient) {
    if (!canManageTenants) return;

    setTargetTenant(t);
    setSuperForm({
      name: t.superadmin?.name ?? "",
      email: t.superadmin?.email ?? "",
      password: "",
      confirm: "",
    });
    setShowPassword(false);
    setShowConfirm(false);
    setSuperDialogOpen(true);
  }

  function handleGeneratePassword() {
    const pwd = generateStrongPassword();
    setSuperForm((f) => ({
      ...f,
      password: pwd,
      confirm: pwd,
    }));
    toast.success("Generated strong password");
  }

  function handleSuperSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetTenant || !canManageTenants) return;

    if (!superForm.password || superForm.password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (superForm.password !== superForm.confirm) {
      toast.error("Passwords do not match.");
      return;
    }

    const payload: TenantSuperadminInput = {
      tenantId: targetTenant.id,
      name: superForm.name.trim(),
      email: superForm.email.trim(),
      password: superForm.password,
    };

    startTransition(async () => {
      try {
        await upsertTenantSuperadminAction(payload);
        toast.success("Tenant superadmin saved");
        setSuperDialogOpen(false);
        router.refresh();
      } catch (err: any) {
        console.error(err);
        toast.error(err.message || "Failed to save superadmin");
      }
    });
  }

  /* ============ TABLE ============ */

 const columns = React.useMemo<ColumnDef<TenantForClient>[]>(
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
      meta: { exportable: false, printable: false },
    },

    // TENANT
    {
      id: "name",
      accessorKey: "name",
      header: "Tenant",
      cell: ({ row }) => {
        const t = row.original;
        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{t.name}</span>
            <span className="text-xs text-muted-foreground">{t.slug}</span>
          </div>
        );
      },
    },

    // DOMAIN
    {
      id: "domain",
      header: "Domain",
      accessorFn: (row) => row.domain ?? "", // <-- used for export/print
      cell: ({ row }) => {
        const domain = row.original.domain;
        return domain ? (
          <div className="flex items-center gap-1 text-xs">
            <Globe2 className="h-3 w-3 text-muted-foreground" />
            <span>{domain}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },

    // SUPERADMIN
    {
      id: "superadmin",
      header: "Superadmin",
      accessorFn: (row) =>
        row.superadmin
          ? `${row.superadmin.name || ""} (${row.superadmin.email})`.trim()
          : "", // <-- export value
      cell: ({ row }) => {
        const su = row.original.superadmin;
        if (!su) {
          return (
            <span className="text-xs text-muted-foreground">
              Not assigned
            </span>
          );
        }
        return (
          <div className="flex flex-col text-xs">
            <span className="font-medium flex items-center gap-1">
              <Shield className="h-3 w-3 text-amber-500" />
              {su.name || "Unnamed"}
            </span>
            <span className="text-muted-foreground">{su.email}</span>
          </div>
        );
      },
    },

    // STATUS
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => (row.isActive ? "Active" : "Disabled"), // <-- export
      cell: ({ row }) => {
        const t = row.original;
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={t.isActive}
              disabled={!canManageTenants || isPending}
              onCheckedChange={() => handleToggleActive(t)}
            />
            <Badge
              variant={t.isActive ? "default" : "secondary"}
              className="text-[10px]"
            >
              {t.isActive ? "Active" : "Disabled"}
            </Badge>
          </div>
        );
      },
    },

    // CREATED
    {
      id: "createdAt",
      header: "Created",
      accessorFn: (row) =>
        new Date(row.createdAt).toLocaleDateString(), // <-- export
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
        const t = row.original;
        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-emerald-600 hover:bg-emerald-50"
              disabled={!canManageTenants}
              onClick={() => openSuperadminModal(t)}
              title="Create / update tenant superadmin"
            >
              <UserPlus className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-amber-500 hover:bg-amber-50"
              disabled={!canManageTenants}
              onClick={() => openEditTenant(t)}
              title="Edit tenant"
            >
              <Pencil className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:bg-red-50"
              disabled={!canManageTenants}
              onClick={() => confirmDeleteTenant(t)}
              title="Delete tenant"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
      meta: { exportable: false, printable: false },
    },
  ],
  [canManageTenants, isPending]
);


  /* ============ RENDER ============ */

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 p-1">
        <div>
          <h2 className="text-lg font-bold">Tenant Management</h2>
          <p className="text-sm text-muted-foreground">
            Create tenants, manage domains, and assign tenant superadmins.
          </p>
        </div>
        {canManageTenants && (
          <Button
            onClick={openCreateTenant}
            className="bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            New Tenant
          </Button>
        )}
      </div>

      <div className="rounded-md border bg-card shadow-sm">
        <DataTable
          columns={columns}
          data={tenants}
          searchColumnId="name"
          searchPlaceholder="Filter tenants..."
          onRefresh={() => router.refresh()}
        />
      </div>

      {/* CREATE / EDIT TENANT */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTenant ? "Edit Tenant" : "Create Tenant"}
            </DialogTitle>
            <DialogDescription>
              {editingTenant
                ? "Update tenant details and domain."
                : "Create a new tenant."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTenantSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Tenant Name</label>
              <input
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={tenantForm.name}
                onChange={(e) =>
                  setTenantForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Slug</label>
              <input
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={tenantForm.slug}
                onChange={(e) =>
                  setTenantForm((f) => ({ ...f, slug: e.target.value }))
                }
                placeholder="auto-generated from name if empty"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Domain</label>
              <input
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={tenantForm.domain}
                onChange={(e) =>
                  setTenantForm((f) => ({ ...f, domain: e.target.value }))
                }
                placeholder="e.g. acme.yourapp.com (optional)"
              />
              <p className="text-[11px] text-muted-foreground">
                Leaving this empty removes the custom domain mapping.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={tenantForm.isActive}
                  onCheckedChange={(val) =>
                    setTenantForm((f) => ({ ...f, isActive: !!val }))
                  }
                />
                <span className="text-xs text-muted-foreground">
                  Tenant is active
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetTenantForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {editingTenant ? "Save Changes" : "Create Tenant"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* TENANT SUPERADMIN MODAL */}
      <Dialog open={superDialogOpen} onOpenChange={setSuperDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {targetTenant?.superadmin
                ? "Update Tenant Superadmin"
                : "Create Tenant Superadmin"}
            </DialogTitle>
            <DialogDescription>
              This user will be created/updated as the owner and superadmin for{" "}
              <b>{targetTenant?.name}</b>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSuperSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Full Name</label>
              <input
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={superForm.name}
                onChange={(e) =>
                  setSuperForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Email Address</label>
              <input
                type="email"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={superForm.email}
                onChange={(e) =>
                  setSuperForm((f) => ({ ...f, email: e.target.value }))
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Password</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-sm shadow-sm"
                    value={superForm.password}
                    onChange={(e) =>
                      setSuperForm((f) => ({
                        ...f,
                        password: e.target.value,
                      }))
                    }
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-2 flex items-center text-muted-foreground"
                    onClick={() => setShowPassword((s) => !s)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGeneratePassword}
                >
                  Generate
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-sm shadow-sm"
                  value={superForm.confirm}
                  onChange={(e) =>
                    setSuperForm((f) => ({
                      ...f,
                      confirm: e.target.value,
                    }))
                  }
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-2 flex items-center text-muted-foreground"
                  onClick={() => setShowConfirm((s) => !s)}
                >
                  {showConfirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSuperDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                Save Superadmin
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE TENANT */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tenant?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <b>{tenantToDelete?.name ?? "this tenant"}</b> and all
              tenant-scoped data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTenant}
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
