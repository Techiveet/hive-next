"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { browserOnlineFlag, hasServer } from "@/lib/offline/connectivity";
import { listPending, pendingCount, removePending } from "@/lib/offline/offline-queue";
import { getOfflineDB, type PendingItem } from "@/lib/offline/offline-db";
import { onQueueChanged, onStatusChanged } from "@/lib/offline/offline-events";

function base64ToUint8Array(base64: string) {
  const binary = atob(base64 || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function buildRequest(item: PendingItem): RequestInit {
  const method = (item.method || "POST").toUpperCase();
  const headers = { ...(item.headers || {}) };

  if (item.bodyType === "json") {
    return { method, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(item.body ?? {}) };
  }

  if (item.bodyType === "text") {
    return { method, headers: { "Content-Type": "text/plain", ...headers }, body: String(item.body ?? "") };
  }

  const fd = new FormData();
  const payload = (item.body || {}) as {
    fields?: Record<string, string>;
    files?: Array<{ field: string; name: string; type: string; base64: string }>;
  };

  Object.entries(payload.fields || {}).forEach(([k, v]) => fd.append(k, String(v)));

  for (const f of payload.files || []) {
    const bytes = base64ToUint8Array(f.base64);
    fd.append(f.field || "file", new Blob([bytes], { type: f.type }), f.name);
  }

  return { method, headers, body: fd };
}

export function useOffline() {
  const [netOk, setNetOk] = useState<boolean>(true);
  const [srvOk, setSrvOk] = useState<boolean>(true);
  const [pending, setPending] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const mountedRef = useRef(false);
  const syncLock = useRef(false);

  const isOnline = useMemo(() => netOk && srvOk, [netOk, srvOk]);

  const refreshPending = useCallback(async () => {
    const c = await pendingCount();
    if (mountedRef.current) setPending(c);
    return c;
  }, []);

  const refreshStatus = useCallback(async () => {
    const browserOk = browserOnlineFlag();
    if (mountedRef.current) setNetOk(browserOk);

    const srv = await hasServer(1200);
    if (mountedRef.current) setSrvOk(srv);

    // ✅ if server is unreachable, we are effectively offline even if browser says "online"
    if (!srv && mountedRef.current) setNetOk(false);

    return { net: browserOk && srv, srv };
  }, []);

  const setOfflineInstant = useCallback(() => {
    if (!mountedRef.current) return;
    setNetOk(false);
    setSrvOk(false);
  }, []);

  const syncOfflineData = useCallback(
    async (force = false) => {
      if (syncLock.current && !force) return { synced: 0, failed: 0, skipped: true };
      syncLock.current = true;

      if (!mountedRef.current) return { synced: 0, failed: 0, skipped: true };

      setIsSyncing(true);

      try {
        const { net, srv } = await refreshStatus();
        if (!(net && srv)) return { synced: 0, failed: 0 };

        const items = await listPending();
        if (items.length === 0) {
          await refreshPending();
          return { synced: 0, failed: 0 };
        }

        let synced = 0;
        let failed = 0;

        const db = await getOfflineDB();

        for (const raw of items) {
          const item = raw as PendingItem;

          try {
            const req = buildRequest(item);
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 10000);

            const res = await fetch(item.url, {
              ...req,
              credentials: "include",
              cache: "no-store",
              signal: controller.signal,
            });

            clearTimeout(t);

            if (res.ok) {
              await removePending(item.id!);
              synced++;
              continue;
            }

            failed++;

            // 5xx => keep for retry
            if (res.status >= 500) {
              await db.put("pending", { ...item, retryCount: (item.retryCount || 0) + 1 });
              continue;
            }

            // 4xx => drop (won’t succeed later)
            await removePending(item.id!);
          } catch {
            failed++;
            setOfflineInstant();
            await db.put("pending", { ...item, retryCount: (item.retryCount || 0) + 1 });
            break;
          }
        }

        await refreshPending();
        return { synced, failed };
      } finally {
        if (mountedRef.current) setIsSyncing(false);
        syncLock.current = false;
      }
    },
    [refreshPending, refreshStatus, setOfflineInstant]
  );

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      await refreshPending();
      await refreshStatus();
    })();

    const onOffline = () => setOfflineInstant();
    const onOnline = async () => {
      const { net, srv } = await refreshStatus();
      if (net && srv) void syncOfflineData(false);
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    // ✅ Listen to SW messages net-offline / net-online
    const onSW = (event: MessageEvent) => {
      const type = event.data?.type;
      if (type === "net-offline") setOfflineInstant();
      if (type === "net-online") void onOnline();
      if (type === "trigger-sync") void syncOfflineData(true);
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSW);
    }

    // ✅ Event bus
    const offQueue = onQueueChanged(() => void refreshPending());
    const offStatus = onStatusChanged(() => void refreshStatus());

    // ✅ Active SW ping: detects wifi off even if no requests happen
    const ping = setInterval(() => {
      if (!("serviceWorker" in navigator)) return;
      navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage({ type: "check-connection" }))
        .catch(() => {});
    }, 3000);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSW);
      }
      offQueue();
      offStatus();
      clearInterval(ping);
    };
  }, [refreshPending, refreshStatus, setOfflineInstant, syncOfflineData]);

  return {
    isOnline,
    hasInternet: netOk,
    hasServer: srvOk,
    pending,
    isSyncing,
    syncOfflineData,
    refreshStatus,
  };
}
