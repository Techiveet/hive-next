// app/(dashboard)/email/[id]/page.tsx

import { notFound, redirect } from "next/navigation";

import DOMPurify from "isomorphic-dompurify";
import { EmailDetailUI } from "./email-detail-ui";
import { EmailListContainer } from "../_components/email-list-container";
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
            <div
              key={i}
              className="h-24 bg-slate-50 dark:bg-slate-800 rounded-lg animate-pulse"
            />
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
          file: {
            select: {
              id: true,
              name: true,
              mimeType: true,
              url: true,
              size: true,
            },
          },
        },
      },
    },
  });

  if (!email) return notFound();

  const isSender = email.senderId === user.id;
  const myRecipientRecord = email.recipients.find((r) => r.userId === user.id);

  if (!isSender && !myRecipientRecord) {
    // keep server-safe fallback (optional: convert this too into client for localization)
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-slate-500 mb-4">
            You don&apos;t have permission to view this email.
          </p>
          <a href={`/email?folder=${folder}`} className="text-emerald-600 font-medium">
            Return to {folder}
          </a>
        </div>
      </div>
    );
  }

  const isReadForToolbar = isSender ? true : Boolean(myRecipientRecord?.isRead);

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

      finalSubject = DOMPurify.sanitize(decryptedSubject || "", {
        ALLOWED_TAGS: [],
      });
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
    url: att.file?.url || "",
    name: att.file?.name || "Attachment",
  }));

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
  });

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

      {/* RIGHT: localized UI */}
      <EmailDetailUI
        email={email}
        folder={folder}
        users={users}
        isReadForToolbar={isReadForToolbar}
        isSpamDetail={isSpamDetail}
        myRecipientRecord={myRecipientRecord ?? null}
        finalSubject={finalSubject}
        finalBody={finalBody}
        decryptionError={decryptionError}
        detailAttachments={detailAttachments}
        currentUserId={user.id}
      />
    </>
  );
}
