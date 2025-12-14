"use client";

import {
  Archive,
  File,
  Inbox,
  LayoutGrid,
  Send,
  ShieldAlert,
  Star,
  Trash2
} from "lucide-react";
import { startTransition, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { getSidebarCountsAction } from "../email-actions";
import { io } from "socket.io-client";

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

export function EmailSidebar({ initialCounts, userId }: EmailSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFolder = searchParams.get("folder") || "inbox";
  
  // Initialize state
  const [counts, setCounts] = useState<FolderCounts>(initialCounts);

  // Helper: Fetch fresh counts from DB
  const refreshCounts = async () => {
    try {
      const freshCounts = await getSidebarCountsAction();
      if (freshCounts) {
        setCounts(freshCounts);
      }
    } catch (err) {
      console.error("Error refreshing sidebar counts:", err);
    }
  };

  // 1. Initial Load & Sync when props change
  useEffect(() => {
    setCounts(initialCounts);
  }, [initialCounts]);

  // 2. Listen for custom window events (triggered by client-side actions in email-list)
  useEffect(() => {
    const handleRefresh = () => refreshCounts();
    window.addEventListener('refresh-sidebar-counts', handleRefresh);
    return () => window.removeEventListener('refresh-sidebar-counts', handleRefresh);
  }, []);

  // 3. Socket Listeners for Realtime Updates from other users
  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
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
    
    return () => {
      socket.disconnect();
    };
  }, [userId, router]);

  const navItems = [
    { label: "All Mails", icon: LayoutGrid, id: "all", count: counts.all, color: "text-indigo-600 dark:text-indigo-400" },
    { label: "Inbox", icon: Inbox, id: "inbox", count: counts.inbox, color: "text-pink-600 dark:text-pink-400" },
    { label: "Sent", icon: Send, id: "sent", count: counts.sent, color: "text-emerald-500 dark:text-emerald-400" },
    { label: "Drafts", icon: File, id: "drafts", count: counts.drafts, color: "text-blue-500 dark:text-blue-400" },
    { label: "Archived", icon: Archive, id: "archive", count: counts.archive, color: "text-slate-500" },
    { label: "Starred", icon: Star, id: "starred", count: counts.starred, color: "text-amber-500" },
    { label: "Spam", icon: ShieldAlert, id: "spam", count: counts.spam, color: "text-orange-600 dark:text-orange-400" },
    { label: "Trash", icon: Trash2, id: "trash", count: counts.trash, color: "text-red-500" },
  ];

  return (
    <div className="flex h-full flex-col rounded-xl bg-white shadow-sm border border-slate-200 dark:bg-slate-950 dark:border-slate-800 overflow-hidden">
      <div className="p-6 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Mails</h3>
      </div>
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
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
                <item.icon className={cn("h-[18px] w-[18px]", isActive ? "text-slate-900 dark:text-white" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300")} />
                <span>{item.label}</span>
              </div>
              {item.count > 0 && (
                <span className={cn("text-xs font-bold transition-transform group-hover:scale-110", item.color)}>
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}