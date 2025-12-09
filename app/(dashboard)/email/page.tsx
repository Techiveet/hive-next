// app/(dashboard)/email/page.tsx

import DOMPurify from "isomorphic-dompurify";
import { EmailList } from "./_components/email-list";
import { Mail } from "lucide-react";
import { autoDecryptAction } from "./server-decryption-action"; // Import decryption action
import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

// Helper function to map attachment type (reused from detail page)
const mapAttachmentType = (mime: string | null | undefined): string => {
    if (!mime) return "FILE";
    if (mime.startsWith("image/")) return "IMAGE";
    if (mime.startsWith("video/")) return "VIDEO";
    return "FILE";
};

// ====================================================================
// CORE LIST DECRYPTION FUNCTION (Server-side)
// ====================================================================

/**
 * Decrypts and sanitizes content for a single email list item.
 * Runs only on the server.
 */
async function decryptEmailListItem(emailData: any, isRecipient: boolean) {
    let subject = emailData.subject;
    let body = emailData.body;

    // The isE2EE status MUST be retrieved from the Email model object
    const isE2EE = emailData.isE2EE ?? false;

    if (isE2EE) {
        try {
            // Decrypt the subject and body
            const [decryptedBody, decryptedSubject] = await Promise.all([
                autoDecryptAction(emailData.body),
                autoDecryptAction(emailData.subject),
            ]);

            // Sanitize the decrypted subject
            subject = DOMPurify.sanitize(decryptedSubject);
            
            // Get a plaintext preview from the decrypted body HTML
            // We strip tags and then truncate for the list view
            body = DOMPurify.sanitize(decryptedBody, {ALLOWED_TAGS: []}).substring(0, 140).trim(); 
            
        } catch (e) {
            // If decryption fails, show a placeholder
            subject = `🔒 E2EE Failed: ${emailData.subject || "No Subject"}`;
            body = "This E2EE message failed server-side decryption.";
        }
    } else {
         // If not E2EE, get a sanitized plaintext preview for the list
        body = DOMPurify.sanitize(body || "", {ALLOWED_TAGS: []}).substring(0, 140).trim();
    }
    
    // Flatten and normalize data structure required by EmailList client component
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
            isE2EE: isE2EE, // Pass E2EE status
            recipients: emailData.recipients, // Pass recipients for "sent" logic
        },
    };
}


/**
 * Processes raw email fetch results (which might be EmailRecipient or Email models) 
 * and applies decryption/normalization in parallel.
 */
async function processRawEmails(rawItems: any[], isRecipientFlow: boolean) {
    // Create an array of promises to process each item
    const decryptionPromises = rawItems.map(async (rawItem) => {
        const emailData = isRecipientFlow ? rawItem.email : rawItem;
        
        // Decrypt and normalize the core email fields
        const processedEmail = await decryptEmailListItem(emailData, isRecipientFlow);
        
        // Return the final structure required by the EmailListItem type
        return {
            id: emailData.id,
            isRead: isRecipientFlow ? (rawItem.isRead ?? false) : true,
            isStarred: isRecipientFlow ? (rawItem.isStarred ?? false) : (emailData.isStarred ?? false),
            email: processedEmail.email,
        };
    });

    // Resolve all promises
    const formattedList = await Promise.all(decryptionPromises);
    
    // Ensure final sort by date
    formattedList.sort((a: any, b: any) => 
        new Date(b.email.createdAt).getTime() - new Date(a.email.createdAt).getTime()
    );

    return formattedList;
}

// ====================================================================
// MAIN PAGE FUNCTION
// ====================================================================

export default async function EmailPage({
    searchParams,
}: {
    searchParams: Promise<{ folder?: string }>;
}) {
    const { user } = await getCurrentSession();
    if (!user) redirect("/sign-in");

    const params = await searchParams;
    const folder = params.folder || "inbox";

    let rawEmails: any[] = [];
    let formattedEmails: any[] = [];
    
    // 1. Core SELECT fields (Scalars)
    const emailSelectScalars = {
        id: true,
        subject: true,
        body: true,
        senderId: true,
        isStarred: true,
        senderFolder: true,
        createdAt: true,
        isE2EE: true, // FIX: Scalar field for E2EE status
    };

    // 2. Core INCLUDE relations
    const emailIncludeRelations = {
        sender: { select: { name: true, email: true } },
        attachments: { include: { file: true } },
        recipients: { include: { user: { select: { name: true, email: true } } } }, 
    };
    
    
    // Helper to fetch core data required for list view
    const fetchItems = async (isRecipient: boolean, whereClause: any) => {
        if (isRecipient) {
            // Recipient flow: Fetch EmailRecipient, and SELECT/INCLUDE the related Email model.
            return prisma.emailRecipient.findMany({
                where: whereClause,
                select: { // Select on EmailRecipient (to get id, isRead, isStarred)
                    id: true,
                    isRead: true,
                    isStarred: true,
                    folder: true,
                    email: {
                        select: { // FIX: Select on NESTED Email model to get scalar fields and includes
                           ...emailSelectScalars,
                           ...emailIncludeRelations // Includes within select
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            });
        } else {
            // Sender flow: Fetch the Email model directly
            return prisma.email.findMany({
                where: whereClause,
                select: { // Select on the Email model
                    ...emailSelectScalars,
                    ...emailIncludeRelations
                },
                orderBy: { createdAt: "desc" },
            });
        }
    };
    
    // --- Fetch logic for each folder ---

    if (folder === "sent" || folder === "drafts") {
        rawEmails = await fetchItems(false, { senderId: user.id, senderFolder: folder });
        formattedEmails = await processRawEmails(rawEmails, false);

    } else if (["inbox", "archive", "trash"].includes(folder)) {
        const receivedWhere = { userId: user.id, folder: folder };
        rawEmails = await fetchItems(true, receivedWhere); 
        formattedEmails = await processRawEmails(rawEmails, true);

    } else if (folder === "starred" || folder === "all") {
        
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
        
        const uniqueItems = Array.from(uniqueMap.values());
        formattedEmails = await processRawEmails(uniqueItems, true); 
    }

    // Final sort
    formattedEmails.sort((a: any, b: any) => 
        new Date(b.email.createdAt).getTime() - new Date(a.email.createdAt).getTime()
    );


    return (
        <>
            {/* COL 2: EMAIL LIST (Receives fully decrypted/previewed data) */}
            <div className="h-full w-full lg:w-[380px] min-w-0">
                <EmailList
                    initialEmails={formattedEmails}
                    currentUserId={user.id}
                    folderName={folder}
                />
            </div>

            {/* COL 3: PLACEHOLDER */}
            <div className="hidden flex-1 lg:flex h-full flex-col items-center justify-center rounded-xl bg-white shadow-sm border border-slate-200 dark:bg-slate-900 dark:border-slate-800 p-8 text-center">
                <div className="relative mb-6 rounded-full bg-slate-50 p-6 dark:bg-slate-800">
                    <Mail className="h-12 w-12 text-slate-300" />
                    <div className="absolute right-5 top-5 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-slate-900" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    Select an email to read
                </h2>
                <p className="mt-2 text-sm text-slate-500 max-w-xs mx-auto">
                    Choose a message from the list to view its details.
                </p>
            </div>
        </>
    );
}