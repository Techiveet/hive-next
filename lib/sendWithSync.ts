// lib/sendWithSync.ts
import { savePending } from "./indexedDB";

/**
 * Attempts to POST to an endpoint. If offline or failed, store in IndexedDB.
 * Usage: await sendWithSync('/api/messages', { text: 'hi' })
 */
export async function sendWithSync(url: string, payload: any, method = "POST") {
  // If navigator is offline, save immediately
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await savePending({ url, method, payload });
    return { cached: true };
  }

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // if server returns error, save for later
      await savePending({ url, method, payload });
      return { cached: true, status: res.status };
    }

    const json = await res.json().catch(() => null);
    return { ok: true, data: json };
  } catch (err) {
    // network error — save to IDB
    await savePending({ url, method, payload });
    return { cached: true, error: String(err) };
  }
}
