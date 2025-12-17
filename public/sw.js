// public/sw.js
const CACHE_NAME = "hive-cache-v1";
const URLS_TO_CACHE = ["/", "/favicon.ico"];

/* -------------------------
   INSTALL / ACTIVATE
-------------------------- */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* -------------------------
   FETCH
   - never cache /api/*
-------------------------- */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // never cache API calls
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      caches.match(req).then((cached) => {
        return (
          cached ||
          fetch(req)
            .then((res) => caches.open(CACHE_NAME).then((cache) => (cache.put(req, res.clone()), res)))
            .catch(() => caches.match("/"))
        );
      })
    );
    return;
  }

  if (req.method === "GET") {
    event.respondWith(
      caches.match(req).then((cached) => {
        return (
          cached ||
          fetch(req)
            .then((res) => caches.open(CACHE_NAME).then((cache) => (cache.put(req, res.clone()), res)))
            .catch(() => cached)
        );
      })
    );
  }
});

/* -------------------------
   BACKGROUND SYNC
-------------------------- */
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-pending") {
    event.waitUntil(runSync());
  }
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "sync-pending") {
    event.waitUntil(runSync());
  }
});

async function runSync() {
  await postToAllClients({ type: "sync-start" });

  try {
    const items = await readAllPending();
    for (const item of items) {
      try {
        const init = buildFetchInit(item);
        const res = await fetch(item.url, init);

        if (res && res.ok) {
          await deletePending(item.id);
        }
      } catch (e) {
        // keep it
      }
    }

    await postToAllClients({ type: "sync-complete" });
  } catch (err) {
    await postToAllClients({ type: "sync-error", error: String(err) });
  }
}

function buildFetchInit(item) {
  const method = (item.method || "POST").toUpperCase();
  const headers = item.headers || {};
  const bodyType = item.bodyType || "json";

  const base = {
    method,
    credentials: "include",
    cache: "no-store",
  };

  if (bodyType === "json") {
    return {
      ...base,
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(item.body ?? {}),
    };
  }

  if (bodyType === "text") {
    return {
      ...base,
      headers: { "Content-Type": "text/plain", ...headers },
      body: String(item.body ?? ""),
    };
  }

  if (bodyType === "formdata-base64") {
    const fd = new FormData();
    const fields = (item.body && item.body.fields) || {};
    const files = (item.body && item.body.files) || [];

    Object.entries(fields).forEach(([k, v]) => fd.append(k, String(v)));

    for (const f of files) {
      const bytes = base64ToUint8Array(f.base64);
      const blob = new Blob([bytes], { type: f.type || "application/octet-stream" });
      fd.append(f.field || "file", blob, f.name || "file");
    }

    return { ...base, headers: { ...headers }, body: fd };
  }

  return {
    ...base,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(item.body ?? {}),
  };
}

async function postToAllClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  for (const c of clients) c.postMessage(message);
}

/* -------------------------
   IndexedDB (same db/store)
-------------------------- */
const DB_NAME = "hive-db";
const DB_VERSION = 1;
const STORE_NAME = "pending";

function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("by-createdAt", "createdAt");
        store.createIndex("by-url", "url");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readAllPending() {
  return openIDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);

        // Prefer index ordering if exists
        const index = store.indexNames.contains("by-createdAt") ? store.index("by-createdAt") : null;
        const req = index ? index.getAll() : store.getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      })
  );
}

function deletePending(id) {
  return openIDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      })
  );
}

function base64ToUint8Array(base64) {
  const binary = atob(base64 || "");
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
