# Alignment, Spacing & Responsive Audit

Goal: tighten visual rhythm so every screen uses the same gutter, vertical spacing, and header alignment, and behaves correctly from a 320px phone up to desktop.

## Scope

App shell + every authenticated route rendered inside `AppShell` (mobile-first, `max-w-md`), plus marketing routes rendered inside `MarketingShell` (desktop-capable). Portal and invoice public routes included.

## 1. Establish spacing + container tokens

Add a small set of layout primitives in `src/styles.css` so we stop re-inventing paddings per page:

- `--gutter-x` (16px mobile, 20px ≥sm, 24px ≥md) — used by a new `.page-x` utility (`padding-inline: var(--gutter-x)`)
- `.page-y` — `padding-block` rhythm for top of route content (20/24/28)
- `.stack-sm / .stack-md / .stack-lg` — vertical gap helpers (12 / 20 / 32) for sections inside a page
- `.row-between` — `flex items-center justify-between gap-3` (kills the dozens of ad-hoc copies)
- Confirm `pb-nav` clearance still matches the new bottom nav height (68 + 8 + 12 = 88px + safe area)

These are additive; existing classes keep working.

## 2. AppShell + PageHeader alignment fixes

- `AppShell` switches its inner container to `max-w-md md:max-w-lg lg:max-w-xl` so tablet/desktop don't feel cramped, and applies `page-x` so every child route inherits the same gutter (remove per-route `px-4`/`px-5` duplication where it now double-pads).
- `PageHeader` horizontal padding aligns with `--gutter-x` (currently 20px expanded / 16px condensed — keep condensed=16, expand=gutter so header edge matches body edge exactly).
- Action pill, back button, and title use a single grid row (`grid-cols-[auto_minmax(0,1fr)_auto]`) so long titles truncate without pushing the action off-screen on 320px widths (current `flex` + `min-w-0` works but action wraps below on narrow screens with long subtitles).
- Subtitle and crumb row inherit the same left edge as the title (currently offset by back-button width on some routes).

## 3. Per-route audit + normalisation

Walk every route file and:

- Replace ad-hoc `px-4 / px-5 / px-6` page padding with `page-x`.
- Replace ad-hoc `space-y-3 / space-y-4 / space-y-6` section gaps with `stack-sm/md/lg`.
- Standardise card internal padding to `p-4 sm:p-5` (currently mixes `p-3`, `p-4`, `p-5`, `p-6`).
- Standardise section header rows to `.row-between` with a `t-eyebrow` label on the left and a single action on the right.
- Ensure every header row containing text + widget follows the `grid-cols-[minmax(0,1fr)_auto] sm:flex` pattern from the responsive-layout rule (fixes truncation on `/quotes/$quoteId`, `/clients/$clientId`, `/invoices/$quoteId`, `/portal/$token`).

Routes covered:
`app`, `quotes.index`, `quotes.$quoteId`, `quotes.new`, `clients.index`, `clients.$clientId`, `clients.new`, `messages`, `chaser`, `settings`, `notifications`, `invoices.$quoteId`, `portal.$token`, `portal.c.$code`, `request.$proId`, `confirmed`, `onboarding`, `welcome`, `auth`, `forgot-password`, `reset-password`.

## 4. Marketing + public pages responsive pass

For `index`, `pricing`, `features`, `about`, `faqs`, `privacy`, `terms`, `trades.index`, `trades.$tradeSlug`, `merch`:

- Confirm hero and section paddings scale `py-12 sm:py-16 md:py-24`.
- Confirm grids use `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (not fixed multi-column on mobile).
- Confirm long headlines wrap (`text-balance`) and CTAs stack on <640px.

## 5. Bottom nav + floating UI clearance

- Verify `pb-nav` value matches current nav height (68 + paddings) — update token if off.
- `PWAInstallBanner`, `UpdateBanner`, `OfflineBanner`, `TrialBanner`, `CookieBanner` all use `.bottom-nav` for their `bottom` value so they sit above the nav consistently.
- Toast (`sonner`) offset bumped so it doesn't overlap the nav on mobile.

## 6. Device verification

Drive Playwright at three viewports against the running dev server and screenshot the key routes:

- 360×740 (small Android)
- 414×896 (iPhone)
- 1280×1800 (desktop already used by harness)

Routes captured: `/app`, `/quotes`, `/quotes/$id` (mock), `/clients`, `/settings`, `/messages`, `/`, `/pricing`. Compare gutters, header alignment, card padding, and bottom-nav clearance across the three widths and fix any remaining outliers before finishing.

## Out of scope

- Color, typography, status legend (already shipped in prior turns).
- Copy changes.
- New features or route additions.
- Backend / data changes.

## Technical notes

- All changes are CSS + JSX className edits — no logic, no schema, no server code.
- New utilities defined with `@utility` (Tailwind v4), tokens with CSS custom properties under `:root`. No `tailwind.config.js`.
- No component API changes: `AppShell`, `PageHeader`, `Card` keep current props.
