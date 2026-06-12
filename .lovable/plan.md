## Pass 8: `quotes.index.tsx` polish

UI-only audit. No backend, no data-layer changes.

### 1. Hero pipeline strip
- Subtitle: replace static `"All work"` with a live single-line summary derived from tiles — e.g. `"3 pending · 2 awaiting · 1 overdue"`, falls back to `"All clear"`. Same pattern used on Messages/Clients.
- Inside lime hero: tighten the "awaiting / overdue" subline — break into two stacked `text-[11px]` rows with a status dot prefix (amber for awaiting, danger for overdue) instead of `·`-joined inline text. Easier to scan at 550px.
- Add a tiny `text-[10px]` label below the big number: `"Active pipeline value"` so the GBP figure has explicit meaning (currently unlabeled).

### 2. Overdue dominant tile
- Drop `motion-safe:animate-pulse-soft` — it draws constant attention even after the user has seen it. Replace with a single one-shot subtle entrance (`row-rise`) and a static danger dot next to the label.
- When active, swap the inverted ink background for a danger-tinted surface (`bg-status-overdue/10 border-status-overdue`) so the selected state still reads as danger, not as a neutral "selected".

### 3. Secondary tiles (Pending / Accepted / Awaiting)
- Active state: same treatment — ditch `bg-ink text-paper` inversion and use `bg-secondary border-ink` with the count badge filled (`bg-ink text-paper rounded-full px-1.5`). Keeps semantic colour of the tile intact when selected.
- Add a tiny status dot before each tile label, colour-matched to `STATUS_DOT` (pending=ink/40, accepted=lime, awaiting=amber). Consistent with the rest of the audit passes.
- Reduce `text-[10px] uppercase tracking-widest` to `text-[10px] tracking-wide` — the extra-wide tracking + small size hurts legibility.

### 4. Search + filter row
- Bump search input to `text-[15px]` (matches Clients pass).
- Active-tile chip: move from `bg-ink text-paper` to `bg-secondary text-ink` with a status dot prefix matching the tile. Currently the dark pill competes visually with the overdue tile above it.
- When `q` has content, show a small ghost `×` inside the input to clear, not just the tile chip.

### 5. Result list
- Empty state: when `tile` filter is set and yields nothing, add a secondary inline action `"Clear filter"` (ghost) under the EmptyState body, so users aren't stuck.
- When `q` has text but no match AND a tile is also active, message reads: `No <tile-label> quotes match "<q>"` (currently shows only the `q` form).
- Drop the trailing empty `pb-24` from `space-y-2.5`; bottom-safe spacing already handled by AppShell. Verify before removing — only drop if AppShell adds bottom padding (will check). If not, keep.

### 6. QuoteCard (row)
- Remove the heavy custom shadow on `paid` / draft cards (`shadow-[0_1px_2px...]`). Use the project's `card-surface` token consistently; the left 4px border already differentiates state.
- `paid` cards: dim the row (`opacity-80`) so the eye is drawn to active/overdue first.
- `accepted` rows: when `materialsForQuote(quote).length > 0`, the chip currently says `"N materials"` — make it tappable feel by promoting to a `bg-secondary` chip with `ShoppingCart` icon. Pure visual; still inside the Link.
- Draft cards: replace `"Tap to continue"` text with a small lime dot + `"Draft"` already covered by the pill — the "Tap to continue" string is redundant noise. Drop it.
- Overdue row: keep the inverted ink treatment (intentional alarm), but add a small `"Chase"` text hint at the right under the amount in `text-[10px] text-paper/60` so the swipe action is discoverable.
- Long-press: leave `useLongPress` behaviour as-is; no scope changes there.

### 7. Out of scope (explicit)
- `QuoteQuickActionsSheet` internals
- `SwipeRow` component
- `markOverdueQuotes`, `deleteQuote`, `duplicateQuote`, `setQuoteStatus` server fns
- `user-data` layer / `mockQuotes`
- `useLongPress`, `useDataVersion`, `useSession`
- `EmptyState` and `QuotesListSkeleton` internals
- `CountUpGBP` animation
- Pagination/virtualisation
- Adding a real in-app message thread (deferred from Messages pass)

### Files touched
- `src/routes/quotes.index.tsx` only.
