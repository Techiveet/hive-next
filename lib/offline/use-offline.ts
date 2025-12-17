// lib/offline/use-offline.ts
"use client";

import { hasInternet, hasServer } from "@/lib/offline/connectivity";
import { listPending, pendingCount, removePending } from "@/lib/offline/offline-queue";
import { useEffect, useRef, useState } from "react";

import type { PendingItem } from "@/lib/offline/offline-db";

function base64ToUint8Array(base64: string) {
  const binary = atob(base64 || "");
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function buildRequest(item: PendingItem) {
  const method = item.method || "POST";
  const headers = item.headers || {};

  if (item.bodyType === "json") {
    return {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(item.body ?? {}),
    };
  }

  if (item.bodyType === "text") {
    return {
      method,
      headers: { "Content-Type": "text/plain", ...headers },
      body: String(item.body ?? ""),
    };
  }

  // formdata-base64
  const fd = new FormData();
  const { fields, files } = (item.body || {}) as {
    fields: Record<string, string>;
    files: Array<{ field: string; name: string; type: string; base64: string }>;
  };

  Object.entries(fields || {}).forEach(([k, v]) => fd.append(k, String(v)));

  for (const f of files || []) {
    const bytes = base64ToUint8Array(f.base64);
    fd.append(f.field || "file", new Blob([bytes], { type: f.type }), f.name);
  }

  // don't set content-type for formdata
  return { method, headers: { ...headers }, body: fd };
}

export function useOffline() {
  const [netOk, setNetOk] = useState(true);
  const [srvOk, setSrvOk] = useState(true);
  const [pending, setPending] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const lockRef = useRef(false);

  const isOnline = netOk && srvOk;

  async function refreshPending() {
    setPending(await pendingCount());
  }

  async function refreshStatus() {
    if (lockRef.current) return;
    lockRef.current = true;

    try {
      const [a, b] = await Promise.all([hasInternet(), hasServer()]);
      setNetOk(a);
      setSrvOk(b);
    } finally {
      lockRef.current = false;
    }
  }

  async function syncOfflineData() {
    await refreshStatus();
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);

    try {
      const items = await listPending();

      for (const item of items) {
        try {
          const req = buildRequest(item as PendingItem);
          const res = await fetch(item.url, {
            ...req,
            credentials: "include",
            cache: "no-store",
          });

          if (res.ok) {
            await removePending(item.id!);
          }
        } catch {
          // keep it for retry
        }
      }
    } finally {
      await refreshPending();
      setIsSyncing(false);
    }
  }

  useEffect(() => {
    refreshStatus();
    refreshPending();

    const onOnline = async () => {
      await refreshStatus();
      if (isOnline) await syncOfflineData();
    };

    const onOffline = () => {
      setNetOk(false);
      setSrvOk(false);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const interval = setInterval(() => {
      refreshStatus();
    }, 4000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isOnline,
    hasInternet: netOk,
    hasServer: srvOk,
    pending,
    isSyncing,
    syncOfflineData,
  };
}
