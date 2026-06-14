# Visual polish pass — 12 items

Grouped so related edits happen in one file at a time. No business-logic changes; presentation-only.

## 1. Status chips — single source of truth
- Audit `src/routes/quotes.index.tsx`, `src/routes/chaser.tsx`, `src/routes/clients.$clientId.tsx`, `src/routes/invoices.$quoteId.tsx`, `src/routes/quotes.$quoteId.tsx` for inline badges built from `bg-status-*` + text.
- Replace each with `<StatusBadge status={...} />` so casing, radius, and tonal weight match.
- Where a one-off chip is needed (e.g. "Awaiting reply" count), extract a small `Chip` variant inside `StatusBadge.tsx` rather than re-rolling per screen.

## 2. Money typography
- Add `.num` (Bebas, tabular tracking) to every £ amount in list rows: quote cards (`quotes.index`), owed totals + chaser cards, invoice line items, client lifetime totals, settings preview.
- Keep `money-hero` only on the home `HeroNumber`.

## 3. Skeletons over spinners
- Replace full-screen `Loader2` blocks on `app.tsx`, `quotes.index.tsx`, `chaser.tsx`, `clients.index.tsx`, `messages.tsx` with shapes from `src/components/Skeletons.tsx`.
- Add a `QuoteCardSkeleton` and `OwedCardSkeleton` to `Skeletons.tsx` if missing.

## 4. Empty states sweep
- Find any remaining plain "No X yet" text in `quotes.index`, `clients.index`, `messages`, `invoices` list views.
- Replace with `<EmptyState>` (icon + body + optional CTA). Use `celebrate` tone where appropriate (e.g. "All caught up").

## 5. Card hierarchy — one focal per screen
- Demote everything currently using `card-focal` to `card-surface` by default.
- Promote exactly one element per screen back to `card-focal`:
  - `app.tsx` → hero number card
  - `chaser.tsx` → "You are owed" card
  - `quotes.$quoteId.tsx` → total/summary card
  - `clients.$clientId.tsx` → lifetime value card

## 6. Section headings rhythm
- Add small uppercase Bebas `h2`s above logical groups, matching the chaser pattern:
  - `quotes.index.tsx` → "Drafts", "Sent", "Paid"
  - `settings.tsx` → existing sections get a consistent heading style (already partially there; normalise sizing + tracking)
  - `clients.$clientId.tsx` → "Recent quotes", "Notes"
- Shared style: `text-xs uppercase tracking-[0.08em] text-muted-foreground` + Bebas via `font-display`.

## 7. Lime accent restraint
- Keep lime for: primary CTAs, `status-paid`, the home header blob, focus rings.
- Audit inner-page headers (`PageHeader` non-compact) and any decorative blurs on `settings`, `chaser`, `quotes.*`, `clients.*` — swap the lime blur to a soft paper/ink tint (`bg-ink/5` blob) so only home reads lime-forward.

## 8. Press feedback on rows
- Add `active:scale-[0.98] transition-transform` to interactive list rows:
  - Quote cards, chaser cards, client rows, invoice rows, message rows.
- Pair with `touch-manipulation` to keep taps snappy on iOS.

## 9. Row-rise on list mount
- Apply existing `.row-rise` utility to mapped list items in `quotes.index` and `chaser` (and `clients.index`).
- Stagger via `style={{ animationDelay: ``${i * 30}ms`` }}` capped at ~8 items so it doesn't drag.

## 10. Toast theming
- Check `src/components/ui/sonner.tsx` — set defaults to ink/paper with lime accent for success, status-overdue for error, matching the rest of the app.
- Verify position (`top-center` on mobile likely best given bottom nav).

## 11. Safe-area on bottom CTAs
- Sweep for sticky bottom bars / FABs / fixed CTAs across `quotes.new`, `quotes.$quoteId`, `invoices.$quoteId`, `portal.*`, `request.$proId`.
- Ensure each wrapping container uses `safe-bottom` (or `pb-[env(safe-area-inset-bottom)]`) so nothing collides with the iOS home indicator.

## 12. Header right-slot truncation
- Apply the responsive grid pattern to any header where business name + cog (or other widgets) co-exist:
  - Wrapper: `grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3`
  - Text container: `min-w-0`
  - Heading/business name: `truncate`
  - Icon button: `shrink-0`
- Specifically: `app.tsx` identity row (just rebuilt — verify), and any other `PageHeader` `right` slot usages with long titles.

---

## Order of execution

1. Shared primitives first: `StatusBadge.tsx`, `Skeletons.tsx`, `sonner.tsx`, `EmptyState.tsx` (verify), and `card-focal`/`card-surface` usage rule documented in `styles.css` as a comment.
2. Per-screen passes in this order: `app.tsx` → `chaser.tsx` → `quotes.index.tsx` → `quotes.$quoteId.tsx` → `clients.*` → `invoices.$quoteId.tsx` → `settings.tsx` → `messages.tsx` → portal/request public pages.
3. Final sweep: safe-area + lime restraint audit across all of the above.

## Out of scope
- Dark mode
- Framer Motion additions
- Any business logic, data shape, or route changes
- Marketing pages (`index.tsx`, `features`, `pricing`, `faqs`, `trades.*`) unless they share a touched component

## Acceptance
- Status chips look identical across every screen
- Every list/skeleton path shows shapes, not spinners
- Each screen has one focal card; the rest are flat surfaces
- Lime appears only on actions + paid status + home header
- No header text overlaps its right-slot widget at 320px width
- Bottom CTAs sit above the iOS home indicator on all forms
