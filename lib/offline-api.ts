// lib/offline-api.ts
"use client";

export async function offlineFetch(
  url: string,
  options: RequestInit = {}
) {
  if (typeof navigator !== "undefined" && navigator.onLine) {
    return fetch(url, options);
  }

  await saveRequest(url, options);

  return new Response(
    JSON.stringify({ offline: true }),
    {
      headers: { "Content-Type": "application/json" },
      status: 202,
    }
  );
}

/* -------------------------
   IndexedDB helpers
   ------------------------- */

const DB_NAME = "hive-db";
const STORE_NAME = "pending";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveRequest(url: string, options: RequestInit) {
  const db = await openDB();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    store.add({
      url,
      method: options.method || "POST",
      payload: options.body ? JSON.parse(options.body as string) : null,
      timestamp: Date.now(),
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // 🔥 IMPORTANT: Tell Service Worker to sync
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.ready;

    if ("SyncManager" in window) {
      await reg.sync.register("sync-pending");
    } else {
      // fallback for browsers without background sync
      reg.active?.postMessage({ type: "sync-pending" });
    }
  }
}
