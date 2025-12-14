// app/(dashboard)/email/[id]/page.tsx

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { notFound, redirect } from "next/navigation";

import DOMPurify from "isomorphic-dompurify";
import { EmailDetailToolbar } from "./email-detail-toolbar";
import { EmailListContainer } from "../_components/email-list-container";
import { EmailReplyActions } from "./email-actions-bar";
import { SpamNotice } from "./spam-notice"; // ✅ NEW
import { Suspense } from "react";
import { autoDecryptAction } from "../server-decryption-action";
import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

function EmailListLoading() {
  return (
    <div className="h-full w-full lg:w-[380px] min-w-0">
      <div className="flex h-full flex-col rounded-xl bg-white dark:bg-slate-900 border overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 animate-pulse" />
        </div>
        <div className="flex-1 p-2 space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-50 dark:bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function EmailDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ folder?: string; q?: string; cursor?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { user } = await getCurrentSession();

  if (!user) redirect("/sign-in");

  const folder = searchParams.folder || "inbox";
  const searchQuery = searchParams.q || "";
  const cursor = searchParams.cursor || null;

  // ✅ Fetch Email Detail WITH spam fields on recipients
  const email = await prisma.email.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      subject: true,
      body: true,
      senderId: true,
      senderFolder: true,
      isE2EE: true,
      isStarred: true,
      createdAt: true,

      sender: {
        select: { id: true, name: true, email: true, image: true },
      },

      recipients: {
        select: {
          id: true,
          userId: true,
          isRead: true,
          isStarred: true,
          folder: true,
          type: true,

          // ✅ spam meta (from your prisma update)
          previousFolder: true,
          spamReason: true,
          spamScore: true,
          spamFlags: true,

          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },

      attachments: {
        select: {
          id: true,
          file: { select: { id: true, name: true, mimeType: true, url: true, size: true } },
        },
      },
    },
  });

  if (!email) return notFound();

  // Access Control
  const isSender = email.senderId === user.id;
  const myRecipientRecord = email.recipients.find((r) => r.userId === user.id);

  if (!isSender && !myRecipientRecord) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-slate-500 mb-4">You don't have permission to view this email.</p>
          <a href={`/email?folder=${folder}`} className="text-emerald-600 font-medium">
            Return to {folder}
          </a>
        </div>
      </div>
    );
  }

  const isReadForToolbar = isSender ? true : Boolean(myRecipientRecord?.isRead);

  // Decryption Logic
  let finalSubject = email.subject || "";
  let finalBody = email.body || "";
  let decryptionError: string | null = null;

  if (email.isE2EE) {
    try {
      const [decryptedBody, decryptedSubject] = await Promise.all([
        autoDecryptAction(email.body || ""),
        autoDecryptAction(email.subject || ""),
      ]);

      finalBody = DOMPurify.sanitize(decryptedBody || "", {
        ADD_TAGS: ["iframe"],
        ADD_ATTR: ["src"],
      });

      finalSubject = DOMPurify.sanitize(decryptedSubject || "", { ALLOWED_TAGS: [] });
    } catch (e: any) {
      decryptionError = e.message;
      finalSubject = email.subject || "(Encrypted)";
      finalBody = "Decryption failed.";
    }
  } else {
    finalBody = DOMPurify.sanitize(email.body || "", {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: ["src"],
    });
  }

  const detailAttachments = (email.attachments ?? []).map((att: any) => ({
    id: att.id,
    type: att.file?.mimeType?.startsWith("image/") ? "IMAGE" : "FILE",
    url: att.file?.url || "",
    name: att.file?.name || "Attachment",
    mimeType: att.file?.mimeType || null,
    size: att.file?.size || null,
  }));

  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true } });

  const isSpamDetail =
    folder === "spam" && !isSender && myRecipientRecord?.folder === "spam";

  return (
    <>
      {/* LEFT: Sidebar List */}
      <div className="hidden lg:block h-full w-[380px] min-w-0 border-r border-slate-200 dark:border-slate-800 print:hidden">
        <Suspense fallback={<EmailListLoading />}>
          <EmailListContainer folder={folder} cursor={cursor} pageSize={10} searchQuery={searchQuery} />
        </Suspense>
      </div>

     {/* RIGHT: Detail View (CARD like the email list) */}
<div className="flex-1 min-h-0 p-4">
  <div className="h-full min-h-0 flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
    {/* toolbar (fixed) */}
    <div className="flex-none">
      <EmailDetailToolbar
        email={email}
        currentUserId={user.id}
        users={users}
        isRead={isReadForToolbar}
        currentFolder={folder}
      />
    </div>

    {/* scroll area */}
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* ✅ Gmail-like Spam banner */}
          {isSpamDetail && myRecipientRecord && (
            <div className="mb-5 print:hidden">
              <SpamNotice
                emailId={email.id}
                previousFolder={myRecipientRecord.previousFolder ?? "inbox"}
                spamReason={myRecipientRecord.spamReason}
                spamScore={myRecipientRecord.spamScore}
                spamFlags={myRecipientRecord.spamFlags}
              />
            </div>
          )}

          {/* header */}
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-4">
              {finalSubject}
            </h1>

            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={email.sender.image || undefined} />
                  <AvatarFallback className="bg-emerald-600 text-white">
                    {email.sender.name?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {email.sender.name || email.sender.email}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    to: {email.recipients.map((r) => r.user.name || r.user.email).join(", ")}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {new Date(email.createdAt).toLocaleDateString()}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {new Date(email.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>

          {/* body */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
            {decryptionError ? (
              <div className="p-8 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg">
                Decryption Failed
              </div>
            ) : (
              <div
                className="prose prose-lg dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: finalBody }}
              />
            )}
          </div>

          {/* attachments */}
          {detailAttachments.length > 0 && (
            <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-6">
              <h3 className="font-semibold mb-4">
                Attachments ({detailAttachments.length})
              </h3>
              <div className="grid gap-3">
                {detailAttachments.map((att: any) => (
                  <div key={att.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="font-medium">{att.name}</span>
                    <a href={att.url} target="_blank" className="text-emerald-600 text-sm">
                      Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ✅ Reply/Forward BELOW body + attachments */}
          <div className="mt-10 border-t border-slate-200 dark:border-slate-800 pt-6 print:hidden">
            <EmailReplyActions email={email} users={users} currentUserId={user.id} />
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

    </>
  );
}
