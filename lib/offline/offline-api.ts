"use client";

import { browserOnlineFlag, hasServer } from "@/lib/offline/connectivity";
import { emitQueueChanged, emitStatusChanged } from "@/lib/offline/offline-events";

import { queueRequest } from "@/lib/offline/offline-queue";

function notifyQueued() {
  emitQueueChanged();
  emitStatusChanged();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => reg.active?.postMessage({ type: "sync-pending" }))
      .catch(() => {});
  }
}

async function shouldQueueWrite(): Promise<boolean> {
  if (!browserOnlineFlag()) return true;
  const srvOk = await hasServer(1200);
  return !srvOk;
}

export async function offlineFetch(url: string, options: RequestInit = {}) {
  const method = (options.method || "GET").toUpperCase();
  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  if (!isWrite) {
    return fetch(url, { ...options, credentials: "include", cache: "no-store" });
  }

  const queue = await shouldQueueWrite();

  if (queue) {
    await queueRequest({
      url,
      method,
      headers: ((options.headers as any) || {}) as Record<string, string>,
      body: options.body,
    });

    notifyQueued();

    return new Response(JSON.stringify({ queued: true }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch(url, {
      ...options,
      method,
      credentials: "include",
      cache: "no-store",
    });

    if (res.ok) return res;

    if (res.status >= 500) {
      await queueRequest({
        url,
        method,
        headers: ((options.headers as any) || {}) as Record<string, string>,
        body: options.body,
      });

      notifyQueued();

      return new Response(JSON.stringify({ queued: true }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }

    return res;
  } catch {
    await queueRequest({
      url,
      method,
      headers: ((options.headers as any) || {}) as Record<string, string>,
      body: options.body,
    });

    notifyQueued();

    return new Response(JSON.stringify({ queued: true }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }
}
