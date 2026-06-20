# Fix: trade pages don't navigate

## Root cause

`src/routes/trades.tsx` is the parent of `src/routes/trades.$tradeSlug.tsx` in the file-based route tree. In TanStack Router, when a parent has children, its component MUST render `<Outlet />` for the child to appear. Today, `trades.tsx` renders the trade list (`<TradesPage />`) with no `<Outlet />`, so:

- Clicking a card DOES update the URL to `/trades/plumbers`
- The `$tradeSlug` route DOES match
- But the parent has no outlet, so nothing visibly changes — the list keeps rendering

This is the documented "page is empty after navigation but URL is correct" symptom for layout routes (we just see the parent body instead of an empty page because the parent kept its old body).

## Fix

Convert `trades.tsx` into a pure layout and move the trade list into a new `trades.index.tsx` leaf.

1. **Create `src/routes/trades.index.tsx**` — move the entire current `TradesPage` body and its `head()` metadata here. Route declared as `createFileRoute("/trades/")`.
2. **Rewrite `src/routes/trades.tsx**` as a minimal layout:
  ```tsx
   import { createFileRoute, Outlet } from "@tanstack/react-router";
   export const Route = createFileRoute("/trades")({
     component: () => <Outlet />,
   });
  ```
   No `head()` here — the index leaf and `$tradeSlug` leaf each own their own SEO.
3. Let the TanStack Router Vite plugin regenerate `routeTree.gen.ts` on next dev/build (do not hand-edit it).

## Verification

After the change, drive Playwright against the live preview:

- Open `/trades`, screenshot — list still renders (now via `trades.index.tsx`)
- Click the "Plumbers" link, wait for navigation, screenshot — URL is `/trades/plumbers` and the trade detail hero ("For plumbers") is visible
- Confirm no console errors

No other files need changes. Trade data, `trades.$tradeSlug.tsx`, and the `<Link to="/trades/$tradeSlug" params={...}>` call sites are all correct.

**the SEO head tags must survive the move.** The fix correctly moves `head()` metadata into `trades.index.tsx` and keeps the per-trade `head()` in `$tradeSlug.tsx`. Just confirm after it's applied that:

- `/trades` still has its listing-page title/description (now from the index leaf)
- each `/trades/plumbers` etc. still has its distinct SEO title and the FAQ JSON-LD