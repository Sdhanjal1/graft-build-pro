/* Quottr service worker: push notifications only. No HTML caching. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Evict every legacy cache from the pre-network-only worker.
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => n.startsWith("quottr-cache-")).map((n) => caches.delete(n)),
    );
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of clients) {
      try { c.postMessage({ type: "QUOTTR_SW_ACTIVATED" }); } catch {}
    }
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Intentionally no `fetch` handler — navigations and assets go straight to
// the network so deploys never serve stale HTML referencing dead JS chunks.

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
