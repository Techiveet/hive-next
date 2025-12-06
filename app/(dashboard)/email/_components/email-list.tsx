"use client";

import { Archive, ChevronLeft, ChevronRight, Search, Star, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { archiveEmailsAction, deleteEmailsAction, toggleStarAction } from "../email-actions";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { io } from "socket.io-client";
import { toast } from "sonner";

// Types
type EmailItem = {
  id: string;
  subject: string;
  body: string;
  createdAt: Date | string;
  isStarred?: boolean;
  sender: { name: string | null; email: string };
};

type EmailListItem = {
  id: string;
  isRead?: boolean;
  isStarred?: boolean;
  email?: EmailItem;
} & Partial<EmailItem>;

type EmailListProps = {
  initialEmails: EmailListItem[];
  currentUserId: string;
  folderName: string;
};

export function EmailList({ initialEmails, currentUserId, folderName }: EmailListProps) {
  const [emails, setEmails] = useState<EmailListItem[]>(initialEmails);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const params = useParams();

  // 1. Sync State with Server Props
  useEffect(() => {
    setEmails(initialEmails);
    setSelectedIds([]); 
  }, [initialEmails]);

  // 2. Real-Time Socket
  useEffect(() => {
    const socket = io("http://localhost:3001");
    socket.emit("join-room", currentUserId);

    socket.on("new-email", (data: any) => {
      setEmails((prev) => {
        // Robust Duplicate Check
        const exists = prev.some(e => e.id === data.id || e.email?.id === data.id);
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
          },
        };

        if (folderName === "inbox" || folderName === "all") {
          return [newEmail, ...prev];
        }
        return prev;
      });
      router.refresh();
    });

    // Real-time Delete/Archive Listeners
    socket.on("email-deleted", (data: { ids: string[] }) => {
      setEmails(prev => prev.filter(e => !data.ids.includes(e.id) && !data.ids.includes(e.email?.id || "")));
      router.refresh();
    });

    socket.on("email-archived", (data: { ids: string[] }) => {
      if (folderName !== 'archive' && folderName !== 'all') {
        setEmails(prev => prev.filter(e => !data.ids.includes(e.id) && !data.ids.includes(e.email?.id || "")));
      }
      router.refresh();
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUserId, folderName, router]);

  // 3. Actions Handlers
  const handleToggleStar = (id: string, currentStatus: boolean) => {
    // Optimistic
    setEmails(prev => prev.map(e => {
        const emailId = e.email?.id || e.id;
        if (emailId === id || e.id === id) {
            return { ...e, isStarred: !currentStatus };
        }
        return e;
    }));
    startTransition(() => toggleStarAction(id, !currentStatus));
  };

  const handleAction = (ids: string[], action: 'delete' | 'archive') => {
    // Optimistic Remove
    if (folderName !== 'all' && (action === 'delete' || folderName !== 'archive')) {
        setEmails(prev => prev.filter(e => !ids.includes(e.id)));
    }
    setSelectedIds([]); // Clear selection immediately
    
    startTransition(async () => {
        if (action === 'delete') {
            await deleteEmailsAction(ids, folderName);
            toast.success(folderName === 'trash' ? "Permanently deleted" : "Moved to trash");
        } else {
            await archiveEmailsAction(ids);
            toast.success("Archived");
        }
        router.refresh();
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === uniqueEmails.length) setSelectedIds([]);
    else setSelectedIds(uniqueEmails.map(e => e.id));
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // 4. ✅ DEDUPLICATION & FILTERING
  // This is the critical fix. We derive a unique list before rendering.
  const uniqueEmails = useMemo(() => {
    const map = new Map();
    emails.forEach(item => {
      // Normalize ID: prefer the email content ID if available, else the row ID
      const normalizeId = item.email?.id || item.id;
      if (!map.has(normalizeId)) {
        map.set(normalizeId, item);
      }
    });
    
    const uniqueList = Array.from(map.values()) as EmailListItem[];
    
    // Then apply search filter
    const term = searchQuery.toLowerCase();
    return uniqueList.filter(item => {
      const data = item.email || (item as EmailItem);
      return (
        (data.subject || "").toLowerCase().includes(term) ||
        (data.sender?.name || "").toLowerCase().includes(term)
      );
    });
  }, [emails, searchQuery]);


  // 5. Render
  return (
    <div className="flex h-full flex-col rounded-xl bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
      
      {/* HEADER */}
      <div className="flex flex-col gap-4 p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
        {selectedIds.length > 0 ? (
            <div className="flex items-center justify-between h-10 animate-in fade-in slide-in-from-top-2 bg-slate-50 dark:bg-slate-800 px-2 rounded-md">
                <div className="flex items-center gap-2">
                    <input 
                        type="checkbox" 
                        checked={true} 
                        onChange={toggleSelectAll} 
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer" 
                    />
                    <span className="text-sm font-semibold">{selectedIds.length} Selected</span>
                </div>
                <div className="flex gap-2">
                    {folderName !== 'archive' && folderName !== 'sent' && (
                        <Button variant="ghost" size="sm" onClick={() => handleAction(selectedIds, 'archive')} title="Archive">
                            <Archive className="h-4 w-4 text-slate-500 hover:text-emerald-600" />
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleAction(selectedIds, 'delete')} title="Delete">
                        <Trash2 className="h-4 w-4 text-slate-500 hover:text-red-600" />
                    </Button>
                </div>
            </div>
        ) : (
            <div className="flex items-center justify-between h-10">
              <div className="flex items-center gap-2">
                <input 
                    type="checkbox" 
                    checked={false} 
                    onChange={toggleSelectAll} 
                    className="h-4 w-4 rounded border-slate-300 accent-emerald-500 cursor-pointer" 
                />
                <h2 className="text-lg font-bold capitalize text-slate-800 dark:text-slate-100 ml-2">{folderName}</h2>
              </div>
              <span className="text-xs text-muted-foreground font-medium">{uniqueEmails.length} Messages</span>
            </div>
        )}
        
        {selectedIds.length === 0 && (
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input 
                placeholder="Search..." 
                className="pl-9 bg-slate-50 border-slate-200 dark:bg-slate-950 dark:border-slate-800" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
              />
            </div>
        )}
      </div>

      {/* LIST */}
      <div className="flex-1 overflow-y-auto">
        {uniqueEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
            <Search className="h-8 w-8 opacity-20" />
            <p>No emails found.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {uniqueEmails.map((item) => {
              const data = item.email || (item as EmailItem);
              const isRead = item.isRead ?? true;
              const isActive = params?.id === data.id;
              const isSelected = selectedIds.includes(item.id);
              const isStarred = item.isStarred || data.isStarred || false;

              // Use normalized ID for key to prevent duplicates in DOM
              const uniqueKey = data.id; 

              return (
                <div
                  key={uniqueKey}
                  onClick={() => router.push(`/email/${data.id}?folder=${folderName}`)}
                  className={cn(
                    "group flex cursor-pointer gap-3 p-4 transition-all duration-200 relative border-l-[3px]",
                    isSelected ? "bg-slate-100 dark:bg-slate-800/80 border-l-emerald-500" :
                    isActive ? "bg-slate-100 dark:bg-slate-800 border-l-indigo-500 shadow-inner" :
                    "hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-transparent",
                    !isRead && !isActive && !isSelected && "bg-slate-50/60 border-l-emerald-500 font-semibold"
                  )}
                >
                  <div className="pt-1 z-10" onClick={(e) => e.stopPropagation()}>
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
                        <Avatar className={cn("h-8 w-8 border-0", isActive ? "bg-indigo-100 text-indigo-700" : "bg-cyan-100 text-cyan-700")}>
                          <AvatarFallback className="text-xs font-bold bg-transparent">
                            {data.sender?.name?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className={cn("text-sm truncate max-w-[120px]", (!isRead || isActive) ? "font-bold text-slate-900 dark:text-white" : "font-medium text-slate-700 dark:text-slate-300")}>
                          {data.sender?.name || data.sender?.email || "Unknown"}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                         {/* Hover Actions */}
                         <div className="hidden group-hover:flex gap-1 mr-1">
                            {folderName !== 'archive' && folderName !== 'sent' && (
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleAction([item.id], 'archive'); }}>
                                    <Archive className="h-3.5 w-3.5 text-slate-400 hover:text-emerald-500" />
                                </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleAction([item.id], 'delete'); }}>
                                <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
                            </Button>
                        </div>

                        <span className={cn("text-[10px] group-hover:hidden", isActive ? "text-indigo-600 font-medium" : (!isRead ? "text-emerald-600 font-semibold" : "text-slate-400"))}>
                          {formatDistanceToNow(new Date(data.createdAt), { addSuffix: true })}
                        </span>
                        
                        <Star 
                            onClick={(e) => { e.stopPropagation(); handleToggleStar(data.id, isStarred); }}
                            className={cn("h-4 w-4 cursor-pointer transition-colors", isStarred ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-amber-400")} 
                        />
                      </div>
                    </div>
                    <h4 className={cn("text-sm mb-1 truncate pr-4", (!isRead || isActive) ? "font-bold" : "font-normal")}>
                      {data.subject || "(No Subject)"}
                    </h4>
                    <p className={cn("text-xs line-clamp-2", isActive ? "text-slate-600 dark:text-slate-300" : "text-slate-500 dark:text-slate-500")}>
                      {(data.body || "").substring(0, 140)}...
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* FOOTER */}
      <div className="flex items-center justify-between p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <span className="text-xs text-slate-500 font-medium">
          Showing 1-{Math.min(uniqueEmails.length, 10)} of {uniqueEmails.length}
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-900">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-900">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}