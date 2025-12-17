// app/(dashboard)/email/_components/email-list.tsx
"use client";

import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Lock,
  Mail,
  MailOpen,
  Paperclip,
  Search,
  ShieldAlert,
  Star,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  archiveEmailsAction,
  deleteEmailsAction,
  markAsSpamAction,
  updateEmailReadStatusAction,
  updateEmailStarStatusAction,
} from "../email-actions";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type React from "react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useEmailHotkeys } from "../_hooks/use-email-hotkeys";
import { useTranslation } from "@/lib/hooks/use-translation"; // ✅ localization

// ---------- TYPES ----------
export type EmailAttachment = {
  id: string;
  type: "IMAGE" | "VIDEO" | "FILE";
  url: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

export type EmailItem = {
  id: string;
  subject: string;
  body: string;
  createdAt: Date | string;
  sender: { name: string | null; email: string };
  recipients?: { user: { name: string | null; email: string } }[];
  attachments?: EmailAttachment[];
  isE2EE?: boolean;
  updatedAt?: Date | string;
};

export type EmailListItem = {
  id: string; // emailRecipient.id for received, email.id for sent
  emailId: string; // Always the email.id
  emailRecipientId?: string; // Only for received emails
  isRead?: boolean;
  isStarred?: boolean;
  email: EmailItem;
  isSent?: boolean; // Whether this is a sent email
};

export type EmailListProps = {
  initialEmails: EmailListItem[];
  currentUserId: string;
  folderName: string;
  pageSize?: number;
  searchQuery?: string;
  nextCursor?: string | null;
  totalCount?: number;
  enablePagination?: boolean;
};

// ---------- MEMOIZED EMAIL ROW ----------
const EmailRow = memo(function EmailRow({
  item,
  isActive,
  isSelected,
  searchQuery,
  onToggleSelect,
  onToggleStar,
  onRowClick,
  folderName,
  t,
}: {
  item: EmailListItem;
  isActive: boolean;
  isSelected: boolean;
  searchQuery: string;
  onToggleSelect: (id: string) => void;
  onToggleStar: (id: string, currentStatus: boolean) => void;
  onRowClick: (id: string) => void;
  folderName: string;
  t: (key: string, fallback?: string) => string;
}) {
  const data = item.email;
  const isRead = item.isRead ?? true;
  const isStarred = item.isStarred || false;
  const hasAttachments = (data.attachments?.length ?? 0) > 0;
  const isE2EE = data.isE2EE || false;

  const displayName = useMemo(() => {
    if (folderName === "sent") {
      if (data.recipients && data.recipients.length > 0) {
        const firstRecipient = data.recipients[0].user;
        const name = firstRecipient.name || firstRecipient.email;
        if (data.recipients.length > 1) return name + ` +${data.recipients.length - 1}`;
        return name;
      }
      return t("email.list.recipients", "Recipients");
    }
    return data.sender?.name || data.sender?.email || t("common.unknown", "Unknown");
  }, [folderName, data.recipients, data.sender, t]);

  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(data.createdAt), { addSuffix: true });
    } catch {
      return t("email.list.recently", "recently");
    }
  }, [data.createdAt, t]);

  const highlightText = useCallback((text: string, query: string) => {
    if (!query.trim() || !text.toLowerCase().includes(query.toLowerCase())) return text;
    const regex = new RegExp(`(${query})`, "gi");
    return text.split(regex).map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  }, []);

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleSelect(item.id);
    },
    [item.id, onToggleSelect]
  );

  const handleStarClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleStar(item.id, isStarred);
    },
    [item.id, isStarred, onToggleStar]
  );

  const handleRowClick = useCallback(() => {
    onRowClick(data.id);
  }, [data.id, onRowClick]);

  return (
    <div
      onClick={handleRowClick}
      className={cn(
        "group flex cursor-pointer gap-3 p-4 relative border-l-[3px] transition-colors duration-150",
        isSelected
          ? "bg-emerald-50 dark:bg-emerald-900/20 border-l-emerald-500 hover:bg-emerald-50/90 dark:hover:bg-emerald-900/30"
          : isActive
          ? "bg-slate-100 dark:bg-slate-800 border-l-indigo-500 hover:bg-slate-100/90 dark:hover:bg-slate-800/90"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-transparent",
        !isRead &&
          !isActive &&
          !isSelected &&
          "bg-slate-50/60 dark:bg-slate-800/30 border-l-emerald-500 font-semibold hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
      )}
    >
      <div className="pt-1 z-10" onClick={handleCheckboxClick}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          className="h-4 w-4 rounded border-slate-300 accent-emerald-500 cursor-pointer hover:accent-emerald-600 dark:border-slate-600"
          aria-label={t("email.list.selectEmail", "Select email")}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Avatar
              className={cn(
                "h-8 w-8 border-0 transition-transform group-hover:scale-105",
                isActive
                  ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300"
                  : "bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300"
              )}
            >
              <AvatarFallback className="text-xs font-bold">
                {displayName?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>

            <span
              className={cn(
                "text-sm truncate max-w-[150px]",
                !isRead || isActive
                  ? "font-semibold text-slate-900 dark:text-slate-100"
                  : "font-medium text-slate-700 dark:text-slate-300"
              )}
            >
              {folderName === "sent" && t("email.list.toPrefix", "To: ")}
              {highlightText(displayName, searchQuery)}
            </span>

            {hasAttachments && (
              <Paperclip className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0 transition-transform group-hover:scale-110" />
            )}

            {isE2EE && (
              <Lock
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-110",
                  !isRead ? "text-emerald-500" : "text-slate-400 dark:text-slate-500"
                )}
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm text-[10px] min-w-[60px] text-right",
                isActive
                  ? "text-indigo-600 dark:text-indigo-400 font-medium"
                  : !isRead
                  ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                  : "text-slate-400 dark:text-slate-500"
              )}
            >
              {timeAgo}
            </span>

            <Star
              onClick={handleStarClick}
              className={cn(
                "h-4 w-4 cursor-pointer transition-all hover:scale-110",
                isStarred
                  ? "fill-amber-400 text-amber-400"
                  : "text-slate-300 dark:text-slate-600 hover:text-amber-400 dark:hover:text-amber-300"
              )}
              aria-label={t("email.list.toggleStar", "Star / unstar")}
            />
          </div>
        </div>

        <h4
          className={cn(
            "text-sm mb-1 truncate pr-4",
            !isRead || isActive
              ? "font-semibold text-slate-900 dark:text-slate-100"
              : "font-normal text-slate-700 dark:text-slate-300"
          )}
        >
          {highlightText(
            data.subject || t("email.list.noSubject", "(No Subject)"),
            searchQuery
          )}
        </h4>

        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
          {highlightText(data.body, searchQuery)}
        </p>
      </div>
    </div>
  );
});

// ---------- MAIN EMAIL LIST COMPONENT ----------
export function EmailList({
  initialEmails,
  currentUserId, // (kept for signature)
  folderName,
  pageSize = 10,
  searchQuery: initialSearch = "",
  nextCursor,
  totalCount,
  enablePagination = true,
}: EmailListProps) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  // ✅ translation
  const { t } = useTranslation();

  const [emails, setEmails] = useState<EmailListItem[]>(initialEmails);
  const [cursor, setCursor] = useState<string | null>(nextCursor ?? null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(!!nextCursor);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [currentPage, setCurrentPage] = useState(1);

  const [totalEmails, setTotalEmails] = useState<number>(
    typeof totalCount === "number" ? totalCount : initialEmails.length
  );

  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeEmailId = (params as any)?.id ?? null;

  // ✅ localized folder title for header
  const folderTitle = useMemo(() => {
    const map: Record<string, string> = {
      inbox: t("email.folder.inbox", "Inbox"),
      sent: t("email.folder.sent", "Sent"),
      drafts: t("email.folder.drafts", "Drafts"),
      archive: t("email.folder.archive", "Archived"),
      starred: t("email.folder.starred", "Starred"),
      spam: t("email.folder.spam", "Spam"),
      trash: t("email.folder.trash", "Trash"),
      all: t("email.folder.all", "All Mails"),
    };
    return map[folderName] ?? folderName;
  }, [folderName, t]);

  // ✅ localized pagination range
  const pageRange = useMemo(() => {
    if (!enablePagination) {
      const n = emails.length;
      return t("email.list.countLabel", `${n} email${n === 1 ? "" : "s"}`);
    }

    const start = (currentPage - 1) * pageSize + 1;
    const end = (currentPage - 1) * pageSize + emails.length;

    const effectiveTotal =
      totalEmails > 0 ? totalEmails : emails.length > 0 ? end : 0;

    if (effectiveTotal === 0) return t("email.list.rangeZero", "0-0 of 0");

    const safeStart = emails.length === 0 ? 0 : start;
    const safeEnd = emails.length === 0 ? 0 : Math.min(end, effectiveTotal);

    return t(
      "email.list.rangeOf",
      `${safeStart}-${safeEnd} of ${effectiveTotal.toLocaleString()}`
    );
  }, [enablePagination, currentPage, pageSize, totalEmails, emails.length, t]);

  useEffect(() => {
    setEmails(initialEmails);
    setCursor(nextCursor ?? null);
    setHasMore(!!nextCursor);

    setTotalEmails(
      typeof totalCount === "number" ? totalCount : initialEmails.length
    );

    setCurrentPage(1);
    setCursorHistory([]);
    setSearchQuery(initialSearch);
    setSearchInput(initialSearch);
    setSelectedIds([]);
  }, [folderName, initialSearch, initialEmails, nextCursor, totalCount]);

  // --- FETCH EMAILS ---
  const fetchEmails = useCallback(
    async (cursorParam: string | null, search: string, pageNum: number = 1) => {
      if (!enablePagination) return null;

      setLoading(true);

      try {
        const qs = new URLSearchParams();
        qs.set("folder", folderName);
        qs.set("pageSize", pageSize.toString());
        if (search.trim()) qs.set("q", search.trim());
        if (cursorParam) qs.set("cursor", cursorParam);

        const response = await fetch(`/api/emails?${qs.toString()}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Server Error Details:", errorText);
          try {
            const errorJson = JSON.parse(errorText);
            throw new Error(
              errorJson.message || `Server error: ${response.status}`
            );
          } catch {
            throw new Error(
              `Failed to fetch: ${response.status} - ${errorText.substring(0, 50)}`
            );
          }
        }

        const { data } = await response.json();
        if (!data) throw new Error("No data returned");

        setEmails(data.items || []);
        setCursor(data.nextCursor ?? null);
        setHasMore(!!data.hasNextPage);
        setCurrentPage(pageNum);

        if (typeof data.totalCount === "number") {
          setTotalEmails(data.totalCount);
        } else if (
          typeof data.totalCount === "string" &&
          !Number.isNaN(Number(data.totalCount))
        ) {
          setTotalEmails(Number(data.totalCount));
        }

        if (cursorParam) {
          setCursorHistory((prev) =>
            prev.includes(cursorParam) ? prev : [...prev, cursorParam]
          );
        }

        const newParams = new URLSearchParams();
        newParams.set("folder", folderName);
        if (cursorParam) newParams.set("cursor", cursorParam);
        if (search.trim()) newParams.set("q", search.trim());
        router.replace(`/email?${newParams.toString()}`, { scroll: false });

        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }

        return data;
      } catch (error) {
        console.error("Failed to fetch emails:", error);
        toast.error(t("email.toast.loadFailed", "Failed to load emails."));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [folderName, pageSize, enablePagination, router, t]
  );

  const loadPreviousPage = useCallback(() => {
    if (!enablePagination || currentPage <= 1 || loading) return;
    const previousPage = currentPage - 1;

    if (previousPage === 1) {
      fetchEmails(null, searchQuery, 1);
    } else if (cursorHistory.length >= previousPage - 1) {
      const previousCursor = cursorHistory[previousPage - 2];
      fetchEmails(previousCursor, searchQuery, previousPage);
    }
  }, [
    currentPage,
    loading,
    fetchEmails,
    searchQuery,
    cursorHistory,
    enablePagination,
  ]);

  const loadNextPage = useCallback(() => {
    if (!enablePagination || !cursor || loading) return;
    const nextPage = currentPage + 1;
    fetchEmails(cursor, searchQuery, nextPage);
  }, [cursor, loading, fetchEmails, searchQuery, currentPage, enablePagination]);

  const handleSearch = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        setSearchQuery(value);
        setCursorHistory([]);
        fetchEmails(null, value, 1);
      }, 400);
    },
    [fetchEmails]
  );

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const toggleSelectAll = useCallback(() => {
    const pageIds = emails.map((e) => e.id);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    setSelectedIds((prev) =>
      allSelected ? prev.filter((id) => !pageIds.includes(id)) : [...pageIds]
    );
  }, [emails, selectedIds]);

  const toggleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleToggleStar = useCallback(
    (id: string, currentStatus: boolean) => {
      const newStatus = !currentStatus;
      const emailItem = emails.find((e) => e.id === id);

      setEmails((prev) =>
        prev.map((e) => (e.id === id ? { ...e, isStarred: newStatus } : e))
      );

      startTransition(async () => {
        try {
          const result = await updateEmailStarStatusAction([id], newStatus);

          if (typeof window !== "undefined") {
            const eventName = newStatus ? "email-starred" : "email-unstarred";
            window.dispatchEvent(
              new CustomEvent(eventName, {
                detail: { id, emailId: emailItem?.emailId },
              })
            );
            window.dispatchEvent(new CustomEvent("refresh-sidebar-counts"));
          }

          if (result.message) toast.success(result.message);
        } catch {
          setEmails((prev) =>
            prev.map((e) => (e.id === id ? { ...e, isStarred: currentStatus } : e))
          );
          toast.error(t("email.toast.starFailed", "Failed to update star status"));
        }
      });
    },
    [emails, t]
  );

  const handleBulkAction = useCallback(
    async (
      action: "delete" | "archive" | "markRead" | "markUnread" | "spam",
      ids?: string[]
    ) => {
      const targetIds = ids ?? selectedIds;
      if (targetIds.length === 0) return;

      const selectedItems = emails.filter((e) => targetIds.includes(e.id));
      const affectedEmails = [...selectedItems];

      setEmails((prev) => prev.filter((e) => !targetIds.includes(e.id)));
      setSelectedIds([]);

      startTransition(async () => {
        try {
          let result: any;

          switch (action) {
            case "delete":
              result = await deleteEmailsAction(targetIds, folderName);
              break;
            case "archive":
              result = await archiveEmailsAction(targetIds);
              break;
            case "markRead":
              result = await updateEmailReadStatusAction(targetIds, true);
              break;
            case "markUnread":
              result = await updateEmailReadStatusAction(targetIds, false);
              break;
            case "spam":
              result = await markAsSpamAction(targetIds, folderName);
              break;
          }

          if (result?.message) toast.success(result.message);

          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("refresh-sidebar-counts"));
            window.dispatchEvent(
              new CustomEvent("email-action-completed", {
                detail: { action, count: targetIds.length },
              })
            );
          }

          if (enablePagination) {
            setTimeout(() => fetchEmails(null, searchQuery, 1), 100);
          } else {
            router.refresh();
          }
        } catch {
          setEmails((prev) => {
            const remaining = prev.filter((e) => !targetIds.includes(e.id));
            return [...affectedEmails, ...remaining].sort(
              (a, b) =>
                new Date(b.email.createdAt).getTime() -
                new Date(a.email.createdAt).getTime()
            );
          });
          toast.error(t("email.toast.actionFailed", "Action failed. Please try again."));
        }
      });
    },
    [selectedIds, folderName, emails, searchQuery, fetchEmails, enablePagination, router, t]
  );

  const handleRowClick = useCallback(
    (emailId: string) => {
      if (folderName === "drafts") {
        window.dispatchEvent(
          new CustomEvent("open-draft-compose", { detail: { draftId: emailId } })
        );
        return;
      }

      const detailParams = new URLSearchParams();
      detailParams.set("folder", folderName);
      if (searchQuery) detailParams.set("q", searchQuery);

      const currentCursor = searchParams.get("cursor");
      if (currentCursor) detailParams.set("cursor", currentCursor);

      router.push(`/email/${emailId}?${detailParams.toString()}`);
    },
    [router, folderName, searchQuery, searchParams]
  );

  // -------------------------
  // Keyboard shortcuts
  // -------------------------
  const activeIndex = useMemo(() => {
    if (!activeEmailId) return -1;
    return emails.findIndex((e) => e.emailId === activeEmailId);
  }, [emails, activeEmailId]);

  const openByIndex = useCallback(
    (idx: number) => {
      const item = emails[idx];
      if (!item) return;
      handleRowClick(item.emailId);
    },
    [emails, handleRowClick]
  );

  const openActiveOrFirst = useCallback(() => {
    if (activeIndex >= 0) return openByIndex(activeIndex);
    if (emails.length) return openByIndex(0);
  }, [activeIndex, emails.length, openByIndex]);

  const moveDown = useCallback(() => {
    if (!emails.length) return;
    const next = activeIndex < 0 ? 0 : Math.min(activeIndex + 1, emails.length - 1);
    openByIndex(next);
  }, [emails.length, activeIndex, openByIndex]);

  const moveUp = useCallback(() => {
    if (!emails.length) return;
    const prev = activeIndex < 0 ? 0 : Math.max(activeIndex - 1, 0);
    openByIndex(prev);
  }, [emails.length, activeIndex, openByIndex]);

  const activeItem = useMemo(() => {
    if (activeIndex < 0) return null;
    return emails[activeIndex] ?? null;
  }, [activeIndex, emails]);

  useEmailHotkeys(
    {
      j: (e) => {
        e.preventDefault();
        moveDown();
      },
      k: (e) => {
        e.preventDefault();
        moveUp();
      },
      enter: (e) => {
        e.preventDefault();
        openActiveOrFirst();
      },
      o: (e) => {
        e.preventDefault();
        openActiveOrFirst();
      },
      "/": (e) => {
        e.preventDefault();
        searchInputRef.current?.focus();
      },
      c: (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("open-compose"));
      },
      x: (e) => {
        e.preventDefault();
        if (!activeItem) return;
        toggleSelectOne(activeItem.id);
      },
      s: (e) => {
        e.preventDefault();
        if (!activeItem) return;
        handleToggleStar(activeItem.id, !!activeItem.isStarred);
      },
      e: (e) => {
        e.preventDefault();
        const ids = selectedIds.length ? selectedIds : activeItem ? [activeItem.id] : [];
        handleBulkAction("archive", ids);
      },
      "#": (e) => {
        e.preventDefault();
        const ids = selectedIds.length ? selectedIds : activeItem ? [activeItem.id] : [];
        handleBulkAction("delete", ids);
      },
      "shift+3": (e) => {
        e.preventDefault();
        const ids = selectedIds.length ? selectedIds : activeItem ? [activeItem.id] : [];
        handleBulkAction("delete", ids);
      },
      "!": (e) => {
        e.preventDefault();
        const ids = selectedIds.length ? selectedIds : activeItem ? [activeItem.id] : [];
        handleBulkAction("spam", ids);
      },
      "shift+1": (e) => {
        e.preventDefault();
        const ids = selectedIds.length ? selectedIds : activeItem ? [activeItem.id] : [];
        handleBulkAction("spam", ids);
      },
    },
    true
  );

  if (loading && emails.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-xl bg-white dark:bg-slate-900 border overflow-hidden">
        <div className="p-4 border-b">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 animate-pulse" />
        </div>
        <div className="flex-1 p-2 space-y-2">
          {[...Array(pageSize)].map((_, i) => (
            <div key={i} className="flex gap-3 p-4 animate-pulse">
              <div className="pt-1">
                <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-full" />
                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                  <div className="h-3 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
                <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
        {selectedIds.length > 0 ? (
          <div className="flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={true}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 dark:border-slate-600"
                aria-label={t("email.list.selectAll", "Select all")}
              />
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {t("email.list.selectedCount", `${selectedIds.length} selected`)}
              </span>
            </div>

            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleBulkAction("markRead", selectedIds)}
                title={t("email.actions.markRead", "Mark as read")}
                disabled={isPending}
              >
                <MailOpen className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleBulkAction("markUnread", selectedIds)}
                title={t("email.actions.markUnread", "Mark as unread")}
                disabled={isPending}
              >
                <Mail className="h-4 w-4" />
              </Button>

              {folderName !== "archive" && folderName !== "sent" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleBulkAction("archive", selectedIds)}
                  title={t("email.actions.archive", "Archive")}
                  disabled={isPending}
                >
                  <Archive className="h-4 w-4" />
                </Button>
              )}

              {folderName !== "spam" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleBulkAction("spam", selectedIds)}
                  title={t("email.actions.spam", "Mark as spam")}
                  disabled={isPending}
                >
                  <ShieldAlert className="h-4 w-4" />
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleBulkAction("delete", selectedIds)}
                title={t("email.actions.delete", "Delete")}
                disabled={isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={
                    emails.length > 0 &&
                    emails.every((e) => selectedIds.includes(e.id))
                  }
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 accent-emerald-500 cursor-pointer dark:border-slate-600"
                  aria-label={t("email.list.selectAll", "Select all")}
                />
                <h2 className="font-bold text-lg capitalize text-slate-900 dark:text-white ml-2">
                  {folderTitle}
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {pageRange}
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input
                ref={searchInputRef}
                placeholder={t("email.search.placeholder", "Search emails...")}
                className="pl-9 h-9 text-sm bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
                disabled={loading || isPending || !enablePagination}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-8 text-center">
            {searchQuery ? (
              <>
                <Search className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  {t("email.empty.notFoundTitle", "Nothing found")}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {t("email.empty.notFoundHint", "Try a different search term")}
                </p>
              </>
            ) : (
              <>
                <Mail className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  {t("email.empty.title", "No emails here")}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {folderName === "inbox"
                    ? t("email.empty.inbox", "Your inbox is looking empty")
                    : folderName === "sent"
                    ? t("email.empty.sent", "No sent messages yet")
                    : t("email.empty.generic", "This folder is empty")}
                </p>
              </>
            )}
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            className="h-full overflow-y-auto email-list-scrollbar"
            style={{ maxHeight: "calc(100vh - 210px)" }}
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {emails.map((item) => (
                <EmailRow
                  key={`${item.id}-${item.emailId}`}
                  item={item}
                  isActive={item.emailId === activeEmailId}
                  isSelected={selectedIds.includes(item.id)}
                  searchQuery={searchQuery}
                  onToggleSelect={toggleSelectOne}
                  onToggleStar={handleToggleStar}
                  onRowClick={handleRowClick}
                  folderName={folderName}
                  t={t}
                />
              ))}
            </div>

            {loading && emails.length > 0 && (
              <div className="py-4 flex justify-center">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-emerald-600 border-r-transparent" />
              </div>
            )}
          </div>
        )}
      </div>

      {enablePagination && (
        <div className="mt-auto border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0 z-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3">
            <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">
              {pageRange}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage <= 1 || loading}
                onClick={loadPreviousPage}
                className="h-8 px-3 text-sm"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t("email.pagination.newer", "Newer")}
              </Button>

              <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-1" />

              <Button
                variant="ghost"
                size="sm"
                disabled={!hasMore || loading}
                onClick={loadNextPage}
                className="h-8 px-3 text-sm"
              >
                {t("email.pagination.older", "Older")}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

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
