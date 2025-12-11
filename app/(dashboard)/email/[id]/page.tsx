// app/(dashboard)/email/[id]/page.tsx

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Download,
  File as FileIcon,
  Image as ImageIcon,
  Video as VideoIcon,
} from "lucide-react";
import {
  EmailList,
  EmailAttachment as ListAttachment,
} from "../_components/email-list";
import { notFound, redirect } from "next/navigation";

import DOMPurify from "isomorphic-dompurify";
import { EmailContentWrapper } from "../_components/email-content-wrapper";
import { EmailDetailToolbar } from "./email-detail-toolbar";
import { EmailReadListener } from "../_components/email-read-listener";
import { EmailReplyActions } from "./email-actions-bar";
import { Separator } from "@/components/ui/separator";
import { autoDecryptAction } from "../server-decryption-action"; // ADD THIS IMPORT
import { format } from "date-fns";
import { getCurrentSession } from "@/lib/auth-server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

// Helper Functions
async function resolveTenantIdFromHost(): Promise<string | null> {
  const h = await headers();
  const host = (h.get("host") || "").toLowerCase();
  const bareHost = host.split(":")[0];

  if (bareHost === "localhost") {
    const centralTenant = await prisma.tenant.findUnique({
      where: { slug: "central-hive" },
      select: { id: true },
    });
    return centralTenant?.id ?? null;
  }

  const domain = await prisma.tenantDomain.findFirst({
    where: { domain: bareHost },
    select: { tenantId: true },
  });

  return domain?.tenantId ?? null;
}

const mapAttachmentType = (
  mime: string | null | undefined
): ListAttachment["type"] => {
  if (!mime) return "FILE";
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  return "FILE";
};

const formatBytes = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return "";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${sizes[i]}`;
};

// Attachments Section
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
                rel="noopener noreferrer nofollow"
                className="group relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/40 dark:bg-slate-900/40 hover:border-emerald-400 hover:shadow-md transition-all"
              >
                <img
                  src={att.url}
                  alt={att.name}
                  className="h-32 w-full object-cover group-hover:scale-[1.04] transition-transform"
                  loading="lazy"
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
                <video
                  src={att.url}
                  controls
                  className="w-full h-32 object-cover"
                  preload="metadata"
                />
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
              rel="noopener noreferrer nofollow"
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

// Main Page Component
export default async function EmailDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ folder?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { user } = await getCurrentSession();

  if (!user) redirect("/sign-in");

  const folder = searchParams.folder || "inbox";

  // BRAND SETTINGS (Print Logo)
  const tenantId = await resolveTenantIdFromHost();
  let brand = await prisma.brandSettings.findFirst({ where: { tenantId } });
  if (!brand) {
    brand = await prisma.brandSettings.findFirst({ where: { tenantId: null } });
  }
  const printLogoUrl = brand?.logoDarkUrl || brand?.logoLightUrl || '';

  // Fetch List Data
  let listEmails: any[] = [];

  const fetchMixedEmails = async (recipientWhere: any, senderWhere: any) => {
    const [received, sent] = await Promise.all([
      prisma.emailRecipient.findMany({
        where: { userId: user.id, ...recipientWhere },
        include: {
          email: {
            include: {
              sender: { select: { name: true, email: true } },
              attachments: { include: { file: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.email.findMany({
        where: { senderId: user.id, ...senderWhere },
        include: {
          sender: { select: { name: true, email: true } },
          attachments: { include: { file: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const normReceived = received.map((r) => ({
      ...r.email,
      isRead: r.isRead,
      isStarred: r.isStarred,
      folder: r.folder,
    }));

    const normSent = sent.map((s) => ({
      ...s,
      isRead: true,
      isStarred: s.isStarred,
      folder: s.senderFolder,
    }));

    const uniqueMap = new Map();
    [...normReceived, ...normSent].forEach((item) => {
      if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
    });

    return Array.from(uniqueMap.values()).sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  };

  // Fetch emails based on folder
  if (folder === "sent") {
    const raw = await prisma.email.findMany({
      where: { senderId: user.id, senderFolder: "sent" },
      include: {
        sender: { select: { name: true, email: true } },
        attachments: { include: { file: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    listEmails = raw.map((e) => ({
      ...e,
      isRead: true,
      folder: "sent",
    }));
  } else if (folder === "trash") {
    listEmails = await fetchMixedEmails(
      { folder: "trash" },
      { senderFolder: "trash" }
    );
  } else if (folder === "archive") {
    listEmails = await fetchMixedEmails(
      { folder: "archive" },
      { senderFolder: "archive" }
    );
  } else if (folder === "all") {
    listEmails = await fetchMixedEmails(
      { folder: { notIn: ["trash", "deleted"] } },
      { senderFolder: { not: "trash" } }
    );
  } else {
    const raw = await prisma.emailRecipient.findMany({
      where: { userId: user.id, folder: folder },
      include: {
        email: {
          include: {
            sender: { select: { name: true, email: true } },
            attachments: { include: { file: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    listEmails = raw.map((r) => ({
      ...r.email,
      isRead: r.isRead,
      isStarred: r.isStarred,
      folder: r.folder,
    }));
  }

  const formattedList = listEmails.map((emailData: any) => {
    const attachments: ListAttachment[] = (emailData.attachments ?? []).map(
      (att: any) => ({
        id: att.id,
        type: mapAttachmentType(att.file?.mimeType || null),
        url: att.file.url,
        name: att.file.name,
        mimeType: att.file.mimeType,
        size: att.file.size ?? null,
      })
    );

    return {
      id: emailData.id,
      isRead: emailData.isRead ?? true,
      isStarred: emailData.isStarred ?? false,
      email: {
        id: emailData.id,
        subject: emailData.subject,
        body: emailData.body,
        createdAt: emailData.createdAt,
        sender: emailData.sender,
        attachments,
        isE2EE: emailData.isE2EE ?? false,
      },
    };
  });

  // FETCH EMAIL DETAIL
  const email = await prisma.email.findUnique({
    where: { id: params.id },
    include: {
      sender: {
        select: { id: true, name: true, email: true, image: true },
      },
      recipients: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      attachments: {
        include: { file: true },
      },
    },
  });

  if (!email) return notFound();

  const isSender = email.senderId === user.id;
  const myRecipientRecord = email.recipients.find(
    (r) => r.userId === user.id
  );

  if (!isSender && !myRecipientRecord) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            Access Denied
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            You don't have permission to view this email.
          </p>
          <a
            href={`/email?folder=${folder}`}
            className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium"
          >
            Return to {folder}
          </a>
        </div>
      </div>
    );
  }

  // Get read status
  const isRead = isSender ? true : myRecipientRecord?.isRead ?? true;

  // Add properties for client-side use
  const enhancedEmail = {
    ...email,
    isSender,
    isE2EE: (email as any).isE2EE ?? false,
    isStarred: (email as any).isStarred ?? false,
  };

  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
  });

  // Attachments for the detail view
  const detailAttachments: ListAttachment[] = (email.attachments ?? []).map(
    (att: any) => ({
      id: att.id,
      type: mapAttachmentType(att.file?.mimeType || null),
      url: att.file.url,
      name: att.file.name,
      mimeType: att.file.mimeType,
      size: att.file.size ?? null,
    })
  );

  // Handle E2EE decryption
  let finalSubject = email.subject || '';
  let finalBodyHtml = email.body || '';
  let decryptionError: string | null = null;

  if ((email as any).isE2EE) {
    try {
      const [decryptedBody, decryptedSubject] = await Promise.all([
        autoDecryptAction(email.body || ''),
        autoDecryptAction(email.subject || ''),
      ]);

      finalBodyHtml = DOMPurify.sanitize(decryptedBody || '', {
        ADD_TAGS: ["iframe", "video", "source"],
        ADD_ATTR: [
          "src", "allow", "allowfullscreen", "frameborder", "title", "controls", 
          "data-video-block", "kind", "provider", "type", "width", "height"
        ],
      });
      finalSubject = DOMPurify.sanitize(decryptedSubject, { 
        ALLOWED_TAGS: [], 
        ALLOWED_ATTR: [] 
      });
    } catch (e: any) {
      console.error("Server-side auto-decryption failed:", e.message);
      decryptionError = e.message || "Decryption failed.";
      
      finalSubject = email.subject || "(Encrypted)";
      finalBodyHtml = `
        <div style="text-align: center; padding: 40px 20px; color: #dc2626;">
          <p style="font-weight: bold; margin-bottom: 8px;">
            Could not automatically decrypt message.
          </p>
          <p style="font-size: 14px; color: #6b7280;">
            Error: ${decryptionError}
          </p>
        </div>
      `;
    }
  } else {
    finalBodyHtml = DOMPurify.sanitize(email.body || '', {
      ADD_TAGS: ["iframe", "video", "source"],
      ADD_ATTR: [
        "src", "allow", "allowfullscreen", "frameborder", "title", "controls", 
        "data-video-block", "kind", "provider", "type", "width", "height"
      ],
    });
  }

  return (
    <>
      {/* LEFT: list column */}
      <div className="hidden lg:block h-full w-[380px] min-w-0 border-r border-slate-200 dark:border-slate-800 print:hidden">
        <EmailList
          initialEmails={formattedList}
          currentUserId={user.id}
          folderName={folder}
          totalCount={formattedList.length}
          currentPage={1}
          pageSize={10}
        />
      </div>

      {/* RIGHT: detail column */}
      <div className="flex-1">
        <EmailContentWrapper 
          email={enhancedEmail} 
          finalSubject={finalSubject}
          finalBodyHtml={finalBodyHtml}
          decryptionError={decryptionError}
          detailAttachments={detailAttachments}
          allUsers={allUsers}
          currentUserId={user.id}
          folder={folder}
          printLogoUrl={printLogoUrl}
          isRead={isRead}
        />
      </div>
    </>
  );
}