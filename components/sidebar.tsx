"use client";

import {
  Building2,
  ChevronLeft,
  CreditCard,
  Folder,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

type SidebarProps = {
  user?: {
    name: string | null;
    email: string;
  };
  permissions?: string[];
  brand?: {
    titleText?: string | null;
    logoLightUrl?: string | null;
    logoDarkUrl?: string | null;
    sidebarIconUrl?: string | null;
  };
};

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tenants", href: "/tenants", icon: Building2 },
  { label: "Security", href: "/security", icon: ShieldCheck },
  { label: "Files", href: "/files", icon: Folder },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings },
];

const STORAGE_KEY = "hive-sidebar-collapsed";

export function Sidebar({ user, permissions = [], brand }: SidebarProps) {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();

  // collapsed state + “mounted” flag so we don’t animate on first paint
  const [collapsed, setCollapsed] = useState(true);
  const [mounted, setMounted] = useState(false);

  // load saved collapsed state AFTER mount
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
  };

  const has = (key: string) => permissions.includes(key);
  const hasAny = (keys: string[]) => keys.some((k) => permissions.includes(k));

  // ---- PERMISSION GUARDS ---------------------------------------------------

  // dashboard – dedicated key, but allow “big” admins to see it too
  const canSeeDashboard =
    has("dashboard.view") ||
    hasAny(["view_security", "manage_security", "manage_tenants", "manage_billing"]);

  const canSeeTenants = has("manage_tenants");

  const canSeeSecurity = hasAny([
    "view_security",
    "manage_security",
    "manage_users",
    "manage_roles",
  ]);

  // files – new granular keys + legacy manage_files
  const canSeeFiles = hasAny(["files.view", "manage_files"]);

  // billing – main billing permission (you can add more keys here later)
  const canSeeBilling = hasAny(["manage_billing", "billing.view"]);

   // settings – brand / company / email / notifications / localization OR high-level admins
  const canSeeSettings = hasAny([
    "settings.brand.view",
    "settings.company.view",
    "settings.email.view",
    "settings.notifications.view",
    "settings.localization.view",
    "manage_settings",     // 🔥 full settings manager
    "manage_security",
    "manage_tenants",
  ]);


  const appTitle = brand?.titleText?.trim() || "Hive";
  const { logoLightUrl, logoDarkUrl, sidebarIconUrl } = brand || {};

  // Decide which logo to use based on theme (with sensible fallbacks)
  const isDark = resolvedTheme === "dark";
  const logoForTheme = isDark
    ? logoDarkUrl || logoLightUrl || null
    : logoLightUrl || logoDarkUrl || null;

  const hasLogo = !!logoForTheme;
  const hasFavicon = !!sidebarIconUrl;

  const fallbackPill = (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-chart-1 to-chart-2 text-sm font-bold text-slate-950 shadow-lg shadow-chart-1/30">
      {appTitle.charAt(0).toUpperCase()}
    </div>
  );

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground dark:bg-slate-950 dark:text-slate-50",
        collapsed ? "w-[4.25rem]" : "w-64",
        mounted && "transition-all duration-300"
      )}
    >
      {/* Brand header */}
      <div className="flex items-center px-3 py-5">
        {collapsed ? (
          // collapsed → favicon or pill
          <div className="mx-auto flex w-full justify-center">
            {hasFavicon ? (
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl bg-background shadow-lg shadow-chart-1/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sidebarIconUrl!}
                  alt={appTitle}
                  className="h-7 w-7 object-contain"
                />
              </div>
            ) : (
              fallbackPill
            )}
          </div>
        ) : (
          // expanded → logo + text
          <div className="flex w-full items-center gap-3 overflow-hidden px-2">
            <div className="flex h-9 min-w-9 items-center justify-center">
              {hasLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoForTheme!}
                  alt={appTitle}
                  className="h-8 w-auto max-w-[140px] object-contain"
                />
              ) : (
                fallbackPill
              )}
            </div>

            <div className="flex flex-col overflow-hidden leading-tight">
              <span className="truncate text-sm font-semibold tracking-tight">
                {appTitle}
              </span>
              <span className="truncate text-[10px] uppercase text-muted-foreground">
                Multi-tenant hub
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="mt-2 flex-1 space-y-1 px-2">
        {navItems.map((item) => {
          // centralised visibility rules per nav entry
          if (item.href === "/dashboard" && !canSeeDashboard) return null;
          if (item.href === "/tenants" && !canSeeTenants) return null;
          if (item.href === "/security" && !canSeeSecurity) return null;
          if (item.href === "/files" && !canSeeFiles) return null;
          if (item.href === "/billing" && !canSeeBilling) return null;
          if (item.href === "/settings" && !canSeeSettings) return null;

          const Icon = item.icon;
          const active = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-2 py-2 text-xs font-medium transition-all",
                "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                "dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-slate-50",
                active &&
                  "bg-slate-900 text-slate-50 shadow-md shadow-slate-900/20 dark:bg-slate-800 dark:text-slate-50 dark:shadow-emerald-500/20"
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition-all",
                  active
                    ? "bg-slate-900 text-slate-50 dark:bg-slate-900"
                    : "bg-slate-100 text-slate-500 group-hover:bg-slate-900 group-hover:text-slate-50 dark:bg-slate-900/40 dark:text-slate-300 dark:group-hover:bg-slate-900"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-muted-foreground dark:border-slate-800">
          <div className="truncate font-medium text-sidebar-foreground dark:text-slate-200">
            {user?.name ?? user?.email ?? "Not signed in"}
          </div>
          {user?.email && (
            <div className="truncate text-[10px] text-muted-foreground dark:text-slate-400">
              {user.email}
            </div>
          )}
        </div>
      )}

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={toggleSidebar}
        className={cn(
          "absolute top-16 -right-3 flex h-8 w-8 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg shadow-sidebar-ring/30 transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800",
          "focus:outline-none"
        )}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <Menu className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </aside>
  );
}
