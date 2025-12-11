
//app/components/email-menu.tsx
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mail, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export type UnreadEmailData = {
  id: string;
  createdAt: Date;
  email: {
    id: string;
    subject: string;
    sender: {
      name: string | null;
      email: string;
    };
  };
};

type EmailMenuProps = {
  unreadCount: number;
  latestEmails: UnreadEmailData[];
  userId: string;
};

export function EmailMenu({ unreadCount, latestEmails, userId }: EmailMenuProps) {
  const router = useRouter();
  const [count, setCount] = useState(unreadCount);
  const [emails, setEmails] = useState<UnreadEmailData[]>(latestEmails);

  useEffect(() => {
    setCount(unreadCount);
    setEmails(latestEmails);
  }, [unreadCount, latestEmails]);

  useEffect(() => {
    if (!userId) return;

    const socket = io("http://localhost:3001");
    socket.emit("join-room", userId);

    socket.on("new-email", (data: any) => {
      // 🛑 FIX: Block self-notifications
      // If I am the sender, do not show the toast or increment unread count
      if (data.senderId === userId) return;

      // 1. Play Sound
      const audio = new Audio("/sounds/notify.mp3");
      audio.play().catch(() => {});

      // 2. Show Toast
      toast.info(`New email from ${data.senderName}`, {
        description: data.subject,
        action: {
          label: "View",
          onClick: () => router.push(`/email/${data.id}`),
        },
      });

      // 3. Update UI
      setCount((prev) => prev + 1);

      const newEmailItem: UnreadEmailData = {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        email: {
          id: data.id,
          subject: data.subject,
          sender: {
            name: data.senderName,
            email: "",
          },
        },
      };

      setEmails((prev) => [newEmailItem, ...prev.slice(0, 4)]);
      router.refresh();
    });

    return () => {
      socket.disconnect();
    };
  }, [userId, router]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 rounded-full border border-slate-200 bg-background hover:bg-slate-100 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800"
        >
          <Mail className="h-4 w-4 text-foreground" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white shadow-sm animate-in zoom-in">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80 p-0 bg-background border-border">
        {/* Content same as before */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <DropdownMenuLabel className="p-0 text-xs font-semibold">Inbox</DropdownMenuLabel>
          <span className="text-[10px] text-muted-foreground">{count} unread</span>
        </div>

        <div className="max-h-[300px] overflow-y-auto py-1">
          {emails.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <MessageSquare className="h-8 w-8 opacity-20" />
              <span>No new messages</span>
            </div>
          ) : (
            emails.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="flex cursor-pointer items-start gap-3 px-4 py-3"
                onClick={() => router.push(`/email/${item.email.id}`)}
              >
                <Avatar className="h-8 w-8 border mt-1">
                  <AvatarFallback className="text-[10px]">
                    {item.email.sender.name?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1 overflow-hidden w-full">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold">
                      {item.email.sender.name || "Unknown"}
                    </span>
                    <span className="shrink-0 text-[9px] text-muted-foreground">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: false })}
                    </span>
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {item.email.subject}
                  </span>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex justify-center py-3 text-xs font-medium text-primary cursor-pointer"
          onClick={() => router.push("/email?folder=inbox")}
        >
          View all messages
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}