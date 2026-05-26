## Problem

When Quottr is installed to the iOS/Android home screen, users keep seeing the old build after a new deploy. Today:

- `public/sw.js` only handles push notifications — there is no cache, no version, no update flow.
- The SW is only registered when a user opts into push from `CustomerQRCard`, so most installs have no SW at all and rely solely on the browser's HTTP cache. There is nothing to evict that cache or tell the page "a new build is live".
- There is no UI to prompt the user to refresh.

Result: home-screen launches keep serving stale HTML/JS until the user manually deletes and reinstalls.

## Goal

1. Every deploy gets a unique version string baked into the SW.
2. The SW activates immediately (`skipWaiting` + `clients.claim`) and deletes old caches.
3. The app eagerly registers the SW on every launch (except in the Lovable editor preview / iframes) and checks for an update each time the window regains focus.
4. When a newer SW is waiting, show a small bottom "Update available — Refresh" banner. Tapping it tells the waiting SW to take over and reloads the page. If the user ignores it, the next cold launch will pick up the new build automatically.

## Approach

### Build-time version string

Inject a `__APP_VERSION__` constant at build time via Vite `define` in `vite.config.ts` (set to `JSON.stringify(String(Date.now()))`). This gives a new value on every build without any extra build step.

Because Vite does not transform files in `public/`, we make the SW URL itself carry the version: register `/sw.js?v=${__APP_VERSION__}`. A changed search string is a different SW script URL to the browser, so it installs the new worker. The SW reads its own `location.search` to derive `CACHE_VERSION = 'quottr-cache-v' + version`.

### Service worker (`public/sw.js`)

Replace the file with a SW that keeps the existing push/notification handlers and adds:

- `CACHE_VERSION` read from `new URL(self.location.href).searchParams.get('v')` (fallback `'dev'`).
- `install`: `self.skipWaiting()` (unchanged behaviour).
- `activate`: delete every cache whose name starts with `quottr-cache-` and does not match the current version, then `clients.claim()`, then `postMessage({ type: 'QUOTTR_SW_ACTIVATED', version })` to all clients.
- `fetch`: NetworkFirst for navigation requests (`request.mode === 'navigate'`) — try network, on success clone into the versioned cache, on failure fall back to the cached response. All other requests pass through untouched (no caching of API/auth/data).
- `message`: on `{ type: 'SKIP_WAITING' }` call `self.skipWaiting()` so the update banner can promote a waiting worker on demand.

Keep the existing `push` and `notificationclick` handlers exactly as they are.

### Registration + update detection

New module `src/lib/sw-register.ts`:

- Exported `registerServiceWorker()` that:
  - No-ops on the server, in iframes (`window.self !== window.top`), or on Lovable preview hosts (`id-preview--*`, `lovableproject.com`). This matches the existing guard pattern used elsewhere in the codebase.
  - Calls `navigator.serviceWorker.register(`/sw.js?v=${__APP_VERSION__}`, { updateViaCache: 'none', scope: '/' })`.
  - Wires `registration.onupdatefound` → watches the installing worker; when it reaches `installed` AND `navigator.serviceWorker.controller` exists, dispatches a `quottr:sw-update-ready` `CustomEvent` on `window` with the registration in `detail`.
  - On `visibilitychange` (`document.visibilityState === 'visible'`) and on `focus`, calls `registration.update()`.
  - Listens for `controllerchange` once — on the first event after the user accepts the update, `window.location.reload()`.

Call `registerServiceWorker()` from `RootComponent` in `src/routes/__root.tsx` inside a `useEffect`, so it runs after hydration on every route.

Add the ambient declaration `declare const __APP_VERSION__: string;` in a small `src/lib/sw-register.ts` (or extend `src/vite-env.d.ts` if it exists) so TypeScript is happy.

### Update banner

New component `src/components/UpdateBanner.tsx`:

- Local state `waiting: ServiceWorker | null`.
- On mount, listens for `quottr:sw-update-ready` and stores `event.detail.waiting`. Also checks `navigator.serviceWorker.getRegistration()` once at mount in case a worker is already waiting from a previous session.
- Renders nothing when `waiting` is null.
- When set, renders a compact bottom banner styled to match `PWAInstallBanner` (rounded-2xl, `bg-ink text-paper`, lime "Refresh" pill, dismiss "✕") with copy: "A new version of Quottr is ready." + "Refresh" button.
- Refresh handler: `waiting.postMessage({ type: 'SKIP_WAITING' })`. The `controllerchange` listener in `sw-register.ts` handles the reload.
- Dismiss handler: clear local state (no persistent suppression — the next launch's `update()` will resurface it if still pending).

Wire it into `BannerSlot.tsx` at the highest priority so it preempts PWA / trial / offline banners.

### Files touched

```text
public/sw.js                       rewrite — versioned cache, activate cleanup, NetworkFirst nav, SKIP_WAITING handler, keep push
vite.config.ts                     add define: { __APP_VERSION__: JSON.stringify(String(Date.now())) }
src/lib/sw-register.ts             new — guarded registration, update polling, controllerchange reload, custom event
src/components/UpdateBanner.tsx    new — bottom banner with Refresh / dismiss
src/components/BannerSlot.tsx      render UpdateBanner first; existing priority unchanged below it
src/routes/__root.tsx              call registerServiceWorker() from RootComponent useEffect
```

No changes to `CustomerQRCard` push registration — it will reuse the already-registered SW instead of registering its own.

## Verification

- After deploy, open the installed PWA: within a few seconds (or on next focus) the banner appears; tapping Refresh loads the new build.
- Cold launch with banner ignored from a previous session: app loads the new build directly because the waiting worker was promoted on `clients.claim` after `SKIP_WAITING`, and the navigation falls through to the network.
- Editor preview and iframe: `registerServiceWorker()` early-returns; no SW is installed, no banner shown.
- Push notifications: existing `push` / `notificationclick` handlers preserved verbatim, so opt-in flow in `CustomerQRCard` continues to work.
