## What I found

Audited every file in `src/routes/`. The bottom nav is not rendered by `AppShell` — it's rendered globally in `src/routes/__root.tsx` based on path checks. All authenticated app routes (`/app`, `/quotes*`, `/clients*`, `/chaser`, `/messages`, `/notifications`, `/settings`, `/invoices/*`) correctly show the nav. All marketing/portal/auth pages correctly hide it.

Two real bugs, both rooted in `src/routes/__root.tsx`:

### Bug 1 — `/terms` and `/privacy` show the bottom nav
`MARKETING_PATHS` (~line 118) lists `/`, `/welcome`, `/pricing`, `/about`, `/features`, `/faqs`, `/trades`, `/merch` — but not `/terms` or `/privacy`. Both pages use `MarketingShell`, so the bottom app nav overlays the footer/content. Bug.

### Bug 2 — `/terms` and `/privacy` bounce unauthenticated visitors to `/auth`
`PUBLIC_ROUTES` (~line 154), used by `AuthGate` to decide whether to redirect, also omits these two paths. Anyone not signed in who follows a "Terms" / "Privacy" link from the footer gets kicked to `/auth`. Bug.

## Changes

Single file: `src/routes/__root.tsx`.

1. Add `"/terms"` and `"/privacy"` to the `MARKETING_PATHS` set so `showAppChrome` evaluates to `false` and `BottomNav` doesn't render on them.
2. Add `"/terms"` and `"/privacy"` to the `PUBLIC_ROUTES` set so `AuthGate` lets unauthenticated visitors view them.

No other route files need to change. No component logic changes. No edits to `BottomNav.tsx` or `AppShell.tsx`.

## Out of scope

- `/quotes/new` intentionally hides the nav for its full-screen flow (handled inside `BottomNav.tsx`) — leaving as-is.
- `AppShell` keeps `pb-nav` padding on `/quotes/new` even though the nav is hidden; cosmetic, not part of this fix.
- No console/runtime errors related to nav rendering were found in the recent logs.

## Verification after the fix

- Visit `/terms` and `/privacy` signed out → page renders, no redirect, no bottom nav.
- Visit `/terms` and `/privacy` signed in → still no bottom nav (marketing page).
- Spot-check `/app`, `/quotes`, `/clients`, `/chaser`, `/messages`, `/notifications`, `/settings` → bottom nav still present.
