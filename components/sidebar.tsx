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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslation } from "@/lib/hooks/use-translation";

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

  // ✅ REAL props
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

const STORAGE_KEY = "hive-sidebar-collapsed";

export function Sidebar({
  user,
  permissions = [],
  brand,
  isOpen,
  setIsOpen,
}: SidebarProps) {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();

  const navItems = useMemo(
    () => [
      {
        key: "dashboard",
        tour: "nav-dashboard",
        label: t("sidebar.dashboard", "Dashboard"),
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        key: "tenants",
        tour: "nav-tenants",
        label: t("sidebar.tenants", "Tenants"),
        href: "/tenants",
        icon: Building2,
      },
      {
        key: "security",
        tour: "nav-security",
        label: t("sidebar.security", "Security"),
        href: "/security",
        icon: ShieldCheck,
      },
      {
        key: "files",
        tour: "nav-files",
        label: t("sidebar.files", "Files"),
        href: "/files",
        icon: Folder,
      },
      {
        key: "billing",
        tour: "nav-billing",
        label: t("sidebar.billing", "Billing"),
        href: "/billing",
        icon: CreditCard,
      },
      {
        key: "settings",
        tour: "nav-settings",
        label: t("sidebar.settings", "Settings"),
        href: "/settings",
        icon: Settings,
      },
    ],
    [t]
  );

  // ✅ collapsed = desktop compact mode (saved)
  // ✅ isOpen = mobile overlay open state
  const [collapsed, setCollapsed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved !== null) setCollapsed(saved === "true");
    } catch {}
    setMounted(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {}
  };

  const has = (key: string) => permissions.includes(key);
  const hasAny = (keys: string[]) => keys.some((k) => permissions.includes(k));

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
  const canSeeFiles = hasAny(["files.view", "manage_files"]);
  const canSeeBilling = hasAny(["manage_billing", "billing.view"]);
  const canSeeSettings = hasAny([
    "settings.brand.view",
    "settings.company.view",
    "settings.email.view",
    "settings.notifications.view",
    "settings.localization.view",
    "manage_settings",
    "manage_security",
    "manage_tenants",
  ]);

  const isVisible = (href: string) => {
    if (href === "/dashboard") return canSeeDashboard;
    if (href === "/tenants") return canSeeTenants;
    if (href === "/security") return canSeeSecurity;
    if (href === "/files") return canSeeFiles;
    if (href === "/billing") return canSeeBilling;
    if (href === "/settings") return canSeeSettings;
    return true;
  };

  const appTitle = brand?.titleText?.trim() || "Hive";
  const { logoLightUrl, logoDarkUrl, sidebarIconUrl } = brand || {};

  // ✅ avoid hydration mismatch: theme value is reliable only after mount
  const isDark = mounted ? resolvedTheme === "dark" : false;

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

  const maybeWrapWithTooltip = (label: string, node: ReactNode) => {
    if (!collapsed) return node;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right" align="center">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  };

  const closeMobile = () => setIsOpen(false);

  return (
    <TooltipProvider delayDuration={120}>
      {/* ✅ Backdrop for mobile overlay */}
      {isOpen && (
        <button
          type="button"
          onClick={closeMobile}
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        data-tour="sidebar"
        className={cn(
          // base
          "z-50 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground dark:bg-slate-950 dark:text-slate-50",

          // desktop width modes
          collapsed ? "lg:w-[4.25rem]" : "lg:w-64",

          // ✅ desktop: always visible
          "hidden lg:flex lg:relative",

          // ✅ mobile overlay
          isOpen && "fixed inset-y-0 left-0 w-[18rem] sm:w-64 flex lg:flex",

          // animation (only after mount)
          mounted && "transition-all duration-300"
        )}
      >
        {/* Brand header */}
        <div className="flex items-center px-3 py-5">
          {collapsed ? (
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
            if (!isVisible(item.href)) return null;

            const Icon = item.icon;
            const active = pathname.startsWith(item.href);

            const link = (
              <Link
                data-tour={item.tour} // ✅ TOUR TARGET PER LINK
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-2 py-2 text-xs font-medium transition-all",
                  "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  "dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-slate-50",
                  active &&
                    "bg-slate-900 text-slate-50 shadow-md shadow-slate-900/20 dark:bg-slate-800 dark:text-slate-50 dark:shadow-emerald-500/20"
                )}
                onClick={closeMobile} // ✅ close on mobile after nav
                aria-current={active ? "page" : undefined}
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

                {/* label only on desktop expanded */}
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );

            return <div key={item.key}>{maybeWrapWithTooltip(item.label, link)}</div>;
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

        {/* Collapsed toggle (desktop) */}
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            "absolute top-16 -right-3 hidden lg:flex h-8 w-8 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg shadow-sidebar-ring/30 transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800",
            "focus:outline-none"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>
    </TooltipProvider>
  );
}
