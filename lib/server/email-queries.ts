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

/**
 * Fast text preview generator (Server-Safe HTML Stripping).
 * @param html The HTML string to convert.
 * @param maxLength The maximum length for the preview.
 */
export function getPlainTextPreview(html: string | null | undefined, maxLength: number = 100): string {
    if (!html) return '';
    
    // 1. Strip HTML tags by replacing them with a space
    let text = html.replace(/<[^>]*>/g, ' ');

    // 2. Normalize and collapse whitespace (newlines, tabs, multiple spaces)
    text = text.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, ' ').trim();
    
    // 3. Truncate
    return text.substring(0, maxLength);
}