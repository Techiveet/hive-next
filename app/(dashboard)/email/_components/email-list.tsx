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
  Star,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  archiveEmailsAction,
  deleteEmailsAction,
  updateEmailReadStatusAction,
  updateEmailStarStatusAction,
} from "../email-actions";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { io } from "socket.io-client";
import { toast } from "sonner";

// ---------- TYPES ----------

export type EmailAttachment = {
  id: string;
  type: "IMAGE" | "VIDEO" | "FILE";
  url: string;
  name: string;
  mimeType?: string | null;
  size?: number | null; // 👈 size in bytes
};

type EmailItem = {
  id: string;
  subject: string; // Now holds DECRYPTED or sanitized subject
  body: string;   // Now holds DECRYPTED or sanitized preview
  createdAt: Date | string;
  sender: { name: string | null; email: string };
  recipients?: { user: { name: string | null; email: string } }[];
  attachments?: EmailAttachment[];
  isE2EE?: boolean; // Flag indicating if the message was originally encrypted
};

type EmailListItem = {
  id: string;
  isRead?: boolean;
  isStarred?: boolean;
  email: EmailItem;
};

type EmailListProps = {
  initialEmails: EmailListItem[];
  currentUserId: string;
  folderName: string;
};

const PAGE_SIZE = 10;

// ---------- COMPONENT ----------

export function EmailList({
  initialEmails,
  currentUserId,
  folderName,
}: EmailListProps) {
  const [emails, setEmails] = useState<EmailListItem[]>(initialEmails);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const params = useParams();

  // 1. Sync state when server data changes
  useEffect(() => {
    setEmails(initialEmails);
    setSelectedIds([]);
    setPage(1);
  }, [initialEmails]);

  // 2. Real-Time Socket (logic remains the same)
  useEffect(() => {
    const socket = io("http://localhost:3001");
    socket.emit("join-room", currentUserId);

    socket.on("new-email", (data: any) => {
      setEmails((prev) => {
        const exists = prev.some(
          (e) => e.id === data.id || e.email.id === data.id
        );
        if (exists) return prev;

        const newEmail: EmailListItem = {
          id: data.id,
          isRead: false,
          isStarred: false,
          email: {
            id: data.id,
            subject: data.subject,
            body: data.preview || "",
            createdAt: new Date(),
            sender: { name: data.senderName, email: "Just now" },
            attachments: [],
            isE2EE: data.isE2EE || false,
          },
        };

        if (folderName === "inbox" || folderName === "all") {
          return [newEmail, ...prev];
        }
        return prev;
      });
      router.refresh();
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUserId, folderName, router]);

  // 3. Actions (omitted for brevity)
  const handleToggleStar = (id: string, currentStatus: boolean) => {
    setEmails((prev) =>
      prev.map((e) => (e.id === id ? { ...e, isStarred: !currentStatus } : e))
    );
    startTransition(() => updateEmailStarStatusAction([id], !currentStatus));
  };

  const handleBulkAction = (
    action: "delete" | "archive" | "markRead" | "markUnread"
  ) => {
    if (selectedIds.length === 0) return;

    if (action === "delete" || (action === "archive" && folderName !== "all")) {
      setEmails((prev) => prev.filter((e) => !selectedIds.includes(e.id)));
    }

    if (action === "markRead" || action === "markUnread") {
      const newStatus = action === "markRead";
      setEmails((prev) =>
        prev.map((e) =>
          selectedIds.includes(e.id) ? { ...e, isRead: newStatus } : e
        )
      );
    }

    const idsToProcess = [...selectedIds];
    setSelectedIds([]);

    startTransition(async () => {
      if (action === "delete") {
        await deleteEmailsAction(idsToProcess, folderName);
        toast.success(
          folderName === "trash" ? "Permanently deleted" : "Moved to trash"
        );
      } else if (action === "archive") {
        await archiveEmailsAction(idsToProcess);
        toast.success("Archived");
      } else if (action === "markRead") {
        await updateEmailReadStatusAction(idsToProcess, true);
        toast.success("Marked as read");
      } else if (action === "markUnread") {
        await updateEmailReadStatusAction(idsToProcess, false);
        toast.success("Marked as unread");
      }
      router.refresh();
    });
  };

  // 4. Filter + de-dup (omitted logic remains the same)
  const uniqueEmails = useMemo(() => {
    const map = new Map<string, EmailListItem>();
    emails.forEach((item) => {
      if (!map.has(item.id)) map.set(item.id, item);
    });

    const uniqueList = Array.from(map.values());
    const term = searchQuery.toLowerCase();

    // Filtering uses the DECRYPTED subject/body preview
    return uniqueList.filter((item) => {
      const data = item.email;
      return (
        (data.subject || "").toLowerCase().includes(term) ||
        (data.sender?.name || "").toLowerCase().includes(term) ||
        (data.body || "").toLowerCase().includes(term)
      );
    });
  }, [emails, searchQuery]);

  const totalEmails = uniqueEmails.length;
  const pageCount = Math.max(1, Math.ceil(totalEmails / PAGE_SIZE));

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const paginatedEmails = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    return uniqueEmails.slice(startIndex, endIndex);
  }, [uniqueEmails, page]);

  const startIndex = totalEmails === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex =
    totalEmails === 0 ? 0 : Math.min(page * PAGE_SIZE, totalEmails);

  const toggleSelectAll = () => {
    const pageIds = paginatedEmails.map((e) => e.id);
    const allSelectedOnPage = pageIds.every((id) => selectedIds.includes(id));

    if (allSelectedOnPage) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const isAllSelectedOnPage =
    paginatedEmails.length > 0 &&
    paginatedEmails.every((e) => selectedIds.includes(e.id));

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex h-full flex-col rounded-xl bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
      {/* HEADER / Search (omitted for brevity) */}
      <div className="flex flex-col gap-4 p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
        {selectedIds.length > 0 ? (
          <div className="flex items-center justify-between h-10 animate-in fade-in slide-in-from-top-2 bg-emerald-50/50 dark:bg-emerald-900/20 px-3 rounded-md border border-emerald-100 dark:border-emerald-800/50">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isAllSelectedOnPage}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer"
              />
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {selectedIds.length} Selected
              </span>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleBulkAction("markRead")}
                title="Mark read"
              >
                <MailOpen className="h-4 w-4 text-slate-500 hover:text-emerald-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleBulkAction("markUnread")}
                title="Mark unread"
              >
                <Mail className="h-4 w-4 text-slate-500 hover:text-emerald-600" />
              </Button>
              {folderName !== "archive" && folderName !== "sent" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleBulkAction("archive")}
                  title="Archive"
                >
                  <Archive className="h-4 w-4 text-slate-500 hover:text-emerald-600" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleBulkAction("delete")}
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-slate-500 hover:text-red-600" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between h-10">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isAllSelectedOnPage && paginatedEmails.length > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-slate-300 accent-emerald-500 cursor-pointer"
              />
              <h2 className="text-lg font-bold capitalize text-slate-800 dark:text-slate-100 ml-2">
                {folderName}
              </h2>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {totalEmails} Messages
            </span>
          </div>
        )}

        {selectedIds.length === 0 && (
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search..."
              className="pl-9 bg-slate-50 border-slate-200 dark:bg-slate-950 dark:border-slate-800"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>


      {/* LIST */}
      <div className="flex-1 overflow-y-auto">
        {paginatedEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
            <Search className="h-8 w-8 opacity-20" />
            <p>No emails found.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedEmails.map((item) => {
              const data = item.email;
              const isRead = item.isRead ?? true;
              const isActive = params?.id === data.id;
              const isSelected = selectedIds.includes(item.id);
              const isStarred = item.isStarred || false;
              const hasAttachments = (data.attachments?.length ?? 0) > 0;
              const isE2EE = data.isE2EE || false; 

              let displayName =
                data.sender?.name || data.sender?.email || "Unknown";

              if (folderName === "sent") {
                if (data.recipients && data.recipients.length > 0) {
                  displayName = data.recipients
                    .map((r) => r.user.name || r.user.email)
                    .join(", ");
                } else {
                  displayName = "Recipients";
                }
              }

              // Use the pre-processed body preview
              const plainPreview = data.body; 

              return (
                <div
                  key={item.id}
                  onClick={() =>
                    router.push(`/email/${data.id}?folder=${folderName}`)
                  }
                  className={cn(
                    "group flex cursor-pointer gap-3 p-4 transition-all duration-200 relative border-l-[3px]",
                    isSelected
                      ? "bg-slate-50 dark:bg-slate-800/80 border-l-emerald-500"
                      : isActive
                      ? "bg-slate-100 dark:bg-slate-800 border-l-indigo-500 shadow-inner"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-transparent",
                    !isRead &&
                      !isActive &&
                      !isSelected &&
                      "bg-slate-50/60 border-l-emerald-500 font-semibold"
                  )}
                >
                  <div
                    className="pt-1 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectOne(item.id)}
                      className="h-4 w-4 rounded border-slate-300 accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <Avatar
                          className={cn(
                            "h-8 w-8 border-0",
                            isActive
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-cyan-100 text-cyan-700"
                          )}
                        >
                          <AvatarFallback className="text-xs font-bold bg-transparent">
                            {displayName?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            "text-sm truncate max-w-[140px]",
                            !isRead || isActive
                              ? "font-bold text-slate-900 dark:text-white"
                              : "font-medium text-slate-700 dark:text-slate-300"
                          )}
                        >
                          {folderName === "sent" && (
                            <span className="font-normal text-slate-400 mr-1">
                              To:
                            </span>
                          )}
                          {displayName}
                        </span>

                        {hasAttachments && (
                          <Paperclip className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        )}
                        {/* Display lock icon if E2EE is TRUE */}
                        {isE2EE && (
                          <Lock className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            !isRead ? "text-emerald-500" : "text-slate-400"
                          )} />
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-[10px]",
                            isActive
                              ? "text-indigo-600 font-medium"
                              : !isRead
                              ? "text-emerald-600 font-semibold"
                              : "text-slate-400"
                          )}
                        >
                          {formatDistanceToNow(new Date(data.createdAt), {
                            addSuffix: true,
                          })}
                        </span>

                        <Star
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStar(item.id, isStarred);
                          }}
                          className={cn(
                            "h-4 w-4 cursor-pointer transition-colors",
                            isStarred
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-300 hover:text-amber-400"
                          )}
                        />
                      </div>
                    </div>

                    <h4
                      className={cn(
                        "text-sm mb-1 truncate pr-4",
                        !isRead || isActive ? "font-bold" : "font-normal"
                      )}
                    >
                      {data.subject || "(No Subject)"}
                    </h4>

                    <p
                      className={cn(
                        "text-xs line-clamp-2 flex items-center gap-2",
                        isActive
                          ? "text-slate-600 dark:text-slate-300"
                          : "text-slate-500 dark:text-slate-500"
                      )}
                    >
                      {plainPreview.substring(0, 140)}...
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FOOTER / PAGINATION (omitted for brevity) */}
      <div className="flex items-center justify-between p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <span className="text-xs text-slate-500 font-medium">
          {totalEmails === 0
            ? "No messages"
            : `Showing ${startIndex}-${endIndex} of ${totalEmails}`}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-500 hover:text-slate-900"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-500 hover:text-slate-900"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}