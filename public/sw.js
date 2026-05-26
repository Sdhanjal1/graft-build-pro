/* Quottr service worker: versioned shell cache + push. */
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_PREFIX = "quottr-cache-";
const CACHE_NAME = CACHE_PREFIX + VERSION;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((n) => n.startsWith(CACHE_PREFIX) && n !== CACHE_NAME)
        .map((n) => caches.delete(n))
    );
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of clients) {
      try { c.postMessage({ type: "QUOTTR_SW_ACTIVATED", version: VERSION }); } catch {}
    }
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.mode !== "navigate") return;
  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      try {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
      } catch {}
      return fresh;
    } catch (err) {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      throw err;
    }
  })());
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: event.data?.text?.() || "" }; }
  const title = data.title || "New activity in Quottr";
  const body = data.body || "Tap to open Quottr.";
  const url = data.url || "/messages";
  const tag = data.tag || "quottr-notification";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "/app-icon.png",
      badge: "/app-icon.png",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/messages";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      try {
        const u = new URL(c.url);
        if (u.origin === self.location.origin) {
          await c.focus();
          c.navigate(url);
          return;
        }
      } catch {}
    }
    await self.clients.openWindow(url);
  })());
});
