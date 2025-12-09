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
import { autoDecryptAction } from "../server-decryption-action"; // Import decryption action
import { format } from "date-fns";
import { getCurrentSession } from "@/lib/auth-server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

// --- Helper Functions (Start) ---

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

// Attachments Section (Client Component dependency)
function EmailAttachments({ attachments }: { attachments: ListAttachment[] }) {
    // ... (implementation omitted for brevity)
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

                    // ... (rest of attachment rendering logic omitted) ...
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
                                <video
                                    src={att.url}
                                    controls
                                    className="w-full h-32 object-cover"
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
// CORE LIST DECRYPTION FUNCTION
// ====================================================================

/**
 * Decrypts and sanitizes content for a single email list item.
 */
async function decryptEmailListItem(emailData: any, isRecipient: boolean) {
    let subject = emailData.subject;
    let body = emailData.body;

    const isE2EE = emailData.isE2EE ?? false;

    if (isE2EE) {
        try {
            const [decryptedBody, decryptedSubject] = await Promise.all([
                autoDecryptAction(emailData.body),
                autoDecryptAction(emailData.subject),
            ]);

            subject = DOMPurify.sanitize(decryptedSubject);
            body = DOMPurify.sanitize(decryptedBody, {ALLOWED_TAGS: []}).substring(0, 140).trim(); 
            
        } catch (e) {
            subject = `🔒 E2EE Failed: ${emailData.subject || "No Subject"}`;
            body = "This E2EE message failed server-side decryption.";
        }
    } else {
        body = DOMPurify.sanitize(body || "", {ALLOWED_TAGS: []}).substring(0, 140).trim();
    }
    
    const attachments =
        emailData.attachments?.map((a: any) => ({
            id: a.id,
            type: mapAttachmentType(a.file?.mimeType),
            url: a.file?.url ?? "",
            name: a.file?.name ?? "Attachment",
            mimeType: a.file?.mimeType ?? null,
            size: a.file?.size ?? null,
        })) ?? [];

    return {
        id: emailData.id,
        email: {
            id: emailData.id,
            subject: subject, // Decrypted subject
            body: body,      // Decrypted/Clean preview body
            createdAt: emailData.createdAt,
            sender: emailData.sender,
            attachments,
            isE2EE: isE2EE, 
            recipients: emailData.recipients,
        },
    };
}

/**
 * Processes raw email fetch results (which might be EmailRecipient or Email models) 
 * and applies decryption/normalization in parallel.
 */
async function processRawEmails(rawItems: any[], isRecipientFlow: boolean) {
    
    const decryptionPromises = rawItems.map(async (rawItem) => {
        const emailData = isRecipientFlow ? rawItem.email : rawItem;
        
        const processedEmail = await decryptEmailListItem(emailData, isRecipientFlow);
        
        return {
            id: emailData.id,
            isRead: isRecipientFlow ? (rawItem.isRead ?? false) : true,
            isStarred: isRecipientFlow ? (rawItem.isStarred ?? false) : (emailData.isStarred ?? false),
            email: processedEmail.email,
        };
    });

    const formattedList = await Promise.all(decryptionPromises);
    
    formattedList.sort((a: any, b: any) => 
        new Date(b.email.createdAt).getTime() - new Date(a.email.createdAt).getTime()
    );

    return formattedList;
}

// --- Helper Functions (End) ---


// FETCH EMAIL DETAIL
export default async function EmailDetailPage(props: PageProps) {
    type PageProps = {
        params: { id: string };
        searchParams: { folder?: string };
    };

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
    const printLogoUrl = brand?.logoDarkUrl || brand?.logoLightUrl;
    
    
    // --- DATABASE QUERY STRUCTURES ---
    const emailSelectScalars = {
        id: true,
        subject: true,
        body: true,
        senderId: true,
        isStarred: true,
        senderFolder: true,
        createdAt: true,
        isE2EE: true, // FIX: Scalar field selected
    };

    const emailIncludeRelations = {
        sender: { select: { name: true, email: true } },
        attachments: { include: { file: true } },
        recipients: { include: { user: { select: { name: true, email: true } } } }, 
    };
    
    const fetchItems = async (isRecipient: boolean, whereClause: any) => {
        if (isRecipient) {
            return prisma.emailRecipient.findMany({
                where: whereClause,
                select: { 
                    id: true,
                    isRead: true,
                    isStarred: true,
                    folder: true,
                    email: {
                        select: { 
                           ...emailSelectScalars,
                           ...emailIncludeRelations
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            });
        } else {
            return prisma.email.findMany({
                where: whereClause,
                select: { 
                    ...emailSelectScalars,
                    ...emailIncludeRelations
                },
                orderBy: { createdAt: "desc" },
            });
        }
    };
    // --- END DATABASE QUERY STRUCTURES ---


    // --- LIST DATA FETCH AND DECRYPTION ---
    let listEmails: any[] = [];
    
    if (folder === "sent" || folder === "drafts") {
        listEmails = await fetchItems(false, { senderId: user.id, senderFolder: folder });
    } else if (["inbox", "archive", "trash"].includes(folder)) {
        listEmails = await fetchItems(true, { userId: user.id, folder: folder });
    } else if (folder === "all" || folder === "starred") {
        
        const [sentItems, receivedItems] = await Promise.all([
            fetchItems(false, { 
                senderId: user.id, 
                senderFolder: folder === "all" ? { not: "trash" } : { not: "trash" }, 
                isStarred: folder === "starred" ? true : undefined,
            }),
            fetchItems(true, { 
                userId: user.id, 
                folder: folder === "all" ? { not: "trash" } : { not: "trash" },
                isStarred: folder === "starred" ? true : undefined,
            }),
        ]);

        const uniqueMap = new Map<string, any>();
        receivedItems.forEach(item => uniqueMap.set(item.email.id, item));
        sentItems.forEach(item => {
            if (!uniqueMap.has(item.id)) {
                uniqueMap.set(item.id, { email: item, isRead: true, isStarred: item.isStarred, folder: item.senderFolder });
            }
        });
        listEmails = Array.from(uniqueMap.values());
    }

    // Process the list data for display
    const formattedList = await processRawEmails(listEmails, folder !== "sent" && folder !== "drafts");
    // --- END LIST DATA FETCH AND DECRYPTION ---


    // --- DETAIL DATA FETCH (No changes needed, uses same Select/Include logic) ---
    const email = await prisma.email.findUnique({
        where: { id: params.id },
        select: {
            ...emailSelectScalars,
            ...emailIncludeRelations,
        }
    });

    if (!email) return notFound();

    const isSender = email.senderId === user.id;
    const myRecipientRecord = email.recipients.find(
        (r) => r.userId === user.id
    );

    if (!isSender && !myRecipientRecord) {
        return <div>Access Denied</div>;
    }

    const isRead = isSender ? true : myRecipientRecord?.isRead ?? true; 
    
    // DETAIL ATTACHMENTS (Mapping remains the same)
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

    // --- AUTOMATIC DETAIL DECRYPTION LOGIC ---
    let finalSubject = email.subject;
    let finalBodyHtml = email.body || "";
    let decryptionError = null;
    const isE2EE = email.isE2EE ?? false;

    if (isE2EE) {
        try {
            const [decryptedBody, decryptedSubject] = await Promise.all([
                autoDecryptAction(email.body),
                autoDecryptAction(email.subject),
            ]);

            finalBodyHtml = DOMPurify.sanitize(decryptedBody || "", {
                ADD_TAGS: ["iframe", "video", "source"],
                ADD_ATTR: [
                    "src", "allow", "allowfullscreen", "frameborder", "title", "controls", 
                    "data-video-block", "kind", "provider", "type", "width", "height"
                ],
            });
            finalSubject = DOMPurify.sanitize(decryptedSubject); 

        } catch (e: any) {
            console.error("Server-side auto-decryption failed:", e.message);
            decryptionError = e.message || "Decryption failed.";
            
            finalSubject = email.subject || "(Encrypted)";
            finalBodyHtml = 
                `<div style="text-align: center; color: #dc2626; padding: 20px;">
                    <p style="font-weight: bold;">Could not automatically decrypt message.</p>
                    <p style="font-size: small;">Error: ${decryptionError}</p>
                </div>`;
        }
    } else {
        finalBodyHtml = DOMPurify.sanitize(email.body || "", {
            ADD_TAGS: ["iframe", "video", "source"],
            ADD_ATTR: [
                "src", "allow", "allowfullscreen", "frameborder", "title", "controls", 
                "data-video-block", "kind", "provider", "type", "width", "height"
            ],
        });
    }
    // -----------------------------------


    return (
        <>
            {/* LEFT: list column */}
            <div className="hidden lg:block h-full w-[380px] min-w-0 border-r border-slate-200 dark:border-slate-800 print:hidden">
                <EmailList
                    initialEmails={formattedList}
                    currentUserId={user.id}
                    folderName={folder}
                />
            </div>

            {/* RIGHT: detail column */}
            <EmailContentWrapper 
                email={{ ...email, isE2EE }} // Pass isE2EE status to client wrapper
                finalSubject={finalSubject} // Pass the final, processed subject
                finalBodyHtml={finalBodyHtml} // Pass the final, processed HTML body
                decryptionError={decryptionError} // Pass the error status
                detailAttachments={detailAttachments}
                allUsers={email.recipients.map(r => r.user)} // Pass users for reply actions
                currentUserId={user.id}
                folder={folder}
                printLogoUrl={printLogoUrl}
                isRead={isRead}
            />
        </>
    );
}