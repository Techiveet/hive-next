// public/sw.js
const CACHE_NAME = "hive-cache-v1";
const URLS_TO_CACHE = [
  "/",
  "/favicon.ico",
  // Add other static routes you want cached immediately
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Basic cache-first for navigation and static assets; fallback to network for APIs (we handle API offline by storing requests)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  // For navigation (HTML), try cache then network
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match(req).then((cached) => {
        return cached || fetch(req).then((res) => {
          // Optionally cache the response
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, res.clone());
            return res;
          });
        }).catch(() => caches.match('/')); // fallback to root
      })
    );
    return;
  }

  // For other requests (css/js/images) serve from cache first
  if (req.method === "GET") {
    event.respondWith(
      caches.match(req).then((cached) => {
        return cached || fetch(req).then((res) => {
          // cache resources dynamically for GET
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, res.clone());
            return res;
          });
        }).catch(() => {
          // No network and no cache: respond with nothing (default)
          return cached;
        });
      })
    );
    return;
  }

  // For POST (and other non-GET) requests, just attempt network; if fails, respond with generic error (app will store locally)
  event.respondWith(
    fetch(req).catch(() => new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }))
  );
});

/* -------------------------
   Background sync handling
   -------------------------
   We'll handle a sync tag 'sync-pending' to trigger sending pending items.
   The SW will read from IndexedDB (object store "pending") and attempt to POST each entry to its saved URL.
   */
self.addEventListener("sync", function (event) {
  if (event.tag === "sync-pending") {
    event.waitUntil(syncPending());
  }
});
self.addEventListener('message', (event) => {
  const { data } = event;
  if (data && data.type === 'sync-pending') {
    // Attempt to sync now
    event.waitUntil(syncPending());
  }
});


async function syncPending() {
  try {
    const items = await readAllPending();
    for (const item of items) {
      try {
        await fetch(item.url, {
          method: item.method || "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(item.payload),
        });
        await deletePending(item.id);
      } catch (err) {
        // if a single item fails, keep it; we'll try again next time
        console.warn("Failed to sync item:", item, err);
      }
    }
  } catch (err) {
    console.error("syncPending error", err);
  }
}

/* -------------------------
   IndexedDB helpers (vanilla)
   ------------------------- */
const DB_NAME = "hive-db";
const DB_VERSION = 1;
const STORE_NAME = "pending";

function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

function readAllPending() {
  return openIDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

function deletePending(id) {
  return openIDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  }));
}
