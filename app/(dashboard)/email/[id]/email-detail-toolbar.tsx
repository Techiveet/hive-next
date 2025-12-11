

//app/(dashboard)/email/[id]/email-detail-toolbar.tsx
"use client";

import {
  ArrowLeft,
  Mail,
  MailOpen,
  Printer,
  RefreshCw,
  ReplyAll,
  Trash2
} from "lucide-react";
import { deleteEmailsAction, toggleReadStatusAction } from "../email-actions";

import { Button } from "@/components/ui/button";
import { ComposeDialog } from "../_components/compose-dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  email: any;
  currentUserId: string;
  users: any[];
  isRead: boolean;
  currentFolder: string; // ✅ Added this prop
}

export function EmailDetailToolbar({ email, currentUserId, users, isRead, currentFolder }: Props) {
  const router = useRouter();
  const [replyAllOpen, setReplyAllOpen] = useState(false);

  // --- LOGIC: Calculate Reply All Recipients ---
  const getReplyAllDefaults = () => {
    const toSet = new Set<string>([email.senderId]);
    email.recipients.forEach((r: any) => {
      if (r.userId !== currentUserId && (r.type === 'TO' || r.type === 'CC')) {
        toSet.add(r.userId);
      }
    });

    return {
      toIds: Array.from(toSet),
      subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
      body: `\n\n\n--- Reply All ---\nOn ${new Date(email.createdAt).toLocaleString()}, ${email.sender.name} wrote:\n> ${email.body}`
    };
  };

  const handlePrint = () => window.print();

  const handleReload = () => {
    router.refresh();
    toast.success("Refreshed");
  };

  const handleToggleRead = async () => {
    await toggleReadStatusAction(email.id, !isRead);
    toast.success(isRead ? "Marked as Unread" : "Marked as Read");
    router.refresh();
  };

  // ✅ FIXED DELETE LOGIC
const handleDelete = async () => {
    // Pass the actual currentFolder ('trash', 'inbox', etc.)
    // If currentFolder is 'trash', the server action will perform a Hard Delete.
    await deleteEmailsAction([email.id], currentFolder);
    
    const isHardDelete = currentFolder === 'trash'; // Used for toast/logic clarity

    if (isHardDelete) {
      toast.success("Permanently deleted");
    } else {
      toast.success("Moved to trash");
    }
    
    // CRITICAL FIX: Redirect back to the specific folder list immediately.
    // This solves the "Access Denied" error and the list disappearing after view.
    router.push(`/email?folder=${currentFolder}`); 
  };

  return (
    <>
      <div className="flex items-center justify-between border-b p-4 bg-background/95 backdrop-blur sticky top-0 z-10 print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {/* RELOAD */}
          <Button variant="ghost" size="icon" onClick={handleReload} title="Reload">
            <RefreshCw className="h-4 w-4 text-slate-500" />
          </Button>

          {/* MARK READ / UNREAD */}
          <Button variant="ghost" size="icon" onClick={handleToggleRead} title={isRead ? "Mark as Unread" : "Mark as Read"}>
            {isRead ? (
              <Mail className="h-4 w-4 text-slate-400" /> 
            ) : (
              <MailOpen className="h-4 w-4 text-emerald-500" />
            )}
          </Button>

          {/* PRINT */}
          <Button variant="ghost" size="icon" onClick={handlePrint} title="Print">
            <Printer className="h-4 w-4 text-slate-500" />
          </Button>

          <div className="h-4 w-px bg-slate-200 mx-2" />

          {/* REPLY ALL */}
          <Button variant="ghost" size="icon" onClick={() => setReplyAllOpen(true)} title="Reply All">
             <ReplyAll className="h-4 w-4 text-slate-700" />
          </Button>

          {/* DELETE */}
          <Button variant="ghost" size="icon" onClick={handleDelete} title="Delete">
            <Trash2 className="h-4 w-4 text-red-500 hover:text-red-600" />
          </Button>
        </div>
      </div>

      {/* Hidden Compose Dialog for Reply All */}
      <ComposeDialog 
        users={users}
        open={replyAllOpen} 
        onOpenChange={setReplyAllOpen}
        defaultValues={getReplyAllDefaults()}
        trigger={null}
      />
    </>
  );
}