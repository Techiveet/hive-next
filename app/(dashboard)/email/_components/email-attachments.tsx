"use client";

import { Download, File as FileIcon, Image as ImageIcon, Video } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/hooks/use-translation";

type EmailAttachment = {
  id: string;
  type: "IMAGE" | "VIDEO" | "FILE";
  url: string;
  name: string;
  mimeType?: string | null;
};

export function EmailAttachments({
  attachments,
}: {
  attachments?: EmailAttachment[];
}) {
  const { t } = useTranslation();

  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
        {t("email.attachments.titleWithCount", "Attachments ({count})").replace(
          "{count}",
          String(attachments.length)
        )}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {attachments.map((att) => {
          const isImage =
            att.type === "IMAGE" || (att.mimeType || "").startsWith("image/");
          const isVideo =
            att.type === "VIDEO" || (att.mimeType || "").startsWith("video/");

          if (isImage) {
            return (
              <a
                key={att.id}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative overflow-hidden rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/40 dark:bg-slate-900/40 hover:border-emerald-400 transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={att.url}
                  alt={att.name}
                  className="h-32 w-full object-cover group-hover:scale-[1.03] transition-transform"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-3 py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ImageIcon className="h-4 w-4 text-white/80" />
                    <span className="truncate text-xs text-white">{att.name}</span>
                  </div>
                  <Download className="h-4 w-4 text-white/80 opacity-70 group-hover:opacity-100" />
                </div>
              </a>
            );
          }

          if (isVideo) {
            return (
              <div
                key={att.id}
                className="relative overflow-hidden rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-black/80"
              >
                <video src={att.url} controls className="w-full h-32 object-cover" />
                <div className="absolute left-2 bottom-2 flex items-center gap-2 px-2 py-1 rounded-full bg-black/70 text-white text-[11px]">
                  <Video className="h-3 w-3" />
                  <span className="truncate max-w-[140px]">{att.name}</span>
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
              className={cn(
                "flex flex-col justify-between rounded-lg border border-slate-200/80 dark:border-slate-700/80",
                "bg-slate-50/60 dark:bg-slate-900/60 px-3 py-2 text-xs hover:border-emerald-400 transition-colors"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <FileIcon className="h-4 w-4 text-slate-500" />
                <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                  {att.name}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>{att.mimeType || t("email.attachments.file", "File")}</span>
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <Download className="h-3 w-3" />
                  {t("common.download", "Download")}
                </span>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
