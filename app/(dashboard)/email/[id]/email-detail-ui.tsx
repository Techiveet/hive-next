"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { EmailDetailToolbar } from "./email-detail-toolbar";
import { EmailReplyActions } from "./email-actions-bar";
import { SpamNotice } from "./spam-notice";
import { useTranslation } from "@/lib/hooks/use-translation";

type Attachment = {
  id: string;
  url: string;
  name: string;
};

export function EmailDetailUI(props: {
  email: any;
  folder: string;
  users: any[];
  isReadForToolbar: boolean;
  isSpamDetail: boolean;
  myRecipientRecord: any | null;

  finalSubject: string;
  finalBody: string;
  decryptionError: string | null;

  detailAttachments: Attachment[];
  currentUserId: string;
}) {
  const { t } = useTranslation();

  const recipientsLabel =
    props.email?.recipients?.map((r: any) => r.user.name || r.user.email).join(", ") ||
    t("email.detail.undisclosedRecipients", "Undisclosed recipients");

  return (
    <div className="flex-1 min-h-0 p-4">
      <div className="h-full min-h-0 flex flex-col rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {/* toolbar */}
        <div className="flex-none">
          <EmailDetailToolbar
            email={props.email}
            currentUserId={props.currentUserId}
            users={props.users}
            isRead={props.isReadForToolbar}
            currentFolder={props.folder}
          />
        </div>

        {/* scroll area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-6">
            <div className="max-w-4xl mx-auto">
              {/* Spam banner */}
              {props.isSpamDetail && props.myRecipientRecord && (
                <div className="mb-5 print:hidden">
                  <SpamNotice
                    emailId={props.email.id}
                    previousFolder={props.myRecipientRecord.previousFolder ?? "inbox"}
                    spamReason={props.myRecipientRecord.spamReason}
                    spamScore={props.myRecipientRecord.spamScore}
                    spamFlags={props.myRecipientRecord.spamFlags}
                  />
                </div>
              )}

              {/* header */}
              <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-4">
                  {props.finalSubject}
                </h1>

                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={props.email.sender.image || undefined} />
                      <AvatarFallback className="bg-emerald-600 text-white">
                        {props.email.sender.name?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>

                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {props.email.sender.name || props.email.sender.email}
                      </p>

                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t("email.detail.toLabel", "To:")} {recipientsLabel}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {new Date(props.email.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {new Date(props.email.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* body */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
                {props.decryptionError ? (
                  <div className="p-8 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg">
                    {t("email.detail.decryptionFailedTitle", "Decryption Failed")}
                  </div>
                ) : (
                  <div
                    className="prose prose-lg dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: props.finalBody }}
                  />
                )}
              </div>

              {/* attachments */}
              {props.detailAttachments.length > 0 && (
                <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-6">
                  <h3 className="font-semibold mb-4">
                    {t("email.attachments.title", "Attachments")} ({props.detailAttachments.length})
                  </h3>

                  <div className="grid gap-3">
                    {props.detailAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <span className="font-medium">{att.name}</span>
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 text-sm"
                        >
                          {t("email.attachments.download", "Download")}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* reply/forward */}
              <div className="mt-10 border-t border-slate-200 dark:border-slate-800 pt-6 print:hidden">
                <EmailReplyActions
                  email={props.email}
                  users={props.users}
                  currentUserId={props.currentUserId}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
