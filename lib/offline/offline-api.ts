// lib/offline/offline-api.ts
"use client";

import { queueRequest } from "@/lib/offline/offline-queue";

async function triggerSync() {
  if (!("serviceWorker" in navigator)) return;

  const reg = await navigator.serviceWorker.ready;

  if ("sync" in reg) {
    try {
      await reg.sync.register("sync-pending");
      return;
    } catch {
      // fallback
    }
  }

  reg.active?.postMessage({ type: "sync-pending" });
}

function isWrite(method: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

export async function offlineFetch(url: string, options: RequestInit = {}) {
  const method = (options.method || "GET").toUpperCase();
  const write = isWrite(method);

  // Offline => queue writes immediately
  if (write && typeof navigator !== "undefined" && !navigator.onLine) {
    await queueRequest({
      url,
      method,
      headers: (options.headers as any) || {},
      body: options.body,
    });

    await triggerSync();

    return new Response(JSON.stringify({ queued: true }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Try network
  try {
    const res = await fetch(url, {
      ...options,
      method,
      credentials: "include",
      cache: "no-store",
    });

    // Server error on writes => queue for later
    if (write && !res.ok) {
      await queueRequest({
        url,
        method,
        headers: (options.headers as any) || {},
        body: options.body,
      });

      await triggerSync();

      return new Response(JSON.stringify({ queued: true, status: res.status }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }

    return res;
  } catch {
    if (write) {
      await queueRequest({
        url,
        method,
        headers: (options.headers as any) || {},
        body: options.body,
      });

      await triggerSync();

      return new Response(JSON.stringify({ queued: true }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
