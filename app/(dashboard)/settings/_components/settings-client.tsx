// app/(dashboard)/settings/_components/settings-client.tsx
"use client";

import * as React from "react";

import {
  Bell,
  Building2,
  Globe2,
  Mail,
  Palette,
  Settings2,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  updateBrandSettingsAction,
  updateProfileAction,
  updateTenantSettingsAction,
} from "../settings-actions";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SettingsClientProps = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  } | null;
  permissions: string[];
  brandSettings: {
    titleText: string;
    footerText: string;
    logoLightUrl: string;
    logoDarkUrl: string;
    faviconUrl: string;
  };
};

type SettingsSection =
  | "brand"
  | "system"
  | "company"
  | "email"
  | "notifications";

export function SettingsClient({
  user,
  tenant,
  permissions,
  brandSettings,
}: SettingsClientProps) {
  const [section, setSection] = useState<SettingsSection>("brand");
  const [isPending, startTransition] = useTransition();

  const isCentral = !tenant;

  const has = (key: string) => permissions.includes(key);
  const hasAny = (keys: string[]) => keys.some((k) => permissions.includes(k));

  const canManageTenant = hasAny([
    "manage_tenants",
    "manage_security",
    "manage_users",
    "manage_roles",
  ]);

  /* ---------------------------------------------------------- */
  /* BRAND FORM                                                 */
  /* ---------------------------------------------------------- */

  const [brandForm, setBrandForm] = useState({
    titleText: brandSettings.titleText,
    footerText: brandSettings.footerText,
    logoLightUrl: brandSettings.logoLightUrl,
    logoDarkUrl: brandSettings.logoDarkUrl,
    faviconUrl: brandSettings.faviconUrl,
  });

  type BrandImageField = "logoLightUrl" | "logoDarkUrl" | "faviconUrl";

  /**
   * Opens the global File Manager modal via the custom event.
   * The FileManagerEventListener will:
   *  - open the modal
   *  - filter by images when filter === "images"
   *  - call detail.onSelect(file) when a file is picked.
   */
  function openFileManager(target: BrandImageField) {
    if (typeof window === "undefined") return;

    window.dispatchEvent(
      new CustomEvent("open-file-manager", {
        detail: {
          filter: "images" as const, // let the listener know we only want images
          onSelect: (file: { url: string; id?: string; name?: string }) => {
            setBrandForm((prev) => ({
              ...prev,
              [target]: file.url,
            }));
          },
        },
      })
    );
  }

  function handleBrandSubmit(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      try {
        await updateBrandSettingsAction({
          titleText: brandForm.titleText,
          footerText: brandForm.footerText,
          logoLightUrl: brandForm.logoLightUrl || undefined,
          logoDarkUrl: brandForm.logoDarkUrl || undefined,
          faviconUrl: brandForm.faviconUrl || undefined,
        });
        toast.success("Brand settings saved");
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || "Failed to save brand settings");
      }
    });
  }

  /* ---------------------------------------------------------- */
  /* PROFILE + TENANT (SYSTEM SETTINGS)                         */
  /* ---------------------------------------------------------- */

  const [profileForm, setProfileForm] = useState({
    name: user.name ?? "",
  });

  const [tenantForm, setTenantForm] = useState({
    name: tenant?.name ?? "",
    slug: tenant?.slug ?? "",
    domain: "",
  });

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = profileForm.name.trim();
    if (!name) {
      toast.error("Name is required.");
      return;
    }

    startTransition(async () => {
      try {
        await updateProfileAction({ name });
        toast.success("Profile updated");
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || "Failed to update profile");
      }
    });
  }

  function handleTenantSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;

    if (!canManageTenant) {
      toast.error("You do not have permission to update workspace settings.");
      return;
    }

    const name = tenantForm.name.trim();
    const slug = tenantForm.slug.trim();

    if (!name) {
      toast.error("Workspace name is required.");
      return;
    }

    startTransition(async () => {
      try {
        await updateTenantSettingsAction({
          name,
          slug,
          domain: tenantForm.domain || undefined,
        });
        toast.success("Workspace settings updated");
      } catch (err: any) {
        console.error(err);
        const msg =
          err?.message === "TENANT_SLUG_IN_USE"
            ? "That URL slug is already in use."
            : err?.message || "Failed to update workspace settings";
        toast.error(msg);
      }
    });
  }

  /* ---------------------------------------------------------- */
  /* NOTIFICATIONS (client-only demo)                           */
  /* ---------------------------------------------------------- */

  const [notificationsForm, setNotificationsForm] = useState({
    productUpdates: true,
    securityAlerts: true,
    marketing: false,
  });

  function handleNotificationsSubmit(e: React.FormEvent) {
    e.preventDefault();
    toast.success("Notification preferences saved (demo only).");
  }

  /* ---------------------------------------------------------- */
  /* LAYOUT                                                     */
  /* ---------------------------------------------------------- */

  const leftNav = [
    {
      key: "brand" as SettingsSection,
      label: "Brand Settings",
      icon: Palette,
    },
    {
      key: "system" as SettingsSection,
      label: "System Settings",
      icon: Settings2,
    },
    {
      key: "company" as SettingsSection,
      label: "Company Settings",
      icon: Building2,
    },
    {
      key: "email" as SettingsSection,
      label: "Email Settings",
      icon: Mail,
    },
    {
      key: "notifications" as SettingsSection,
      label: "Notification Settings",
      icon: Bell,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              System Settings
            </h1>
            <p className="text-xs text-muted-foreground">
              Manage brand, workspace, and communication preferences.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="flex items-center gap-1">
            <UserIcon className="h-3 w-3" />
            {user.email}
          </Badge>
          {tenant ? (
            <Badge
              variant="secondary"
              className="flex items-center gap-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-100"
            >
              <Building2 className="h-3 w-3" />
              {tenant.name}
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100"
            >
              <ShieldCheck className="h-3 w-3" />
              Central Hive
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm lg:flex-row">
        {/* LEFT VERTICAL NAV */}
        <div className="w-full border-b pb-3 lg:w-64 lg:border-b-0 lg:border-r lg:pr-3">
          <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Settings
          </div>
          <div className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:gap-1">
            {leftNav.map((item) => {
              const Icon = item.icon;
              const active = section === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSection(item.key)}
                  className={cn(
                    "flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                    active
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-md",
                      active ? "bg-white/15" : "bg-background"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL CONTENT */}
        <div className="flex-1 lg:pl-4">
          {/* BRAND SETTINGS */}
          {section === "brand" && (
            <Card>
              <CardHeader>
                <CardTitle>Brand Settings</CardTitle>
                <CardDescription>
                  Edit your brand details, logos, and favicon. Logos are picked
                  from your File Manager (images only).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  {/* Logo light */}
                  <div className="space-y-2">
                    <Label>Logo (for light backgrounds)</Label>
                    <div className="flex h-32 items-center justify-center rounded-md border border-dashed bg-muted/40">
                      {brandForm.logoLightUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={brandForm.logoLightUrl}
                          alt="Light logo"
                          className="max-h-24 max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No Logo
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openFileManager("logoLightUrl")}
                    >
                      Choose from File Manager
                    </Button>
                  </div>

                  {/* Logo dark */}
                  <div className="space-y-2">
                    <Label>Logo (for dark backgrounds)</Label>
                    <div className="flex h-32 items-center justify-center rounded-md border border-dashed bg-slate-900 text-slate-100">
                      {brandForm.logoDarkUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={brandForm.logoDarkUrl}
                          alt="Dark logo"
                          className="max-h-24 max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs opacity-70">No Logo</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openFileManager("logoDarkUrl")}
                    >
                      Choose from File Manager
                    </Button>
                  </div>

                  {/* Favicon */}
                  <div className="space-y-2">
                    <Label>Favicon</Label>
                    <div className="flex h-32 items-center justify-center rounded-md border border-dashed bg-muted/40">
                      {brandForm.faviconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={brandForm.faviconUrl}
                          alt="Favicon"
                          className="h-12 w-12 object-contain"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No Favicon
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openFileManager("faviconUrl")}
                    >
                      Choose from File Manager
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="brand-title">Title Text</Label>
                    <Input
                      id="brand-title"
                      value={brandForm.titleText}
                      onChange={(e) =>
                        setBrandForm((f) => ({
                          ...f,
                          titleText: e.target.value,
                        }))
                      }
                      placeholder="ERP Solution"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand-footer">Footer Text</Label>
                    <Input
                      id="brand-footer"
                      value={brandForm.footerText}
                      onChange={(e) =>
                        setBrandForm((f) => ({
                          ...f,
                          footerText: e.target.value,
                        }))
                      }
                      placeholder="ERP Solution"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleBrandSubmit}
                  disabled={isPending}
                  className="min-w-[140px]"
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* SYSTEM SETTINGS (PROFILE + WORKSPACE) */}
          {section === "system" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle>System Settings</CardTitle>
                  <CardDescription>
                    Manage your profile and workspace configuration.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Profile */}
                  <form onSubmit={handleProfileSubmit} className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full name</Label>
                      <Input
                        id="name"
                        value={profileForm.name}
                        onChange={(e) =>
                          setProfileForm((f) => ({
                            ...f,
                            name: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        value={user.email}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={isPending}>
                        {isPending ? "Saving..." : "Save Profile"}
                      </Button>
                    </div>
                  </form>

                  {!isCentral && (
                    <>
                      <Separator />
                      <form
                        onSubmit={handleTenantSubmit}
                        className="space-y-3"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="workspace-name">
                            Workspace name
                          </Label>
                          <Input
                            id="workspace-name"
                            value={tenantForm.name}
                            onChange={(e) =>
                              setTenantForm((f) => ({
                                ...f,
                                name: e.target.value,
                              }))
                            }
                            disabled={!canManageTenant || isPending}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="workspace-slug">
                            Workspace URL slug
                          </Label>
                          <Input
                            id="workspace-slug"
                            value={tenantForm.slug}
                            onChange={(e) =>
                              setTenantForm((f) => ({
                                ...f,
                                slug: e.target.value,
                              }))
                            }
                            disabled={!canManageTenant || isPending}
                            placeholder="e.g. acme-corp"
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Changing the slug updates your tenant URL.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="workspace-domain">
                            Custom domain (optional)
                          </Label>
                          <div className="flex items-center gap-2">
                            <Globe2 className="h-4 w-4 text-muted-foreground" />
                            <Input
                              id="workspace-domain"
                              value={tenantForm.domain}
                              onChange={(e) =>
                                setTenantForm((f) => ({
                                  ...f,
                                  domain: e.target.value,
                                }))
                              }
                              disabled={!canManageTenant || isPending}
                              placeholder="e.g. acme.yourapp.com"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <p className="text-[11px] text-muted-foreground">
                            Only workspace admins can modify tenant settings.
                          </p>
                          <Button
                            type="submit"
                            disabled={!canManageTenant || isPending}
                            className="min-w-[140px]"
                          >
                            {isPending ? "Saving..." : "Save Workspace"}
                          </Button>
                        </div>
                      </form>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle>Security summary</CardTitle>
                  <CardDescription>
                    Overview of your current access and roles.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span>Password</span>
                    <Badge variant="outline" className="text-emerald-600">
                      Set
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Context</span>
                    <span className="text-muted-foreground">
                      {isCentral ? "Central platform" : "Tenant workspace"}
                    </span>
                  </div>
                  <p className="pt-2 text-[11px] text-muted-foreground">
                    You can wire this card into BetterAuth (password reset,
                    MFA, sessions) later.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* COMPANY SETTINGS */}
          {section === "company" && (
            <Card>
              <CardHeader>
                <CardTitle>Company Settings</CardTitle>
                <CardDescription>
                  Basic company information used across invoices, emails, and
                  documents.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Hook this card to your company/profile tables when you’re
                ready (address, phone, tax ID, etc.).
              </CardContent>
            </Card>
          )}

          {/* EMAIL SETTINGS */}
          {section === "email" && (
            <Card>
              <CardHeader>
                <CardTitle>Email Settings</CardTitle>
                <CardDescription>
                  Configure SMTP / provider settings for tenant notifications.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                You already have SMTP per tenant – plug the forms here into that
                config when you want to expose it in the UI.
              </CardContent>
            </Card>
          )}

          {/* NOTIFICATION SETTINGS */}
          {section === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>
                  Choose which alerts and updates you want to receive.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleNotificationsSubmit}
                  className="space-y-4 text-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium">Product updates</div>
                      <p className="text-xs text-muted-foreground">
                        Release notes and feature highlights.
                      </p>
                    </div>
                    <Switch
                      checked={notificationsForm.productUpdates}
                      onCheckedChange={(val) =>
                        setNotificationsForm((f) => ({
                          ...f,
                          productUpdates: !!val,
                        }))
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium">Security alerts</div>
                      <p className="text-xs text-muted-foreground">
                        Login alerts and critical security notifications.
                      </p>
                    </div>
                    <Switch
                      checked={notificationsForm.securityAlerts}
                      onCheckedChange={(val) =>
                        setNotificationsForm((f) => ({
                          ...f,
                          securityAlerts: !!val,
                        }))
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium">Marketing messages</div>
                      <p className="text-xs text-muted-foreground">
                        Educational content, promos, and webinars.
                      </p>
                    </div>
                    <Switch
                      checked={notificationsForm.marketing}
                      onCheckedChange={(val) =>
                        setNotificationsForm((f) => ({
                          ...f,
                          marketing: !!val,
                        }))
                      }
                    />
                  </div>

                  <CardFooter className="mt-2 flex justify-end gap-2 px-0">
                    <Button type="submit" disabled={isPending}>
                      Save preferences
                    </Button>
                  </CardFooter>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
