## Diagnosis

Both `/trades` and `/trades/$tradeSlug` already live OUTSIDE the protected route group — they use `createFileRoute("/trades")` / `createFileRoute("/trades/$tradeSlug")`, and each page renders inside `<MarketingShell>`. The redirect-to-login isn't coming from a route guard.

The actual gate is in `src/routes/__root.tsx`:

- Line 153: `PUBLIC_ROUTES = new Set([..., "/trades", ...])`
- Line 156: `isPublicPath` does `PUBLIC_ROUTES.has(path)` — **exact string match**.

So `/trades` is public but `/trades/plumbers` is not, and `AuthGate` (line 169) navigates it to `/auth`. The same string-match issue affects chrome selection: `MARKETING_PATHS.has(path)` on line 122 only matches `/trades` exactly, so `/trades/plumbers` would also flip `showAppChrome = true` and render the in-app `<BottomNav />` over a marketing page.

## Change (single file: `src/routes/__root.tsx`, copy-only — no layout/logic restructuring)

Update both helpers so `/trades` and any `/trades/...` child are treated as public marketing routes.

### 1. `isPublicPath` (line 155–157)

```ts
function isPublicPath(path: string) {
  return (
    PUBLIC_ROUTES.has(path) ||
    path.startsWith("/trades") ||
    path.startsWith("/portal/") ||
    path.startsWith("/request/")
  );
}
```

`startsWith("/trades")` covers `/trades`, `/trades/plumbers`, `/trades/electricians`, etc. It does not match unrelated paths like `/trading` because there is no such route.

### 2. `isMarketing` (line 122)

```ts
const isMarketing =
  MARKETING_PATHS.has(path) || path.startsWith("/trades/");
```

Trailing slash here so the bare `/trades` keeps using the existing exact-match entry and any child `/trades/$slug` is also treated as marketing — i.e. `showAppChrome` stays `false`, so the in-app `<BottomNav />` does not render over the trade detail page.

## What's preserved

- Per-trade `head()` (title, description, og:url, canonical) on `/trades/$tradeSlug` — already set, not touched.
- `MarketingShell` rendering inside each page — already there, not touched.
- All existing route files, route group, and SEO metadata — untouched.
- `/trades` exact-match entries in `PUBLIC_ROUTES` and `MARKETING_PATHS` — left as-is; the new `startsWith` checks layer on top.

## Verification after build

- Logged out, hit `/trades/plumbers` → renders the plumbers page directly, no redirect to `/auth`.
- Logged out, hit `/trades` → still renders the listing (unchanged).
- View source → `<title>`, meta description, canonical, og:url are the per-trade tags from the existing `head()`.
- No `<BottomNav />` shown on the trade detail page.

## Out of scope

- Sitemap, robots.txt, internal links between trades, or any SEO copy changes — not requested.
