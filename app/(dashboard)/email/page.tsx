// app/(dashboard)/email/page.tsx

import DOMPurify from 'isomorphic-dompurify';
import { EmailList } from './_components/email-list';
import EmailListLoading from './loading';
import { Mail } from 'lucide-react';
import { Suspense } from 'react';
import { autoDecryptAction } from './server-decryption-action';
import { getCachedEmails } from '@/lib/server/email-queries';
import { getCurrentSession } from '@/lib/auth-server';
import { redirect } from 'next/navigation';

// Email processing component (separate for Suspense)
async function EmailListData({ 
  folder, 
  cursor, 
  pageSize = 10 
}: { 
  folder: string; 
  cursor: string | null; 
  pageSize: number;
}) {
  const { user } = await getCurrentSession();
  if (!user) redirect('/sign-in');

  // Get cached emails
  const { items: rawEmails, nextCursor, isRecipientFlow } = await getCachedEmails(
    user.id,
    folder,
    cursor,
    pageSize
  );

  // Process emails (max 4 at a time for speed)
  const BATCH_SIZE = 4;
  const formattedEmails: any[] = [];

  for (let i = 0; i < rawEmails.length; i += BATCH_SIZE) {
    const batch = rawEmails.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(async (rawItem) => {
      const emailData = isRecipientFlow ? rawItem.email : rawItem;
      const isE2EE = emailData.isE2EE ?? false;

      let subject = emailData.subject || '';
      let bodyPreview = '';

      if (isE2EE) {
        try {
          const decryptedSubject = await autoDecryptAction(emailData.subject || '');
          subject = DOMPurify.sanitize(decryptedSubject, { ALLOWED_TAGS: [] }).substring(0, 60);
          bodyPreview = '🔒 Encrypted message';
        } catch {
          subject = '🔒 Encrypted';
          bodyPreview = 'Encrypted content';
        }
      } else {
        bodyPreview = (emailData.body || '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .substring(0, 80)
          .trim();
      }

      return {
        id: emailData.id,
        isRead: isRecipientFlow ? (rawItem.isRead ?? false) : true,
        isStarred: isRecipientFlow ? (rawItem.isStarred ?? false) : (emailData.isStarred ?? false),
        email: {
          id: emailData.id,
          subject,
          body: bodyPreview,
          createdAt: emailData.createdAt,
          sender: emailData.sender,
          attachments: emailData.attachments?.map((a: any) => ({
            id: a.id,
            type: a.file?.mimeType?.startsWith('image/') ? 'IMAGE' : 
                  a.file?.mimeType?.startsWith('video/') ? 'VIDEO' : 'FILE',
            url: '',
            name: a.file?.name || 'Attachment',
          })) || [],
          isE2EE,
          recipients: emailData.recipients || [],
        },
      };
    });

    const batchResults = await Promise.all(batchPromises);
    formattedEmails.push(...batchResults);
  }

  // Sort by date
  formattedEmails.sort((a, b) => 
    new Date(b.email.createdAt).getTime() - new Date(a.email.createdAt).getTime()
  );

  return (
    <EmailList
      initialEmails={formattedEmails}
      currentUserId={user.id}
      folderName={folder}
      nextCursor={nextCursor}
      pageSize={pageSize}
    />
  );
}

// Main page component
export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; cursor?: string; pageSize?: string }>;
}) {
  const params = await searchParams;
  const folder = params.folder || 'inbox';
  const cursor = params.cursor || null;
  const pageSize = Math.min(parseInt(params.pageSize || '10'), 20);

  return (
    <>
      {/* Email List Column */}
      <div className="h-full w-full lg:w-[380px] min-w-0">
        <Suspense fallback={<EmailListLoading />}>
          <EmailListData 
            folder={folder} 
            cursor={cursor} 
            pageSize={pageSize} 
          />
        </Suspense>
      </div>

      {/* Placeholder Column */}
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