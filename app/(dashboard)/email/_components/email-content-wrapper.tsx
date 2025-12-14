"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Download,
  File as FileIcon,
  Image as ImageIcon,
  Lock,
  Video as VideoIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";

import { EmailDetailToolbar } from "../[id]/email-detail-toolbar";
import { EmailReadListener } from "../_components/email-read-listener";
import { EmailReplyActions } from "../[id]/email-actions-bar";
import { Separator } from "@/components/ui/separator";
import { deleteEmailsAction } from "../email-actions";
import { format } from "date-fns";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const isTypingTarget = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null;
  if (!el) return false;

  const tag = el.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;

  if ((el as any).isContentEditable) return true;
  if (el.closest?.("[contenteditable='true']")) return true;

  return false;
};

// ====================================================================
// ATTACHMENT UTILITIES
// ====================================================================

interface ListAttachment {
  id: string;
  type: "IMAGE" | "VIDEO" | "FILE";
  url: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
}

const formatBytes = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return "";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${sizes[i]}`;
};

function EmailAttachments({ attachments }: { attachments: ListAttachment[] }) {
  if (!attachments || attachments.length === 0) return null;

  const totalSize = attachments.reduce((sum, a) => sum + (a.size ?? 0), 0);

  return (
    <div className="mt-10 print:hidden">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Attachments ({attachments.length})
        </h3>
        <span className="text-[11px] text-slate-400">
          Total size: {formatBytes(totalSize) || "—"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {attachments.map((att) => {
          const isImage =
            att.type === "IMAGE" || (att.mimeType || "").startsWith("image/");
          const isVideo =
            att.type === "VIDEO" || (att.mimeType || "").startsWith("video/");
          const sizeLabel = formatBytes(att.size);

          if (isImage) {
            return (
              <a
                key={att.id}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/40 dark:bg-slate-900/40 hover:border-emerald-400 hover:shadow-md transition-all"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={att.url}
                  alt={att.name}
                  className="h-32 w-full object-cover group-hover:scale-[1.04] transition-transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between">
                  <div className="flex justify-end p-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white">
                      <Download className="h-3 w-3" />
                      Download
                    </span>
                  </div>
                  <div className="px-3 pb-2 flex items-center justify-between gap-2 text-[11px] text-white">
                    <div className="flex items-center gap-2 min-w-0">
                      <ImageIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{att.name}</span>
                    </div>
                    <span className="shrink-0 opacity-80">
                      {sizeLabel || att.mimeType || "Image"}
                    </span>
                  </div>
                </div>
              </a>
            );
          }

          if (isVideo) {
            return (
              <div
                key={att.id}
                className="relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-black/80 hover:border-emerald-400 hover:shadow-md transition-all"
              >
                <video src={att.url} controls className="w-full h-32 object-cover" />
                <div className="absolute left-2 bottom-2 flex items-center gap-2 px-2 py-1 rounded-full bg-black/70 text-white text-[11px]">
                  <VideoIcon className="h-3 w-3" />
                  <span className="truncate max-w-[140px]">{att.name}</span>
                  {sizeLabel && (
                    <span className="opacity-80 text-[10px]">· {sizeLabel}</span>
                  )}
                </div>
              </div>
            );
          }

          return (
            <a
              key={att.id}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col justify-between rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/70 px-3 py-2 text-xs hover:border-emerald-400 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <FileIcon className="h-4 w-4 text-slate-500" />
                <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                  {att.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="truncate">
                  {att.mimeType || "File"}
                  {sizeLabel && ` · ${sizeLabel}`}
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Download className="h-3 w-3" />
                  Download
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ====================================================================
// EMAIL CONTENT WRAPPER
// ====================================================================

interface EmailContentWrapperProps {
  email: any;
  finalSubject: string;
  finalBodyHtml: string;

  detailAttachments: ListAttachment[];
  allUsers: any[];
  currentUserId: string;
  folder: string;
  printLogoUrl: string;
  isRead: boolean;

  decryptionError?: string | null;
}

export function EmailContentWrapper({
  email,
  finalSubject,
  finalBodyHtml,
  detailAttachments,
  allUsers,
  currentUserId,
  folder,
  printLogoUrl,
  isRead,
  decryptionError,
}: EmailContentWrapperProps) {
  const router = useRouter();

  const toRecipients = useMemo(
    () => email.recipients.filter((r: any) => r.type === "TO"),
    [email.recipients]
  );
  const ccRecipients = useMemo(
    () => email.recipients.filter((r: any) => r.type === "CC"),
    [email.recipients]
  );

  const handleDeleteThisEmail = useCallback(async () => {
    try {
      await deleteEmailsAction([email.id], folder);
      toast.success("Email moved to trash");
      router.push(`/email?folder=${folder}`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("refresh-sidebar-counts"));
      }
    } catch {
      toast.error("Failed to delete email");
    }
  }, [email.id, folder, router]);

  // ✅ Keyboard shortcuts in detail view
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e)) return;

      const key = e.key.toLowerCase();

      // Back to list
      if (key === "backspace" || key === "u") {
        e.preventDefault();
        router.back();
        return;
      }

      // Delete (Gmail-like)
      if (e.key === "#" || (e.key === "3" && e.shiftKey)) {
        e.preventDefault();
        handleDeleteThisEmail();
        return;
      }

      // Compose
      if (key === "c") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("open-compose"));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, handleDeleteThisEmail]);

  if (email.isE2EE && decryptionError) {
    return (
      <div className="flex-1 overflow-y-auto p-6 md:p-10 scroll-smooth print:overflow-visible print:h-auto print:p-0">
        <div className="flex flex-col items-center justify-center p-8 bg-rose-50 dark:bg-rose-900/50 rounded-lg border border-rose-300 dark:border-rose-700/50 my-8">
          <Lock className="h-10 w-10 text-rose-500 mb-3" />
          <h3 className="text-xl font-semibold mb-2 text-rose-700 dark:text-rose-300">
            Automatic Decryption Failed
          </h3>
          <p className="text-sm text-center text-muted-foreground mb-6">
            This message is E2EE, but the server failed to decrypt it automatically.
          </p>
          <p className="text-xs text-center text-rose-500 dark:text-rose-400 font-mono p-2 bg-rose-100 dark:bg-rose-900 rounded">
            Error: {decryptionError}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 bg-white dark:bg-[#0f172a] relative overflow-hidden print:fixed print:inset-0 print:z-50 print:bg-white print:h-auto print:overflow-visible print:block">
      {!email.isSender && <EmailReadListener emailId={email.id} isRead={isRead} />}

      <div className="flex-none z-20 shadow-sm print:hidden">
        <EmailDetailToolbar
          email={email}
          currentUserId={currentUserId}
          users={allUsers}
          isRead={isRead}
          currentFolder={folder}
        />
      </div>

      {printLogoUrl && (
        <div className="hidden print:block w-full mb-6 px-6 pt-6 md:px-10 md:pt-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={printLogoUrl}
            alt="Company Logo"
            style={{
              maxHeight: "60px",
              maxWidth: "250px",
              width: "auto",
              height: "auto",
            }}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 md:p-10 scroll-smooth print:overflow-visible print:h-auto print:p-0 print:px-6 md:print:px-10">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-6 leading-tight print:text-black print:text-2xl print:mb-4 flex items-center gap-3">
            {email.isE2EE && <Lock className="h-5 w-5 text-emerald-500 shrink-0" />}
            {finalSubject}
          </h1>

          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-4">
              <Avatar className="h-12 w-12 border border-slate-100 dark:border-slate-700 print:hidden">
                <AvatarImage src={email.sender.image || undefined} />
                <AvatarFallback className="bg-emerald-600 text-white font-bold text-lg">
                  {email.sender.name?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-base font-bold text-slate-900 dark:text-white print:text-black">
                    {email.sender.name || "Unknown"}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400 print:text-slate-600">
                    &lt;{email.sender.email}&gt;
                  </span>
                </div>

                <div className="text-sm text-slate-600 dark:text-slate-400 print:text-slate-800">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 print:text-black">
                    To:{" "}
                  </span>
                  {toRecipients.length > 0
                    ? toRecipients.map((r: any) => r.user.name || r.user.email).join(", ")
                    : "Undisclosed recipients"}
                </div>

                {ccRecipients.length > 0 && (
                  <div className="text-sm text-slate-600 dark:text-slate-400 print:text-slate-800">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 print:text-black">
                      Cc:{" "}
                    </span>
                    {ccRecipients.map((r: any) => r.user.name || r.user.email).join(", ")}
                  </div>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-200 print:text-black">
                {format(new Date(email.createdAt), "MMM d, yyyy")}
              </p>
              <p className="text-xs text-slate-500 print:text-slate-600">
                {format(new Date(email.createdAt), "h:mm a")}
              </p>
            </div>
          </div>
        </div>

        <Separator className="my-8 print:border-slate-300" />

        <div
          className="tiptap prose prose-lg dark:prose-invert max-w-none text-slate-800 dark:text-slate-300 leading-relaxed min-h-[200px] print:text-black print:text-base"
          dangerouslySetInnerHTML={{ __html: finalBodyHtml }}
        />

        <EmailAttachments attachments={detailAttachments} />

        <Separator className="my-10 print:hidden" />

        <div className="pb-12 print:hidden">
          <EmailReplyActions email={email} users={allUsers} currentUserId={currentUserId} />
        </div>
      </div>
    </div>
  );
}
