"use client";

import {
  Archive,
  File,
  Inbox,
  Keyboard,
  LayoutGrid,
  Send,
  ShieldAlert,
  Star,
  Trash2,
} from "lucide-react";
import React, { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { getSidebarCountsAction } from "../email-actions";
import { io } from "socket.io-client";
import { useTranslation } from "@/lib/hooks/use-translation"; // ✅ localization

export type FolderCounts = {
  all: number;
  inbox: number;
  sent: number;
  drafts: number;
  trash: number;
  starred: number;
  archive: number;
  spam: number;
};

type EmailSidebarProps = {
  initialCounts: FolderCounts;
  userId: string;
};

function Keycap({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        "min-w-[28px] h-6 px-2",
        "rounded-md border",
        "text-[11px] font-semibold",
        "bg-slate-50 text-slate-700 border-slate-200",
        "dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700"
      )}
    >
      {children}
    </span>
  );
}

function ShortcutRow({ keys, label }: { keys: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">{keys}</div>
      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
        {label}
      </span>
    </div>
  );
}

export function EmailSidebar({ initialCounts, userId }: EmailSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFolder = searchParams.get("folder") || "inbox";

  // ✅ translation
  const { t } = useTranslation();

  const [counts, setCounts] = useState<FolderCounts>(initialCounts);

  const refreshCounts = async () => {
    try {
      const freshCounts = await getSidebarCountsAction();
      if (freshCounts) setCounts(freshCounts);
    } catch (err) {
      console.error("Error refreshing sidebar counts:", err);
    }
  };

  useEffect(() => setCounts(initialCounts), [initialCounts]);

  useEffect(() => {
    const handleRefresh = () => refreshCounts();
    window.addEventListener("refresh-sidebar-counts", handleRefresh);
    return () =>
      window.removeEventListener("refresh-sidebar-counts", handleRefresh);
  }, []);

  useEffect(() => {
    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    const socket = io(socketUrl);

    socket.emit("join-room", userId);

    const handleUpdate = () => {
      startTransition(() => {
        refreshCounts();
        router.refresh();
      });
    };

    socket.on("new-email", handleUpdate);
    socket.on("email-sent", handleUpdate);

    return () => socket.disconnect();
  }, [userId, router]);

  // ✅ localized labels
  const navItems = useMemo(
    () => [
      {
        label: t("email.sidebar.all", "All Mails"),
        icon: LayoutGrid,
        id: "all",
        count: counts.all,
        color: "text-indigo-600 dark:text-indigo-400",
      },
      {
        label: t("email.sidebar.inbox", "Inbox"),
        icon: Inbox,
        id: "inbox",
        count: counts.inbox,
        color: "text-pink-600 dark:text-pink-400",
      },
      {
        label: t("email.sidebar.sent", "Sent"),
        icon: Send,
        id: "sent",
        count: counts.sent,
        color: "text-emerald-500 dark:text-emerald-400",
      },
      {
        label: t("email.sidebar.drafts", "Drafts"),
        icon: File,
        id: "drafts",
        count: counts.drafts,
        color: "text-blue-500 dark:text-blue-400",
      },
      {
        label: t("email.sidebar.archive", "Archived"),
        icon: Archive,
        id: "archive",
        count: counts.archive,
        color: "text-slate-500 dark:text-slate-400",
      },
      {
        label: t("email.sidebar.starred", "Starred"),
        icon: Star,
        id: "starred",
        count: counts.starred,
        color: "text-amber-500",
      },
      {
        label: t("email.sidebar.spam", "Spam"),
        icon: ShieldAlert,
        id: "spam",
        count: counts.spam,
        color: "text-orange-600 dark:text-orange-400",
      },
      {
        label: t("email.sidebar.trash", "Trash"),
        icon: Trash2,
        id: "trash",
        count: counts.trash,
        color: "text-red-500",
      },
    ],
    [counts, t]
  );

  return (
    <div className="flex h-full flex-col rounded-xl bg-white shadow-sm border border-slate-200 dark:bg-slate-950 dark:border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="p-6 pb-2 flex-shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {t("email.sidebar.title", "Mails")}
        </h3>
      </div>

      {/* ✅ EXACT SAME SCROLL STRUCTURE AS EMAIL LIST */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          className="h-full overflow-y-auto email-list-scrollbar"
          style={{ maxHeight: "calc(100vh - 210px)" }}
        >
          <nav className="space-y-1 p-3">
            {navItems.map((item) => {
              const isActive = activeFolder === item.id;

              return (
                <Link
                  key={item.id}
                  href={`/email?folder=${item.id}`}
                  className={cn(
                    "group flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon
                      className={cn(
                        "h-[18px] w-[18px]",
                        isActive
                          ? "text-slate-900 dark:text-white"
                          : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                      )}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.count > 0 && (
                    <span
                      className={cn(
                        "text-xs font-bold transition-transform group-hover:scale-110",
                        item.color
                      )}
                    >
                      {item.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Shortcuts panel (inside the scroller) */}
          <div className="border-t border-slate-200 dark:border-slate-800 p-4 bg-slate-50/40 dark:bg-slate-900/20">
            <div className="flex items-center gap-2 mb-3">
              <Keyboard className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t("email.shortcuts.title", "Shortcuts")}
              </p>
            </div>

            <div className="space-y-2">
              <ShortcutRow
                keys={
                  <>
                    <Keycap>j</Keycap>
                    <Keycap>k</Keycap>
                  </>
                }
                label={t("email.shortcuts.nextPrev", "Next / Previous")}
              />
              <ShortcutRow
                keys={<Keycap>x</Keycap>}
                label={t("email.shortcuts.select", "Select email")}
              />
              <ShortcutRow
                keys={<Keycap>s</Keycap>}
                label={t("email.shortcuts.star", "Star / unstar")}
              />
              <ShortcutRow
                keys={<Keycap>e</Keycap>}
                label={t("email.shortcuts.archive", "Archive")}
              />
              <ShortcutRow
                keys={<Keycap>#</Keycap>}
                label={t("email.shortcuts.delete", "Delete (move to trash)")}
              />
              <ShortcutRow
                keys={<Keycap>!</Keycap>}
                label={t("email.shortcuts.spam", "Mark as spam")}
              />
              <ShortcutRow
                keys={<Keycap>/</Keycap>}
                label={t("email.shortcuts.search", "Focus search")}
              />
              <ShortcutRow
                keys={<Keycap>c</Keycap>}
                label={t("email.shortcuts.compose", "Compose")}
              />
            </div>

            <div className="mt-3 text-[10px] text-slate-400 dark:text-slate-500">
              {t(
                "email.shortcuts.tip",
                "Tip: shortcuts work when you’re not typing in an input/editor."
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Reuse the exact same scrollbar styles (same class name as email list) */}
      <style jsx global>{`
        .email-list-scrollbar {
          scroll-behavior: smooth;
          scrollbar-width: thin;
          scrollbar-color: #94a3b8 #f1f5f9;
          overflow-y: auto;
        }
        .email-list-scrollbar::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .email-list-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 6px;
          margin: 2px;
        }
        .email-list-scrollbar::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 6px;
          border: 2px solid #f1f5f9;
          transition: all 0.2s ease;
        }
        .email-list-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #64748b;
          border: 2px solid #f1f5f9;
        }
        .dark .email-list-scrollbar {
          scrollbar-color: #64748b #1e293b;
        }
        .dark .email-list-scrollbar::-webkit-scrollbar-track {
          background: #1e293b;
        }
        .dark .email-list-scrollbar::-webkit-scrollbar-thumb {
          background: #475569;
          border: 2px solid #1e293b;
        }
      `}</style>
    </div>
  );
}
