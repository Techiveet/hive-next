// app/(dashboard)/email/_components/email-list.tsx - FIXED WITH WORKING SCROLLBAR
"use client";

import {
  Archive,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
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
import { memo, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

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
};

export type EmailListItem = {
  id: string;
  isRead?: boolean;
  isStarred?: boolean;
  email: EmailItem;
};

export type EmailListProps = {
  initialEmails: EmailListItem[];
  currentUserId: string;
  folderName: string;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  searchQuery?: string;
  nextCursor?: string | null; // For backward compatibility
};

// Memoized Email Row - unchanged
const EmailRow = memo(function EmailRow({
  item,
  isActive,
  isSelected,
  searchQuery,
  onToggleSelect,
  onToggleStar,
  onRowClick,
  folderName,
}: {
  item: EmailListItem;
  isActive: boolean;
  isSelected: boolean;
  searchQuery: string;
  onToggleSelect: (id: string) => void;
  onToggleStar: (id: string, currentStatus: boolean) => void;
  onRowClick: (id: string) => void;
  folderName: string;
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
        if (data.recipients.length > 1) {
          return name + ` +${data.recipients.length - 1}`;
        }
        return name;
      }
      return "Recipients";
    }
    return data.sender?.name || data.sender?.email || "Unknown";
  }, [folderName, data.recipients, data.sender]);

  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(data.createdAt), {
        addSuffix: true,
      });
    } catch {
      return "recently";
    }
  }, [data.createdAt]);

  const highlightText = useCallback((text: string, query: string) => {
    if (!query.trim() || !text.toLowerCase().includes(query.toLowerCase())) {
      return text;
    }
    const regex = new RegExp(`(${query})`, 'gi');
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

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect(item.id);
  }, [item.id, onToggleSelect]);

  const handleStarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStar(item.id, isStarred);
  }, [item.id, isStarred, onToggleStar]);

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
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <Avatar className={cn(
              "h-8 w-8 border-0 transition-transform group-hover:scale-105",
              isActive
                ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300"
                : "bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300"
            )}>
              <AvatarFallback className="text-xs font-bold">
                {displayName?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <span className={cn(
              "text-sm truncate max-w-[120px]",
              !isRead || isActive
                ? "font-semibold text-slate-900 dark:text-slate-100"
                : "font-medium text-slate-700 dark:text-slate-300"
            )}>
              {folderName === "sent" && "To: "}
              {highlightText(displayName, searchQuery)}
            </span>

            {hasAttachments && (
              <Paperclip className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0 transition-transform group-hover:scale-110" />
            )}
            {isE2EE && (
              <Lock className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-110",
                !isRead ? "text-emerald-500" : "text-slate-400 dark:text-slate-500"
              )} />
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className={cn(
              "text-[10px] min-w-[60px] text-right",
              isActive
                ? "text-indigo-600 dark:text-indigo-400 font-medium"
                : !isRead
                ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                : "text-slate-400 dark:text-slate-500"
            )}>
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
            />
          </div>
        </div>

        <h4 className={cn(
          "text-sm mb-1 truncate pr-4",
          !isRead || isActive ? "font-semibold text-slate-900 dark:text-slate-100" : "font-normal text-slate-700 dark:text-slate-300"
        )}>
          {highlightText(data.subject || "(No Subject)", searchQuery)}
        </h4>

        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
          {highlightText(data.body, searchQuery)}
        </p>
      </div>
    </div>
  );
});

// Main Component with backward compatibility
export function EmailList({
  initialEmails,
  currentUserId,
  folderName,
  totalCount = initialEmails.length,
  currentPage = 1,
  pageSize = 10,
  searchQuery: initialSearch = "",
  nextCursor,
}: EmailListProps) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  
  // Minimal state
  const [emails, setEmails] = useState<EmailListItem[]>(initialEmails);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  
  // Refs for performance
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const socketRef = useRef<any>(null);

  // Sync with initial data
  useEffect(() => {
    setEmails(initialEmails);
    setSelectedIds([]);
  }, [initialEmails]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Optimized search with debounce
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      params.set('folder', folderName);
      params.set('page', '1');
      params.set('pageSize', pageSize.toString());
      if (value.trim()) {
        params.set('q', value.trim());
      }
      
      router.push(`/email?${params.toString()}`);
    }, 400);
  }, [folderName, pageSize, router]);

  // Optimized page navigation
  const navigateToPage = useCallback((page: number) => {
    const totalPages = Math.ceil(totalCount / pageSize);
    if (page < 1 || page > totalPages || page === currentPage) return;
    
    setIsLoading(true);
    
    const params = new URLSearchParams();
    params.set('folder', folderName);
    params.set('page', page.toString());
    params.set('pageSize', pageSize.toString());
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim());
    }
    
    router.push(`/email?${params.toString()}`);
  }, [currentPage, folderName, pageSize, router, searchQuery, totalCount]);

  // Optimized selection logic
  const toggleSelectAll = useCallback(() => {
    const pageIds = emails.map(e => e.id);
    const allSelected = pageIds.every(id => selectedIds.includes(id));
    
    setSelectedIds(prev => 
      allSelected 
        ? prev.filter(id => !pageIds.includes(id))
        : [...new Set([...prev, ...pageIds])]
    );
  }, [emails, selectedIds]);

  const toggleSelectOne = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  // Optimized email actions
  const handleToggleStar = useCallback((id: string, currentStatus: boolean) => {
    setEmails(prev => prev.map(e => 
      e.id === id ? { ...e, isStarred: !currentStatus } : e
    ));
    startTransition(() => updateEmailStarStatusAction([id], !currentStatus));
  }, []);

 

// Optimized email actions
const handleBulkAction = useCallback((action: "delete" | "archive" | "markRead" | "markUnread") => {
    if (selectedIds.length === 0) return;

    const ids = [...selectedIds];
    setSelectedIds([]);

    // 1. **Immediate optimistic update: Filter out the deleted/archived emails**
    const isDeletionOrArchive = action === "delete" || action === "archive";
    if (isDeletionOrArchive) {
        setEmails(prev => prev.filter(e => !ids.includes(e.id)));
    }
    // For read/unread, we assume the list stays the same for now, but we update the flag
    if (action === "markRead" || action === "markUnread") {
        const isReadStatus = action === "markRead";
        setEmails(prev => prev.map(e => ids.includes(e.id) ? { ...e, isRead: isReadStatus } : e));
    }


    startTransition(async () => {
        try {
            switch (action) {
                case "delete":
                    await deleteEmailsAction(ids, folderName);
                    toast.success(folderName === "trash" ? "Permanently deleted" : "Moved to trash");
                    break;
                case "archive":
                    await archiveEmailsAction(ids);
                    toast.success("Archived");
                    break;
                case "markRead":
                    await updateEmailReadStatusAction(ids, true);
                    toast.success("Marked as read");
                    break;
                case "markUnread":
                    await updateEmailReadStatusAction(ids, false);
                    toast.success("Marked as unread");
                    break;
            }
            
            // 2. Refresh the list to fetch the next set of emails (if any) and update count
            router.refresh();
        } catch (error) {
            toast.error("Action failed. Please try again.");
            // OPTIONAL: On error, revert the optimistic update by re-fetching the server state immediately.
            router.refresh(); 
        }
    });
}, [selectedIds, folderName, router]);
 

  // Optimized navigation
  const handleRowClick = useCallback((id: string) => {
    router.push(`/email/${id}?folder=${folderName}&page=${currentPage}`);
  }, [router, folderName, currentPage]);

  // Calculate pagination
  const totalPages = Math.ceil(totalCount / pageSize);
  const pageNumbers = useMemo(() => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, start + maxVisiblePages - 1);
      
      if (end - start + 1 < maxVisiblePages) {
        start = Math.max(1, end - maxVisiblePages + 1);
      }
      
      for (let i = start; i <= end; i++) pages.push(i);
    }
    
    return pages;
  }, [currentPage, totalPages]);

  // Loading state for initial load
  if (isPending && emails.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-xl bg-white dark:bg-slate-900 border overflow-hidden">
        <div className="p-4 border-b">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 animate-pulse" />
        </div>
        <div className="flex-1 p-2 space-y-2">
          {[...Array(pageSize)].map((_, i) => (
            <div key={i} className="flex gap-3 p-4">
              <div className="pt-1">
                <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" />
                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                  </div>
                  <div className="h-3 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                </div>
                <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* HEADER */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
        {selectedIds.length > 0 ? (
          <div className="flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={true}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 dark:border-slate-600"
              />
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {selectedIds.length} selected
              </span>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => handleBulkAction("markRead")} title="Mark as read">
                <MailOpen className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleBulkAction("markUnread")} title="Mark as unread">
                <Mail className="h-4 w-4" />
              </Button>
              {folderName !== "archive" && folderName !== "sent" && (
                <Button variant="ghost" size="icon" onClick={() => handleBulkAction("archive")} title="Archive">
                  <Archive className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => handleBulkAction("delete")} title="Delete">
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
                  checked={emails.length > 0 && emails.every(e => selectedIds.includes(e.id))}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300 accent-emerald-500 cursor-pointer dark:border-slate-600"
                />
                <h2 className="font-bold text-lg capitalize text-slate-900 dark:text-white ml-2">
                  {folderName}
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {searchQuery && emails.length === 0 
                  ? "No results" 
                  : `Showing ${emails.length} of ${totalCount} emails`}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Search emails..."
                className="pl-9 h-9 text-sm bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                disabled={isPending}
              />
            </div>
          </>
        )}
      </div>

      {/* EMAIL LIST AREA WITH FIXED HEIGHT AND WORKING SCROLLBAR */}
      <div className="flex-1 min-h-0 flex flex-col">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-8">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent align-[-0.125em]" />
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading emails...</p>
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-8 text-center">
            {searchQuery ? (
              <>
                <Search className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  Nothing found
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Try a different search term
                </p>
              </>
            ) : (
              <>
                <Mail className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  No emails here
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {folderName === "inbox" ? "Your inbox is looking empty" : 
                   folderName === "sent" ? "No sent messages yet" : 
                   "This folder is empty"}
                </p>
              </>
            )}
          </div>
        ) : (
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto email-list-scrollbar"
            style={{ maxHeight: 'calc(100vh - 100px)' }} // Dynamic height based on viewport
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {emails.map((item) => (
                <EmailRow
                  key={item.id}
                  item={item}
                  isActive={params?.id === item.email.id}
                  isSelected={selectedIds.includes(item.id)}
                  searchQuery={searchQuery}
                  onToggleSelect={toggleSelectOne}
                  onToggleStar={handleToggleStar}
                  onRowClick={handleRowClick}
                  folderName={folderName}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PAGINATION - Only show if there are results */}
      {totalPages > 1 && emails.length > 0 && (
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1 || isLoading}
                onClick={() => navigateToPage(1)}
                className="h-7 px-2 text-xs"
              >
                <ChevronLeft className="h-3 w-3 mr-1" />
                First
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1 || isLoading}
                onClick={() => navigateToPage(currentPage - 1)}
                className="h-7 px-2 text-xs"
              >
                <ChevronLeft className="h-3 w-3" />
                Prev
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {pageNumbers.map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => navigateToPage(pageNum)}
                    disabled={isLoading}
                    className={cn(
                      "h-7 w-7 text-xs font-medium rounded border transition-colors",
                      pageNum === currentPage
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                  >
                    {pageNum}
                  </button>
                ))}
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <>
                    <span className="text-slate-400">...</span>
                    <button
                      onClick={() => navigateToPage(totalPages)}
                      disabled={isLoading}
                      className="h-7 w-7 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                Page {currentPage} of {totalPages}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || isLoading}
                onClick={() => navigateToPage(currentPage + 1)}
                className="h-7 px-2 text-xs"
              >
                Next
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || isLoading}
                onClick={() => navigateToPage(totalPages)}
                className="h-7 px-2 text-xs"
              >
                Last
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced scrollbar styles - Always visible and more prominent */}
      <style jsx global>{`
        .email-list-scrollbar {
          scroll-behavior: smooth;
          scrollbar-width: thin; /* For Firefox */
          scrollbar-color: #94a3b8 #f1f5f9; /* For Firefox */
        }
        
        .email-list-scrollbar::-webkit-scrollbar {
          width: 10px; /* Slightly wider */
          height: 10px;
        }
        
        .email-list-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9; /* Light gray track */
          border-radius: 6px;
          margin: 2px;
        }
        
        .email-list-scrollbar::-webkit-scrollbar-thumb {
          background: #94a3b8; /* Default thumb color */
          border-radius: 6px;
          border: 2px solid #f1f5f9; /* Creates padding effect */
          transition: all 0.2s ease;
        }
        
        .email-list-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #64748b; /* Darker on hover */
          border: 2px solid #f1f5f9;
        }
        
        .email-list-scrollbar::-webkit-scrollbar-thumb:active {
          background: #475569; /* Even darker when dragging */
        }
        
        .email-list-scrollbar::-webkit-scrollbar-corner {
          background: transparent;
        }
        
        /* Dark mode styles */
        .dark .email-list-scrollbar {
          scrollbar-color: #64748b #1e293b; /* For Firefox dark mode */
        }
        
        .dark .email-list-scrollbar::-webkit-scrollbar-track {
          background: #1e293b; /* Dark gray track */
        }
        
        .dark .email-list-scrollbar::-webkit-scrollbar-thumb {
          background: #475569; /* Dark thumb color */
          border: 2px solid #1e293b; /* Dark border for padding */
        }
        
        .dark .email-list-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #64748b; /* Lighter on hover */
          border: 2px solid #1e293b;
        }
        
        .dark .email-list-scrollbar::-webkit-scrollbar-thumb:active {
          background: #94a3b8; /* Even lighter when dragging */
        }
      `}</style>
    </div>
  );
}
 