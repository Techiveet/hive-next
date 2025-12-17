// app/api/emails/route.ts

import { NextRequest, NextResponse } from 'next/server';

import DOMPurify from 'isomorphic-dompurify';
import { autoDecryptAction } from '@/app/(dashboard)/email/server-decryption-action';
import { getCurrentSession } from '@/lib/auth-server';
import { getPlainTextPreview } from '@/lib/server/email-queries';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { user } = await getCurrentSession();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const folder = searchParams.get('folder') || 'inbox';
    const cursor = searchParams.get('cursor');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '10', 10), 50);
    const searchQuery = searchParams.get('q') || '';
    const take = pageSize + 1;

    // Common Select Fields
    const EMAIL_SELECT_FIELDS = {
      id: true,
      subject: true,
      body: true,
      senderId: true,
      isStarred: true,
      senderFolder: true,
      createdAt: true,
      isE2EE: true,
      sender: { select: { name: true, email: true } },
      attachments: {
        take: 1,
        select: { id: true, file: { select: { name: true, mimeType: true } } },
      },
      recipients: { take: 2, select: { user: { select: { name: true, email: true } } } },
    };

    let rawItems: any[] = [];
    let nextCursor: string | null = null;

    // Identify folders that need to merge SENT and RECEIVED tables
    const isHybridFolder = ['all', 'trash', 'spam', 'archive', 'starred'].includes(folder);

    // ---------------------------------------------------------
    // SCENARIO 1: HYBRID FOLDERS (Merge Sent + Received)
    // ---------------------------------------------------------
    if (isHybridFolder) {
      const sentWhere: any = { senderId: user.id };
      const receivedWhere: any = { userId: user.id };

      // Apply Folder Logic
      switch (folder) {
        case 'trash':
          sentWhere.senderFolder = 'trash';
          receivedWhere.folder = 'trash';
          break;

        case 'spam':
          sentWhere.senderFolder = 'spam';
          receivedWhere.folder = 'spam';
          break;

        case 'archive':
          sentWhere.senderFolder = 'archive';
          receivedWhere.folder = 'archive';
          break;

        case 'starred':
          sentWhere.isStarred = true;
          sentWhere.senderFolder = { notIn: ['trash', 'spam', 'deleted'] };
          receivedWhere.isStarred = true;
          receivedWhere.folder = { notIn: ['trash', 'spam'] };
          break;

        case 'all':
        default:
          sentWhere.senderFolder = { notIn: ['trash', 'spam', 'drafts', 'deleted'] };
          receivedWhere.folder = { notIn: ['trash', 'spam'] };
          break;
      }

      // ✅ Handle Search (FIXED: removed mode)
      if (searchQuery.trim()) {
        const contains = { contains: searchQuery }; // ✅ no mode

        sentWhere.OR = [
          { subject: contains },
          { body: contains },
          { recipients: { some: { user: { email: contains } } } },
        ];

        receivedWhere.AND = [
          {
            OR: [
              { email: { subject: contains } },
              { email: { body: contains } },
              { email: { sender: { email: contains } } },
              { email: { sender: { name: contains } } },
            ],
          },
        ];
      }

      // Handle Cursor (Date-based for merged lists)
      if (cursor) {
        const cursorDate = new Date(cursor);
        if (!isNaN(cursorDate.getTime())) {
          sentWhere.createdAt = { lt: cursorDate };
          receivedWhere.createdAt = { lt: cursorDate };
        }
      }

      // Parallel Fetch
      const [sentEmails, receivedEmails] = await Promise.all([
        prisma.email.findMany({
          take,
          where: sentWhere,
          orderBy: { createdAt: 'desc' },
          select: EMAIL_SELECT_FIELDS,
        }),
        prisma.emailRecipient.findMany({
          take,
          where: receivedWhere,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            isRead: true,
            isStarred: true,
            folder: true,
            createdAt: true,
            email: { select: EMAIL_SELECT_FIELDS },
          },
        }),
      ]);

      // Normalize
      const normalizedSent = sentEmails.map((e) => ({ ...e, type: 'sent', sortDate: e.createdAt }));
      const normalizedReceived = receivedEmails.map((r) => ({ ...r, type: 'received', sortDate: r.createdAt }));

      // Merge & Sort
      const combined = [...normalizedSent, ...normalizedReceived].sort(
        (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime()
      );

      rawItems = combined.slice(0, pageSize);

      if (combined.length > pageSize) {
        nextCursor = rawItems[rawItems.length - 1].sortDate.toISOString();
      }
    }

    // ---------------------------------------------------------
    // SCENARIO 2: SINGLE TABLE FOLDERS (Inbox, Sent, Drafts)
    // ---------------------------------------------------------
    else {
      const isSentFolder = folder === 'sent' || folder === 'drafts';

      const where: any = isSentFolder
        ? { senderId: user.id, senderFolder: folder }
        : { userId: user.id, folder: folder };

      // ✅ Handle Search (FIXED: removed mode)
      if (searchQuery.trim()) {
        const contains = { contains: searchQuery }; // ✅ no mode

        if (isSentFolder) {
          where.OR = [
            { subject: contains },
            { body: contains },
            { recipients: { some: { user: { email: contains } } } },
          ];
        } else {
          where.AND = [
            {
              OR: [
                { email: { subject: contains } },
                { email: { body: contains } },
                { email: { sender: { email: contains } } },
                { email: { sender: { name: contains } } },
              ],
            },
          ];
        }
      }

      if (cursor) {
        const isDateCursor = !isNaN(Date.parse(cursor)) && cursor.length > 20;

        if (isDateCursor) {
          where.createdAt = { lt: new Date(cursor) };
        } else {
          const Model = isSentFolder ? prisma.email : prisma.emailRecipient;
          const cursorItem = await (Model as any).findUnique({
            where: { id: cursor },
            select: { createdAt: true },
          });
          if (cursorItem) {
            where.createdAt = { lt: cursorItem.createdAt };
          }
        }
      }

      const items = isSentFolder
        ? await prisma.email.findMany({
            take,
            orderBy: { createdAt: 'desc' },
            where,
            select: EMAIL_SELECT_FIELDS,
          })
        : await prisma.emailRecipient.findMany({
            take,
            orderBy: { createdAt: 'desc' },
            where,
            select: {
              id: true,
              isRead: true,
              isStarred: true,
              folder: true,
              email: { select: EMAIL_SELECT_FIELDS },
            },
          });

      rawItems = items.slice(0, pageSize);
      if (items.length > pageSize) {
        nextCursor = rawItems[rawItems.length - 1].id;
      }
    }

    // ---------------------------------------------------------
    // FORMATTING (decrypts previews)
    // ---------------------------------------------------------
    const formattedEmails = (await Promise.all(
      rawItems.map(async (rawItem: any) => {
        const isSentType =
          rawItem.type === 'sent' || (rawItem.senderFolder !== undefined && rawItem.email === undefined);

        const emailData = isSentType ? rawItem : rawItem.email;
        if (!emailData) return null;

        const isE2EE = emailData.isE2EE ?? false;

        let subject = emailData.subject || '(No Subject)';
        let bodyPreview = '';

        if (isE2EE) {
          try {
            const [decryptedSubject, decryptedBody] = await Promise.all([
              autoDecryptAction(emailData.subject || ''),
              autoDecryptAction(emailData.body || ''),
            ]);

            subject =
              DOMPurify.sanitize(decryptedSubject || '', { ALLOWED_TAGS: [] }).substring(0, 60) ||
              '(No Subject)';

            bodyPreview = getPlainTextPreview(decryptedBody || '', 80);
          } catch {
            subject = '🔒 Encrypted';
            bodyPreview = 'Encrypted content';
          }
        } else {
          subject = emailData.subject || '(No Subject)';
          bodyPreview = getPlainTextPreview(emailData.body || '', 80);
        }

        return {
          id: rawItem.id,
          emailId: emailData.id,
          isRead: isSentType ? true : rawItem.isRead ?? false,
          isStarred: isSentType ? emailData.isStarred : rawItem.isStarred ?? false,
          email: {
            id: emailData.id,
            subject,
            body: bodyPreview,
            createdAt: emailData.createdAt,
            sender: emailData.sender,
            attachments:
              emailData.attachments?.map((a: any) => ({
                id: a.id,
                type: a.file?.mimeType?.startsWith('image/') ? 'IMAGE' : 'FILE',
                name: a.file?.name || 'Attachment',
              })) || [],
            isE2EE,
            recipients: emailData.recipients || [],
          },
        };
      })
    )).filter(Boolean);

    return NextResponse.json({
      success: true,
      data: {
        items: formattedEmails,
        nextCursor,
        hasNextPage: !!nextCursor,
        totalCount: 0,
      },
    });
  } catch (error) {
    console.error('Email API Error:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
