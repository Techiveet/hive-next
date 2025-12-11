// app/api/emails/route.ts

import { NextRequest, NextResponse } from 'next/server';

import { getCachedEmails } from '@/lib/server/email-queries';
import { getCurrentSession } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  try {
    const { user } = await getCurrentSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const folder = searchParams.get('folder') || 'inbox';
    const cursor = searchParams.get('cursor');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    const data = await getCachedEmails(user.id, folder, cursor, pageSize);

    // Add cache headers for edge caching
    const response = NextResponse.json({
      success: true,
      data,
    });

    response.headers.set(
      'Cache-Control',
      'public, s-maxage=30, stale-while-revalidate=59'
    );

    return response;
  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}