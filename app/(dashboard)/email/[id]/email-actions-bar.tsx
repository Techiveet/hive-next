//app/(dashboard)/email/[id]/email-actions-bar.tsx
"use client";

import { ArrowLeft, CornerUpLeft, Forward, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ComposeDialog } from "./../_components/compose-dialog";
import { deleteEmailsAction } from "./../email-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// -----------------------------------------------------------------------------
// TOP TOOLBAR
// -----------------------------------------------------------------------------

export function EmailTopToolbar({ emailId }: { emailId: string }) {
  const router = useRouter();

  const handleDelete = async () => {
    await deleteEmailsAction([emailId], "inbox");
    toast.success("Email moved to trash");
    router.push("/email");
  };

  return (
    <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800 bg-background/95 backdrop-blur sticky top-0 z-10">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 pl-0 hover:bg-transparent"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-base font-medium">Back</span>
      </Button>

      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// REPLY / FORWARD ACTIONS
// -----------------------------------------------------------------------------

interface EmailReplyActionsProps {
  email: any; // Prisma Email with sender + recipients
  users: any[];
  currentUserId: string;
}

export function EmailReplyActions({
  email,
  users,
  currentUserId,
}: EmailReplyActionsProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);

  const isSender = email.senderId === currentUserId;
  const createdAt = new Date(email.createdAt);
  const createdAtStr = createdAt.toLocaleString();
  const senderName = email.sender.name || email.sender.email;
  const senderEmail = email.sender.email;

  // Gmail-style Reply target
  const primaryReplyToId = useMemo(() => {
    if (!isSender) {
      // I'm a recipient → reply to sender
      return email.senderId;
    }

    // I'm the sender → reply to first TO recipient, fallback to any recipient, fallback to myself
    const recipients = email.recipients || [];

    const toRecipient = recipients.find((r: any) => r.type === "TO");
    if (toRecipient) return toRecipient.userId;

    if (recipients.length > 0) return recipients[0].userId;

    return email.senderId;
  }, [email, isSender]);

  const replySubject =
    email.subject && email.subject.startsWith("Re:")
      ? email.subject
      : `Re: ${email.subject || ""}`;

  const forwardSubject =
    email.subject && email.subject.startsWith("Fwd:")
      ? email.subject
      : `Fwd: ${email.subject || ""}`;

  // HTML quote blocks for reply / forward
  const quotedOriginal = `<blockquote style="border-left:2px solid #e5e7eb;padding-left:8px;margin:8px 0;">
${email.body || ""}
</blockquote>`;

  const replyBody = `
<p><br/></p>
<p>On ${createdAtStr}, ${senderName} &lt;${senderEmail}&gt; wrote:</p>
${quotedOriginal}
`;

  const forwardBody = `
<p><br/></p>
<p>
---------- Forwarded message ---------<br/>
From: ${senderName} &lt;${senderEmail}&gt;<br/>
Date: ${createdAtStr}<br/>
Subject: ${email.subject || ""}</p>
${quotedOriginal}
`;

  return (
    <>
      <div className="flex gap-3">
        <Button
          onClick={() => setReplyOpen(true)}
          className="h-10 gap-2 bg-emerald-500 px-6 text-white hover:bg-emerald-600 shadow-sm"
        >
          <CornerUpLeft className="h-4 w-4" /> Reply
        </Button>

        <Button
          variant="outline"
          onClick={() => setForwardOpen(true)}
          className="h-10 gap-2 border-slate-700 bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
        >
          <Forward className="h-4 w-4" /> Forward
        </Button>
      </div>

      {/* REPLY */}
      <ComposeDialog
        users={users}
        open={replyOpen}
        onOpenChange={setReplyOpen}
        trigger={null}
        defaultValues={{
          toIds: primaryReplyToId ? [primaryReplyToId] : [],
          subject: replySubject,
          body: replyBody,
        }}
      />

      {/* FORWARD */}
      <ComposeDialog
        users={users}
        open={forwardOpen}
        onOpenChange={setForwardOpen}
        trigger={null}
        defaultValues={{
          toIds: [], // forward does not auto-choose recipients
          subject: forwardSubject,
          body: forwardBody,
        }}
      />
    </>
  );
}