// lib/server/email-queries.ts

import { cache } from '@/lib/cache';
import { prisma } from '@/lib/prisma';

// Optimized SELECT fields for list view
const EMAIL_LIST_SELECT = {
  id: true,
  subject: true,
  body: true,
  senderId: true,
  isStarred: true,
  senderFolder: true,
  createdAt: true,
  isE2EE: true,
  sender: {
    select: {
      name: true,
      email: true,
    },
  },
  attachments: {
    take: 1, // Only need first attachment for indicator
    select: {
      id: true,
      file: {
        select: {
          name: true,
          mimeType: true,
          size: true,
        },
      },
    },
  },
  recipients: {
    take: 2, // Only need first 2 for display
    select: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  },
};

// Cached email list fetcher
export const getCachedEmails = cache(
  async (
    userId: string,
    folder: string,
    cursor: string | null = null,
    pageSize: number = 10
  ) => {
    const take = pageSize + 1; // Get one extra to check for next page
    
    // Common where clauses
    const whereClauses = {
      inbox: { userId, folder: 'inbox' },
      archive: { userId, folder: 'archive' },
      trash: { userId, folder: 'trash' },
      starred: { userId, folder: { not: 'trash' }, isStarred: true },
      all: { userId, folder: { not: 'trash' } },
      sent: { senderId: userId, senderFolder: 'sent' },
      drafts: { senderId: userId, senderFolder: 'drafts' },
    };

    let queryOptions: any = {
      take,
      orderBy: { createdAt: 'desc' as const },
    };

    // Set cursor if provided
    if (cursor) {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1;
    }

    let result: any[] = [];
    let isRecipientFlow = true;

    // Determine query type
    if (folder === 'sent' || folder === 'drafts') {
      isRecipientFlow = false;
      queryOptions.where = whereClauses[folder as keyof typeof whereClauses];
      queryOptions.select = EMAIL_LIST_SELECT;
      result = await prisma.email.findMany(queryOptions);
    } else {
      queryOptions.where = whereClauses[folder as keyof typeof whereClauses];
      queryOptions.select = {
        id: true,
        isRead: true,
        isStarred: true,
        folder: true,
        email: {
          select: EMAIL_LIST_SELECT,
        },
      };
      result = await prisma.emailRecipient.findMany(queryOptions);
    }

    // Check for next page
    const hasNextPage = result.length > pageSize;
    const nextCursor = hasNextPage ? result[pageSize - 1].id : null;
    
    // Return only pageSize items
    const items = result.slice(0, pageSize);

    return {
      items,
      nextCursor,
      hasNextPage,
      isRecipientFlow,
    };
  },
  ['emails'], // Cache key
  { revalidate: 30, tags: ['emails'] } // Cache for 30 seconds
);

// Fast text preview generator
export function getPlainTextPreview(html: string | null | undefined, maxLength: number = 100): string {
  if (!html) return '';
  
  let text = '';
  let inTag = false;
  
  for (let i = 0; i < html.length && text.length < maxLength; i++) {
    const char = html[i];
    
    if (char === '<') {
      inTag = true;
    } else if (char === '>') {
      inTag = false;
    } else if (!inTag && char !== '\n' && char !== '\r' && char !== '\t') {
      text += char === ' ' && text.length > 0 && text[text.length - 1] === ' ' ? '' : char;
    }
  }
  
  return text.trim();
}