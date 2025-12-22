// public/sw.js
const CACHE_NAME = "hive-v4";
const ASSETS = ["/", "/icon", "/manifest.json", "/offline.html"];
const SYNC_TAG = "sync-pending";

let lastNetState = "unknown";

async function broadcast(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach((c) => c.postMessage(msg));
}

function setNetState(next) {
  if (lastNetState === next) return;
  lastNetState = next;
  broadcast({ type: next === "offline" ? "net-offline" : "net-online" });
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      await self.skipWaiting();
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(ASSETS);
    })()
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      await self.clients.claim();
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    })()
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // ✅ API = NETWORK ONLY (NO CACHE), but we still track net state
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          setNetState(res.ok ? "online" : "offline");
          return res;
        })
        .catch(() => {
          setNetState("offline");
          return new Response(JSON.stringify({ ok: false, error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        })
    );
    return;
  }

  // HTML pages: network-first, fallback to cache/offline
  if (e.request.headers.get("accept")?.includes("text/html")) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          setNetState("online");
          return response;
        })
        .catch(async () => {
          setNetState("offline");
          const cached = await caches.match(e.request);
          return cached || (await caches.match("/offline.html")) || new Response("Offline", { status: 503 });
        })
    );
    return;
  }

  // Static assets: cache-first
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;

      return fetch(e.request)
        .then((response) => {
          setNetState("online");
          if (response.ok && e.request.method === "GET") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => {
          setNetState("offline");
          return new Response("", { status: 503, statusText: "Offline" });
        });
    })
  );
});

// Background sync trigger (keeps your behavior)
self.addEventListener("sync", (e) => {
  if (e.tag === SYNC_TAG) {
    e.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll({ includeUncontrolled: true });
        clients.forEach((client) => client.postMessage({ type: "trigger-sync" }));
      })()
    );
  }
});

self.addEventListener("message", async (e) => {
  const { type } = e.data || {};

  if (type === "sync-pending") {
    try {
      if ("sync" in self.registration) {
        await self.registration.sync.register(SYNC_TAG);
      } else {
        broadcast({ type: "trigger-sync" });
      }
    } catch {
      broadcast({ type: "trigger-sync" });
    }
  }

  // ✅ Force a real network probe (no cache, GET)
  if (type === "check-connection") {
    try {
      const res = await fetch(`/api/health?ts=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
      });

      setNetState(res.ok ? "online" : "offline");
    } catch {
      setNetState("offline");
    }
  }
});
