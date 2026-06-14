## Problem

`AppShell` sets `pb-24` (96px) on the scroll container, but `BottomNav` is a fixed glass pill ≈ 84px tall **plus** iOS's home-indicator safe-area inset (≈ 34px). On iPhone the nav becomes ~118px, so the final section of each page — most visibly the "Take card payments" Stripe banner on `/app` — sits under the nav.

The fix is one structural change (replace `pb-24` with a clearance that includes the safe-area inset) and a sweep of every other fixed/sticky bottom element to make sure it sits **above** the nav, not behind it.

## Changes

### 1. `src/styles.css` — introduce a nav-clearance token

Add a CSS variable that always equals `nav height + safe-area inset + breathing room`:

```css
:root {
  --bottom-nav-clearance: calc(96px + env(safe-area-inset-bottom, 0px));
}
```

And a utility:

```css
.pb-nav { padding-bottom: var(--bottom-nav-clearance); }
.bottom-nav { bottom: var(--bottom-nav-clearance); }
```

### 2. `src/components/AppShell.tsx`

Replace `pb-24 safe-bottom` on the main container with `pb-nav` (the new utility already accounts for the safe-area inset, so the duplicate `safe-bottom` can go).

### 3. Audit every fixed/sticky bottom element

| File | Current | Fix |
|---|---|---|
| `src/routes/quotes.new.tsx` | `fixed inset-x-0 bottom-0 … safe-bottom` — nav is hidden on this route, so already fine | leave as is |
| `src/routes/request.$proId.tsx` | `fixed bottom-0 … safe-bottom` action bar; no `BottomNav` on this route (unauth) | leave as is |
| `src/routes/portal.$token.tsx` | `fixed bottom-0 … safe-bottom`; portal route — `BottomNav` hidden | leave as is |
| `src/components/PWAInstallBanner.tsx` | `fixed bottom-24` (96px hard-coded) | change to `bottom-nav` utility so it sits above the nav on iOS too |
| `src/components/UpdateBanner.tsx` | `fixed bottom-24` | same — switch to `bottom-nav` |
| `src/components/CookieBanner.tsx` | `fixed bottom-0` on marketing pages (no `BottomNav`) | leave as is |
| `src/components/ui/sonner.tsx` | now `top-center` | leave as is |

### 4. Verify on every in-app route

After the change, visit each `BottomNav`-visible route and confirm the last element clears the nav on a 390×844 (iPhone) viewport:

- `/app` — Stripe "Take card payments" banner (the original report)
- `/quotes` — last paid quote card in the list
- `/messages` — last message row
- `/chaser` — Auto-chase queue tail
- `/settings` — final "Sign out" / billing row
- `/clients` — final client row
- `/clients/$id`, `/quotes/$id`, `/invoices/$id` — bottom action / footer

## Out of scope

- No visual restyle of the nav itself.
- No layout changes to portal / marketing / auth routes (they don't render `BottomNav`).
- No content changes to the Stripe banner — only its clearance.
