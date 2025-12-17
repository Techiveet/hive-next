"use client";

import {
  ArrowLeft,
  Mail,
  MailOpen,
  Printer,
  RefreshCw,
  ReplyAll,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import {
  deleteEmailsAction,
  markAsSpamByEmailIdAction,
  markEmailAsReadByEmailIdAction,
  toggleReadByEmailIdAction,
} from "../email-actions";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ComposeDialog } from "../_components/compose-dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/hooks/use-translation";

interface Props {
  email: any;
  currentUserId: string;
  users: any[];
  isRead: boolean;
  currentFolder: string;
}

export function EmailDetailToolbar({
  email,
  currentUserId,
  users,
  isRead,
  currentFolder,
}: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [replyAllOpen, setReplyAllOpen] = useState(false);

  // optimistic read state
  const [localIsRead, setLocalIsRead] = useState<boolean>(!!isRead);

  // real Email.id
  const emailId: string = email?.emailId ?? email?.id;

  // receiver-side only (sent/drafts can’t be marked read)
  const canMarkRead = !!emailId && !["sent", "drafts"].includes(currentFolder);

  // AUTO mark as read when opening detail (receiver-side only)
  useEffect(() => {
    if (!canMarkRead) return;
    if (localIsRead) return;

    (async () => {
      try {
        setLocalIsRead(true);
        await markEmailAsReadByEmailIdAction(emailId);

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("refresh-sidebar-counts"));
        }
        router.refresh();
      } catch (e) {
        setLocalIsRead(false);
        console.error(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailId, canMarkRead]);

  const getReplyAllDefaults = () => {
    const toSet = new Set<string>([email.senderId]);

    email.recipients?.forEach((r: any) => {
      if (r.userId !== currentUserId && (r.type === "TO" || r.type === "CC")) {
        toSet.add(r.userId);
      }
    });

    return {
      toIds: Array.from(toSet),
      subject: email.subject?.startsWith("Re:")
        ? email.subject
        : `Re: ${email.subject}`,
      body: `\n\n\n--- ${t("email.actions.replyAll", "Reply All")} ---\n${t(
        "email.reply.on",
        "On"
      )} ${new Date(email.createdAt).toLocaleString()}, ${
        email.sender?.name
      } ${t("email.reply.wrote", "wrote:")}\n> ${email.body}`,
    };
  };

  const handlePrint = () => window.print();

  const handleReload = () => {
    router.refresh();
    toast.success(t("common.refreshed", "Refreshed"));
  };

  const handleToggleRead = async () => {
    if (!canMarkRead) return;

    const next = !localIsRead;
    setLocalIsRead(next);

    try {
      await toggleReadByEmailIdAction(emailId, next);
      toast.success(
        next
          ? t("email.toast.markedRead", "Marked as Read")
          : t("email.toast.markedUnread", "Marked as Unread")
      );

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("refresh-sidebar-counts"));
      }
      router.refresh();
    } catch (e) {
      setLocalIsRead(!next);
      console.error(e);
      toast.error(t("email.toast.readUpdateFailed", "Failed to update read status"));
    }
  };

  const handleSpam = async () => {
    try {
      await markAsSpamByEmailIdAction(emailId, currentFolder);

      toast.success(t("email.toast.markedSpam", "Marked as spam"));

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("refresh-sidebar-counts"));
      }

      router.push(`/email?folder=${currentFolder}`);
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error(t("email.toast.spamFailed", "Failed to mark as spam"));
    }
  };

  const handleDelete = async () => {
    await deleteEmailsAction([emailId], currentFolder);

    const isHardDelete = currentFolder === "trash";
    toast.success(
      isHardDelete
        ? t("email.toast.deletedForever", "Permanently deleted")
        : t("email.toast.movedToTrash", "Moved to trash")
    );

    router.push(`/email?folder=${currentFolder}`);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("refresh-sidebar-counts"));
    }
  };

  return (
    <>
      <div className="flex items-center justify-between border-b p-4 bg-background/95 backdrop-blur sticky top-0 z-10 print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> {t("common.back", "Back")}
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {/* RELOAD */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReload}
            title={t("common.reload", "Reload")}
          >
            <RefreshCw className="h-4 w-4 text-slate-500" />
          </Button>

          {/* MARK READ / UNREAD */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleRead}
            disabled={!canMarkRead}
            title={
              !canMarkRead
                ? t(
                    "email.tooltip.readNotAvailable",
                    "Read status not available for Sent/Drafts"
                  )
                : localIsRead
                ? t("email.tooltip.markUnread", "Mark as Unread")
                : t("email.tooltip.markRead", "Mark as Read")
            }
          >
            {localIsRead ? (
              <MailOpen className="h-4 w-4 text-slate-500" />
            ) : (
              <Mail className="h-4 w-4 text-slate-500" />
            )}
          </Button>

          {/* SPAM */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSpam}
            title={t("email.tooltip.markSpam", "Mark as spam")}
          >
            <ShieldAlert className="h-4 w-4 text-slate-500" />
          </Button>

          {/* PRINT */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrint}
            title={t("common.print", "Print")}
          >
            <Printer className="h-4 w-4 text-slate-500" />
          </Button>

          <div className="h-4 w-px bg-slate-200 mx-2" />

          {/* REPLY ALL */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setReplyAllOpen(true)}
            title={t("email.actions.replyAll", "Reply All")}
          >
            <ReplyAll className="h-4 w-4 text-slate-700" />
          </Button>

          {/* DELETE */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            title={t("common.delete", "Delete")}
          >
            <Trash2 className="h-4 w-4 text-red-500 hover:text-red-600" />
          </Button>
        </div>
      </div>

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
