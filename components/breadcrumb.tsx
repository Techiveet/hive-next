"use client";

import * as React from "react";

import { ChevronRight, Home } from "lucide-react";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type BreadcrumbItem = {
  /** What to display – can be plain text or any React node */
  label: React.ReactNode;
  /** Optional href – if omitted, item is rendered as "current page" (no link) */
  href?: string;
};

type BreadcrumbProps = {
  /**
   * Optional explicit items.
   * If omitted, items are generated from the current URL.
   */
  items?: BreadcrumbItem[];

  /** Show a "Home" crumb at the beginning */
  includeHome?: boolean;

  /** Home link target */
  homeHref?: string;

  /** Optional className overrides */
  className?: string;
};

export function Breadcrumb({
  items,
  includeHome = true,
  homeHref = "/dashboard",
  className,
}: BreadcrumbProps) {
  const pathname = usePathname();

  const autoItems = React.useMemo<BreadcrumbItem[]>(() => {
    if (items && items.length > 0) return items;

    const cleanPath = pathname.split("?")[0];
    const segments = cleanPath.split("/").filter(Boolean);

    const crumbs: BreadcrumbItem[] = [];

    segments.forEach((segment, index) => {
      const href = "/" + segments.slice(0, index + 1).join("/");

      // Friendly label from slug/id (e.g. "user-profile" -> "User Profile")
      const label = decodeURIComponent(segment)
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      crumbs.push({
        label,
        href: index === segments.length - 1 ? undefined : href,
      });
    });

    return crumbs;
  }, [items, pathname]);

  const finalItems = autoItems;

  if (!finalItems.length && !includeHome) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={
        "flex items-center gap-1 text-xs text-muted-foreground " + (className ?? "")
      }
    >
      {includeHome && (
        <>
          <Link
            href={homeHref}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium hover:bg-accent hover:text-foreground"
          >
            <Home className="h-3 w-3" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          {finalItems.length > 0 && (
            <ChevronRight className="h-3 w-3 text-muted-foreground/70" />
          )}
        </>
      )}

      {finalItems.map((item, index) => {
        const isLast = index === finalItems.length - 1;

        return (
          <React.Fragment key={index}>
            {index > 0 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground/70" />
            )}

            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <span className="inline-flex items-center rounded-full bg-accent/60 px-2 py-1 text-[11px] font-semibold text-foreground">
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
