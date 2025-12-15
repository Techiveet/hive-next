"use client";

import { ArrowLeft, CornerUpLeft, Forward, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ComposeDialog } from "./../_components/compose-dialog";
import { deleteEmailsAction } from "./../email-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/hooks/use-translation";

const isTypingTarget = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null;
  if (!el) return false;

  const tag = el.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;

  // Tiptap / contenteditable
  if ((el as any).isContentEditable) return true;
  if (el.closest?.("[contenteditable='true']")) return true;

  return false;
};

// -----------------------------------------------------------------------------
// TOP TOOLBAR
// -----------------------------------------------------------------------------

export function EmailTopToolbar({ emailId }: { emailId: string }) {
  const router = useRouter();
  const { t } = useTranslation();

  const handleDelete = async () => {
    await deleteEmailsAction([emailId], "inbox");
    toast.success(t("email.toast.movedToTrash", "Email moved to trash"));
    router.push("/email");
  };

  return (
    <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800 bg-background/95 backdrop-blur sticky top-0 z-10 print:hidden">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 pl-0 hover:bg-transparent"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-base font-medium">
          {t("common.back", "Back")}
        </span>
      </Button>

      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          title={t("common.delete", "Delete")}
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
  email: any;
  users: any[];
  currentUserId: string;
}

export function EmailReplyActions({
  email,
  users,
  currentUserId,
}: EmailReplyActionsProps) {
  const { t } = useTranslation();

  const [replyOpen, setReplyOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);

  const isSender = email.senderId === currentUserId;
  const createdAt = new Date(email.createdAt);
  const createdAtStr = createdAt.toLocaleString();
  const senderName = email.sender.name || email.sender.email;
  const senderEmail = email.sender.email;

  const openReply = useCallback(() => setReplyOpen(true), []);
  const openForward = useCallback(() => setForwardOpen(true), []);
  const closeAll = useCallback(() => {
    setReplyOpen(false);
    setForwardOpen(false);
  }, []);

  // ✅ Keyboard shortcuts (r/f/esc)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e)) return;

      const key = e.key.toLowerCase();

      if (key === "r") {
        e.preventDefault();
        openReply();
      }

      if (key === "f") {
        e.preventDefault();
        openForward();
      }

      if (key === "escape") {
        e.preventDefault();
        closeAll();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openReply, openForward, closeAll]);

  // Gmail-style Reply target
  const primaryReplyToId = useMemo(() => {
    if (!isSender) return email.senderId;

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

  const quotedOriginal = `<blockquote style="border-left:2px solid #e5e7eb;padding-left:8px;margin:8px 0;">
${email.body || ""}
</blockquote>`;

  // Keep these English-ish for email quoting consistency; still localizable if you want
  const replyBody = `
<p><br/></p>
<p>${t("email.reply.on", "On")} ${createdAtStr}, ${senderName} &lt;${senderEmail}&gt; ${t(
    "email.reply.wrote",
    "wrote:"
  )}</p>
${quotedOriginal}
`;

  const forwardBody = `
<p><br/></p>
<p>
---------- ${t("email.forward.forwardedMessage", "Forwarded message")} ---------<br/>
${t("email.forward.from", "From:")} ${senderName} &lt;${senderEmail}&gt;<br/>
${t("email.forward.date", "Date:")} ${createdAtStr}<br/>
${t("email.forward.subject", "Subject:")} ${email.subject || ""}</p>
${quotedOriginal}
`;

  return (
    <>
      <div className="flex gap-3 print:hidden">
        <Button
          onClick={openReply}
          className="h-10 gap-2 bg-emerald-500 px-6 text-white hover:bg-emerald-600 shadow-sm"
        >
          <CornerUpLeft className="h-4 w-4" /> {t("email.actions.reply", "Reply")}
        </Button>

        <Button
          variant="outline"
          onClick={openForward}
          className="h-10 gap-2 border-slate-700 bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
        >
          <Forward className="h-4 w-4" /> {t("email.actions.forward", "Forward")}
        </Button>
      </div>

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

      <ComposeDialog
        users={users}
        open={forwardOpen}
        onOpenChange={setForwardOpen}
        trigger={null}
        defaultValues={{
          toIds: [],
          subject: forwardSubject,
          body: forwardBody,
        }}
      />
    </>
  );
}
