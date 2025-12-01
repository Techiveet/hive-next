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
  updateCompanySettingsAction,
  updateEmailSettingsAction,
  updateProfileAction,
  updateTenantSettingsAction,
} from "../settings-actions";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
    sidebarIconUrl: string;
  };
  companySettings: {
    companyName: string;
    legalName: string;
    email: string;
    phone: string;
    website: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    taxId: string;
    registrationNumber: string;
  };
 emailSettings: {
  provider: "RESEND" | "SMTP";
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  smtpHost: string;
  smtpPort: number | null;
  smtpUser: string;
  smtpSecurity: "tls" | "ssl" | "none";
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
  companySettings,
  emailSettings,
}: SettingsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isCentral = !tenant;

  const has = (key: string) => permissions.includes(key);
  const hasAny = (keys: string[]) => keys.some((k) => permissions.includes(k));

  // ---------------------------------------------------------------------------
  // SETTINGS PERMISSION MODEL (no more manage_settings override for tabs)
  // ---------------------------------------------------------------------------

  // BRAND
  const canViewBrandSettings = hasAny([
    "settings.brand.view",
    "settings.brand.update",
  ]);

  const canEditBrandSettings = has("settings.brand.update");

  // SYSTEM / TENANT
  // Profile is always editable by the logged-in user.
  // Tenant/workspace settings require more powerful perms:
  const canManageTenant = hasAny([
    "settings.localization.update",
    "settings.company.update",
    "manage_tenants",
    "manage_security",
  ]);

  // COMPANY
  const canViewCompanySettings = hasAny([
    "settings.company.view",
    "settings.company.update",
  ]);

  const canEditCompanySettings = has("settings.company.update");

  // EMAIL
  const canViewEmailSettings = hasAny([
    "settings.email.view",
    "settings.email.update",
  ]);

  const canEditEmailSettings = has("settings.email.update");

  // NOTIFICATIONS
  const canViewNotificationSettings = hasAny([
    "settings.notifications.view",
    "settings.notifications.update",
  ]);

  const canEditNotificationSettings = has("settings.notifications.update");

  // ---------------------------------------------------------------------------
  // LEFT NAV MODEL (tabs + view perms)
  // ---------------------------------------------------------------------------

  const leftNav = [
    {
      key: "brand" as SettingsSection,
      label: "Brand Settings",
      icon: Palette,
      canView: canViewBrandSettings,
    },
    {
      key: "system" as SettingsSection,
      label: "System Settings",
      icon: Settings2,
      canView: true, // profile is always visible
    },
    {
      key: "company" as SettingsSection,
      label: "Company Settings",
      icon: Building2,
      canView: canViewCompanySettings,
    },
    {
      key: "email" as SettingsSection,
      label: "Email Settings",
      icon: Mail,
      canView: canViewEmailSettings,
    },
    {
      key: "notifications" as SettingsSection,
      label: "Notification Settings",
      icon: Bell,
      canView: canViewNotificationSettings,
    },
  ] satisfies {
    key: SettingsSection;
    label: string;
    icon: React.ComponentType<any>;
    canView: boolean;
  }[];

  const visibleSections = leftNav.filter((item) => item.canView);
  const visibleSectionKeys = visibleSections.map((i) => i.key);

  const sectionFromUrl = searchParams.get("section") as SettingsSection | null;

  const initialSection: SettingsSection =
    sectionFromUrl && visibleSectionKeys.includes(sectionFromUrl)
      ? sectionFromUrl
      : visibleSectionKeys[0] ?? "system";

  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [isPending, startTransition] = useTransition();

  // If current section is no longer visible (after permission changes), fall back
  React.useEffect(() => {
    if (!visibleSectionKeys.includes(section) && visibleSectionKeys[0]) {
      setSection(visibleSectionKeys[0]);
    }
  }, [section, visibleSectionKeys]);

  const handleSectionClick = (next: SettingsSection) => {
    setSection(next);

    const params = new URLSearchParams(searchParams.toString());
    params.set("section", next);

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // ---------------------------------------------------------------------------
  // BRAND FORM
  // ---------------------------------------------------------------------------

  const [brandForm, setBrandForm] = useState({
    titleText: brandSettings.titleText,
    footerText: brandSettings.footerText,
    logoLightUrl: brandSettings.logoLightUrl,
    logoDarkUrl: brandSettings.logoDarkUrl,
    faviconUrl: brandSettings.faviconUrl,
    sidebarIconUrl: brandSettings.sidebarIconUrl,
  });

  type BrandImageField =
    | "logoLightUrl"
    | "logoDarkUrl"
    | "faviconUrl"
    | "sidebarIconUrl";

  function openFileManager(target: BrandImageField) {
    if (typeof window === "undefined") return;
    if (!canEditBrandSettings) {
      toast.error("You do not have permission to update brand settings.");
      return;
    }

    window.dispatchEvent(
      new CustomEvent("open-file-manager", {
        detail: {
          filter: "images" as const,
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

    if (!canEditBrandSettings) {
      toast.error("You do not have permission to update brand settings.");
      return;
    }

    const toastId = toast.loading("Saving brand settings...");

    startTransition(async () => {
      try {
        await updateBrandSettingsAction({
          titleText: brandForm.titleText,
          footerText: brandForm.footerText,
          logoLightUrl: brandForm.logoLightUrl || undefined,
          logoDarkUrl: brandForm.logoDarkUrl || undefined,
          faviconUrl: brandForm.faviconUrl || undefined,
          sidebarIconUrl: brandForm.sidebarIconUrl || undefined,
        });

        toast.success("Brand settings saved", {
          id: toastId,
        });
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || "Failed to save brand settings", {
          id: toastId,
        });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // PROFILE + TENANT (SYSTEM SETTINGS)
  // ---------------------------------------------------------------------------

  const [profileForm, setProfileForm] = useState({
    name: user.name ?? "",
  });

  const [tenantForm, setTenantForm] = useState({
    name: tenant?.name ?? "",
    slug: tenant?.slug ?? "",
    domain: "",
  });

  const [companyForm, setCompanyForm] = useState({
    companyName: companySettings.companyName,
    legalName: companySettings.legalName,
    email: companySettings.email,
    phone: companySettings.phone,
    website: companySettings.website,
    addressLine1: companySettings.addressLine1,
    addressLine2: companySettings.addressLine2,
    city: companySettings.city,
    state: companySettings.state,
    postalCode: companySettings.postalCode,
    country: companySettings.country,
    taxId: companySettings.taxId,
    registrationNumber: companySettings.registrationNumber,
  });

const [emailForm, setEmailForm] = useState({
  provider: emailSettings.provider ?? "RESEND",
  fromName: emailSettings.fromName,
  fromEmail: emailSettings.fromEmail,
  replyToEmail: emailSettings.replyToEmail,
  smtpHost: emailSettings.smtpHost,
  smtpPort: emailSettings.smtpPort ? String(emailSettings.smtpPort) : "",
  smtpUser: emailSettings.smtpUser,
  smtpSecurity: emailSettings.smtpSecurity ?? "tls",
});


  function handleCompanySubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!canEditCompanySettings) {
      toast.error("You do not have permission to update company settings.");
      return;
    }

    const name = companyForm.companyName.trim();
    if (!name) {
      toast.error("Company name is required.");
      return;
    }

    startTransition(async () => {
      try {
        await updateCompanySettingsAction({
          companyName: name,
          legalName: companyForm.legalName,
          email: companyForm.email,
          phone: companyForm.phone,
          website: companyForm.website,
          addressLine1: companyForm.addressLine1,
          addressLine2: companyForm.addressLine2,
          city: companyForm.city,
          state: companyForm.state,
          postalCode: companyForm.postalCode,
          country: companyForm.country,
          taxId: companyForm.taxId,
          registrationNumber: companyForm.registrationNumber,
        });
        toast.success("Company settings updated");
      } catch (err: any) {
        console.error(err);
        toast.error(err?.message || "Failed to update company settings");
      }
    });
  }

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

function handleEmailSubmit(e: React.FormEvent) {
  e.preventDefault();

  if (!canEditEmailSettings) {
    toast.error("You do not have permission to update email settings.");
    return;
  }

  const fromName = emailForm.fromName.trim();
  const fromEmail = emailForm.fromEmail.trim();

  if (!fromName) {
    toast.error("From name is required.");
    return;
  }

  if (!fromEmail) {
    toast.error("From email is required.");
    return;
  }

  const provider =
    emailForm.provider === "SMTP" ? "SMTP" : "RESEND";

  const smtpPortNumber =
    provider === "SMTP" && emailForm.smtpPort
      ? Number(emailForm.smtpPort)
      : undefined;

  if (provider === "SMTP" && emailForm.smtpPort && Number.isNaN(smtpPortNumber)) {
    toast.error("SMTP port must be a number.");
    return;
  }

  startTransition(async () => {
    try {
      await updateEmailSettingsAction({
        provider,
        fromName,
        fromEmail,
        replyToEmail: emailForm.replyToEmail || undefined,
        smtpHost: provider === "SMTP" ? emailForm.smtpHost : undefined,
        smtpPort: smtpPortNumber,
        smtpUser: provider === "SMTP" ? emailForm.smtpUser : undefined,
        smtpSecurity:
          provider === "SMTP"
            ? (emailForm.smtpSecurity as "tls" | "ssl" | "none")
            : undefined,
      });

      toast.success("Email settings updated");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to update email settings");
    }
  });
}


  // ---------------------------------------------------------------------------
  // NOTIFICATIONS (demo – permission-gated)
  // ---------------------------------------------------------------------------

  const [notificationsForm, setNotificationsForm] = useState({
    productUpdates: true,
    securityAlerts: true,
    marketing: false,
  });

  function handleNotificationsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEditNotificationSettings) {
      toast.error("You do not have permission to update notification settings.");
      return;
    }
    toast.success("Notification preferences saved (demo only).");
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

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
        {/* LEFT NAV */}
        <div className="w-full border-b pb-3 lg:w-64 lg:border-b-0 lg:border-r lg:pr-3">
          <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            Settings
          </div>
          <div className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:gap-1">
            {visibleSections.map((item) => {
              const Icon = item.icon;
              const active = section === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSectionClick(item.key)}
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
          {section === "brand" && canViewBrandSettings && (
            <Card>
              <CardHeader>
                <CardTitle>Brand Settings</CardTitle>
                <CardDescription>
                  Edit your brand details, logos, favicon and sidebar icon.
                  Logos are picked from your File Manager (images only).
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* IMAGES GRID */}
                <div className="grid gap-4 md:grid-cols-4">
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
                      disabled={!canEditBrandSettings || isPending}
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
                      disabled={!canEditBrandSettings || isPending}
                    >
                      Choose from File Manager
                    </Button>
                  </div>

                  {/* Favicon */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Favicon</Label>
                      <span className="text-[10px] text-muted-foreground">
                        Browser tab icon
                      </span>
                    </div>
                    <div className="flex h-32 items-center justify-center rounded-md border border-dashed bg-muted/40">
                      {brandForm.faviconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={brandForm.faviconUrl}
                          alt="Favicon"
                          className="h-12 w-12 rounded object-contain"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No favicon
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openFileManager("faviconUrl")}
                      disabled={!canEditBrandSettings || isPending}
                    >
                      Choose from File Manager
                    </Button>
                  </div>

                  {/* Sidebar icon */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Sidebar icon</Label>
                      <span className="text-[10px] text-muted-foreground">
                        Collapsed menu
                      </span>
                    </div>
                    <div className="flex h-32 items-center justify-center rounded-md border border-dashed bg-indigo-50/60 dark:bg-indigo-950/30">
                      {brandForm.sidebarIconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={brandForm.sidebarIconUrl}
                          alt="Sidebar icon"
                          className="h-10 w-10 rounded-2xl object-contain shadow-sm"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-xs font-semibold text-white shadow-md">
                          H
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openFileManager("sidebarIconUrl")}
                      disabled={!canEditBrandSettings || isPending}
                    >
                      Choose from File Manager
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* TEXT INPUTS: TITLE + FOOTER */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="brand-title">App title</Label>
                    <Input
                      id="brand-title"
                      value={brandForm.titleText}
                      onChange={(e) =>
                        setBrandForm((f) => ({
                          ...f,
                          titleText: e.target.value,
                        }))
                      }
                      placeholder="Hive"
                      disabled={!canEditBrandSettings || isPending}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Used in the browser title and across the UI.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="brand-footer">Footer text</Label>
                    <Input
                      id="brand-footer"
                      value={brandForm.footerText}
                      onChange={(e) =>
                        setBrandForm((f) => ({
                          ...f,
                          footerText: e.target.value,
                        }))
                      }
                      placeholder="Powered by Hive"
                      disabled={!canEditBrandSettings || isPending}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Shown in the dashboard footer and emails (optional).
                    </p>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleBrandSubmit}
                  disabled={isPending || !canEditBrandSettings}
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
                    You can wire this card into BetterAuth (password reset, MFA,
                    sessions) later.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* COMPANY SETTINGS */}
          {section === "company" && canViewCompanySettings && (
            <Card>
              <CardHeader>
                <CardTitle>Company Settings</CardTitle>
                <CardDescription>
                  Basic company information used on invoices, emails, and
                  documents.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleCompanySubmit}
                  className="space-y-6 text-sm"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="company-name">Company name</Label>
                      <Input
                        id="company-name"
                        value={companyForm.companyName}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            companyName: e.target.value,
                          }))
                        }
                        placeholder="Acme Corporation"
                        required
                        disabled={!canEditCompanySettings || isPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company-legal-name">Legal name</Label>
                      <Input
                        id="company-legal-name"
                        value={companyForm.legalName}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            legalName: e.target.value,
                          }))
                        }
                        placeholder="Acme Corporation PLC"
                        disabled={!canEditCompanySettings || isPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company-tax-id">Tax ID</Label>
                      <Input
                        id="company-tax-id"
                        value={companyForm.taxId}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            taxId: e.target.value,
                          }))
                        }
                        placeholder="TIN / VAT number"
                        disabled={!canEditCompanySettings || isPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company-reg">Registration number</Label>
                      <Input
                        id="company-reg"
                        value={companyForm.registrationNumber}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            registrationNumber: e.target.value,
                          }))
                        }
                        placeholder="Trade registration number"
                        disabled={!canEditCompanySettings || isPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company-email">Contact email</Label>
                      <Input
                        id="company-email"
                        type="email"
                        value={companyForm.email}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            email: e.target.value,
                          }))
                        }
                        placeholder="billing@acme.com"
                        disabled={!canEditCompanySettings || isPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company-phone">Phone</Label>
                      <Input
                        id="company-phone"
                        value={companyForm.phone}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            phone: e.target.value,
                          }))
                        }
                        placeholder="+251 900 000 000"
                        disabled={!canEditCompanySettings || isPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company-website">Website</Label>
                      <Input
                        id="company-website"
                        value={companyForm.website}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            website: e.target.value,
                          }))
                        }
                        placeholder="https://acme.com"
                        disabled={!canEditCompanySettings || isPending}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="addr-line1">Address line 1</Label>
                      <Input
                        id="addr-line1"
                        value={companyForm.addressLine1}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            addressLine1: e.target.value,
                          }))
                        }
                        placeholder="Bole, Main Street 123"
                        disabled={!canEditCompanySettings || isPending}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="addr-line2">Address line 2</Label>
                      <Input
                        id="addr-line2"
                        value={companyForm.addressLine2}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            addressLine2: e.target.value,
                          }))
                        }
                        placeholder="Office 402"
                        disabled={!canEditCompanySettings || isPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={companyForm.city}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            city: e.target.value,
                          }))
                        }
                        disabled={!canEditCompanySettings || isPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="state">State / Region</Label>
                      <Input
                        id="state"
                        value={companyForm.state}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            state: e.target.value,
                          }))
                        }
                        disabled={!canEditCompanySettings || isPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="postal">Postal code</Label>
                      <Input
                        id="postal"
                        value={companyForm.postalCode}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            postalCode: e.target.value,
                          }))
                        }
                        disabled={!canEditCompanySettings || isPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        value={companyForm.country}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            country: e.target.value,
                          }))
                        }
                        disabled={!canEditCompanySettings || isPending}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <p className="text-[11px] text-muted-foreground">
                      Used on invoices, emails, and system-generated documents.
                    </p>
                    <Button
                      type="submit"
                      disabled={isPending || !canEditCompanySettings}
                      className="min-w-[160px]"
                    >
                      {isPending ? "Saving..." : "Save Company Settings"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* EMAIL SETTINGS */}
       {section === "email" && canViewEmailSettings && (
  <Card>
    <CardHeader>
      <CardTitle>Email Settings</CardTitle>
      <CardDescription>
        Configure provider and sender details for system emails.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <form onSubmit={handleEmailSubmit} className="space-y-6 text-sm">
        {/* Provider */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email-provider">Email provider</Label>
            <select
              id="email-provider"
              value={emailForm.provider}
              onChange={(e) =>
                setEmailForm((f) => ({
                  ...f,
                  provider: e.target.value as "RESEND" | "SMTP",
                }))
              }
              disabled={!canEditEmailSettings || isPending}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="RESEND">Resend</option>
              <option value="SMTP">SMTP</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              Choose which provider to use when sending system emails.
            </p>
          </div>
        </div>

        {/* Common fields */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email-from-name">From name</Label>
            <Input
              id="email-from-name"
              value={emailForm.fromName}
              onChange={(e) =>
                setEmailForm((f) => ({
                  ...f,
                  fromName: e.target.value,
                }))
              }
              placeholder="Hive Notifications"
              disabled={!canEditEmailSettings || isPending}
            />
            <p className="text-[11px] text-muted-foreground">
              This appears as the sender name in the recipient&apos;s inbox.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-from-address">From email</Label>
            <Input
              id="email-from-address"
              type="email"
              value={emailForm.fromEmail}
              onChange={(e) =>
                setEmailForm((f) => ({
                  ...f,
                  fromEmail: e.target.value,
                }))
              }
              placeholder="no-reply@your-domain.com"
              disabled={!canEditEmailSettings || isPending}
            />
            <p className="text-[11px] text-muted-foreground">
              For Resend, must be a verified domain. For SMTP, must match your server.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-reply-to">Reply-to (optional)</Label>
            <Input
              id="email-reply-to"
              type="email"
              value={emailForm.replyToEmail}
              onChange={(e) =>
                setEmailForm((f) => ({
                  ...f,
                  replyToEmail: e.target.value,
                }))
              }
              placeholder="support@your-domain.com"
              disabled={!canEditEmailSettings || isPending}
            />
            <p className="text-[11px] text-muted-foreground">
              Replies to your emails will go to this address if set.
            </p>
          </div>
        </div>

        {/* SMTP-only config */}
        {emailForm.provider === "SMTP" && (
          <>
            <Separator />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="smtp-host">SMTP host</Label>
                <Input
                  id="smtp-host"
                  value={emailForm.smtpHost}
                  onChange={(e) =>
                    setEmailForm((f) => ({
                      ...f,
                      smtpHost: e.target.value,
                    }))
                  }
                  placeholder="smtp.mailtrap.io"
                  disabled={!canEditEmailSettings || isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-port">SMTP port</Label>
                <Input
                  id="smtp-port"
                  value={emailForm.smtpPort}
                  onChange={(e) =>
                    setEmailForm((f) => ({
                      ...f,
                      smtpPort: e.target.value,
                    }))
                  }
                  placeholder="587"
                  disabled={!canEditEmailSettings || isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-user">SMTP user</Label>
                <Input
                  id="smtp-user"
                  value={emailForm.smtpUser}
                  onChange={(e) =>
                    setEmailForm((f) => ({
                      ...f,
                      smtpUser: e.target.value,
                    }))
                  }
                  placeholder="SMTP username"
                  disabled={!canEditEmailSettings || isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-security">Security</Label>
                <select
                  id="smtp-security"
                  value={emailForm.smtpSecurity}
                  onChange={(e) =>
                    setEmailForm((f) => ({
                      ...f,
                      smtpSecurity: e.target.value as "tls" | "ssl" | "none",
                    }))
                  }
                  disabled={!canEditEmailSettings || isPending}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="tls">TLS (STARTTLS)</option>
                  <option value="ssl">SSL</option>
                  <option value="none">None</option>
                </select>
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-muted-foreground">
            Provider credentials (Resend API key, SMTP password) are stored in
            server environment variables, not in the database.
          </p>
          <Button
            type="submit"
            disabled={isPending || !canEditEmailSettings}
            className="min-w-[160px]"
          >
            {isPending ? "Saving..." : "Save Email Settings"}
          </Button>
        </div>

        {!canEditEmailSettings && (
          <p className="mt-2 text-[11px] text-destructive">
            You do not have permission to modify email settings.
          </p>
        )}
      </form>
    </CardContent>
  </Card>
)}

          {/* NOTIFICATION SETTINGS */}
          {section === "notifications" && canViewNotificationSettings && (
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
                      disabled={!canEditNotificationSettings || isPending}
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
                      disabled={!canEditNotificationSettings || isPending}
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
                      disabled={!canEditNotificationSettings || isPending}
                    />
                  </div>

                  <CardFooter className="mt-2 flex justify-end gap-2 px-0">
                    <Button
                      type="submit"
                      disabled={isPending || !canEditNotificationSettings}
                    >
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
