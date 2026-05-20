/* Quottr push service worker. Kept minimal — no caching of app shell. */
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });

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
