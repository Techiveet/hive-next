// app/api/sync/route.ts
import { NextResponse } from "next/server";

/**
 * This endpoint receives a single pending item from the service worker or client for immediate sync.
 * You may prefer to have your SW call the actual endpoints saved in the pending item (e.g. /api/messages).
 * For now we accept POST of { url, method, payload } and forward to the real endpoint server-side.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json(); // expect { url, method, payload } or a single item
    // If body is array - iterate; else single
    const items = Array.isArray(body) ? body : [body];

    const results = [];

    for (const item of items) {
      // Basic server-side forwarding: call internal route via fetch (server to server)
      // Note: If your API routes require authentication, you'll need to attach credentials or validate differently.
      const targetUrl = item.url.startsWith("/") ? `${process.env.NEXT_PUBLIC_BASE_URL || ""}${item.url}` : item.url;
      const res = await fetch(targetUrl, {
        method: item.method || "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(item.payload),
      });

      results.push({ ok: res.ok, status: res.status });
    }

    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
