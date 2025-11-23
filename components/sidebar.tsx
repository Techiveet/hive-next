"use client";

import {
  Building2,
  ChevronLeft,
  CreditCard,
  LayoutDashboard,
  Menu,
  Settings,
  Users,
} from "lucide-react";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useState } from "react";

type SidebarProps = {
  user?: {
    name: string | null;
    email: string;
  };
};

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Tenants", href: "/tenants", icon: Building2 },
  { label: "Users", href: "/users", icon: Users },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ user }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(true);
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 dark:bg-slate-950 dark:text-slate-50",
        collapsed ? "w-[4.25rem]" : "w-64"
      )}
    >
      {/* Brand */}
      <div className="flex items-center justify-center px-3 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-chart-1 to-chart-2 text-sm font-bold text-slate-950 shadow-lg shadow-chart-1/30">
          H
        </div>
        {!collapsed && (
          <div className="ml-3 flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">
              Hive
            </span>
            <span className="text-[10px] uppercase text-muted-foreground">
              Multi-tenant hub
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="mt-2 flex-1 space-y-1 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-2 py-2 text-xs font-medium transition-all",
                // LIGHT MODE
                "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                // DARK MODE
                "dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-slate-50",
                active &&
                  cn(
                    // active (light)
                    "bg-slate-900 text-slate-50 shadow-md shadow-slate-900/20",
                    // active (dark)
                    "dark:bg-slate-800 dark:text-slate-50 dark:shadow-emerald-500/20"
                  )
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-2xl transition-all",
                  active
                    ? // active icon
                      "bg-slate-900 text-slate-50 dark:bg-slate-900"
                    : // idle icon
                      "bg-slate-100 text-slate-500 group-hover:bg-slate-900 group-hover:text-slate-50 dark:bg-slate-900/40 dark:text-slate-300 dark:group-hover:bg-slate-900"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar footer */}
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

      {/* Retract / expand handle */}
      <button
        onClick={() => setCollapsed((prev) => !prev)}
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
