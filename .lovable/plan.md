# Quotes audit — list + detail

First pass of a per-screen tidy. Scoped to `src/routes/quotes.index.tsx` and `src/routes/quotes.$quoteId.tsx`. No business logic changes — visual hierarchy, contrast, density, and affordance only. Other sections (Clients, New quote flow, Home/Nav) come in follow-up passes.

## Quotes list (`quotes.index.tsx`)

1. **Pipeline hero density.** The lime hero is the loudest thing on screen but only tells you a total. Add a one-line secondary under the big number: "X awaiting payment · Y overdue" so the hero is informative, not just decorative. Keeps the lime block, just earns its size.
2. **Tile row consistency.** The overdue card and the 3 secondary tiles use different paddings, type sizes, and label casing. Standardise: same label treatment (uppercase 10px), same number type-size scale, same internal padding. Keeps overdue's red border + pulse as the differentiator instead of bespoke layout.
3. **Active-filter affordance.** "Showing X · Clear filter" is a muted text button — easy to miss. Promote to a small pill chip with an × icon, positioned next to the search field, so the active filter reads as a removable chip (the standard pattern).
4. **Search field chrome.** Search input sits in a full `card-surface` block — heavier than it needs to be. Switch to a single rounded input with inline icon (matches the density of every other search input in the app).
5. **Quote card hierarchy.** The £ amount is currently the biggest thing on every row, even for low-value drafts; the client name (the thing you actually scan for) is secondary. Swap: client name becomes the primary line (sm-semibold ink), amount drops to a right-aligned tabular number. Keeps the colour-coded left border for status. Title stays as the third line.
6. **Status pills.** `STATUS_PILL` uses 5 near-identical `bg-ink/10 text-ink` variants for pending/sent/completed/declined — visually all the same. Collapse to 3 visual states (neutral, positive, danger) and rely on the existing label text + left border to disambiguate. Less pill noise.

## Quote detail (`quotes.$quoteId.tsx`)

7. **Money summary contrast bug.** The top card uses `bg-paper/[0.04]` with `text-paper` / `text-paper/60` / `text-paper/70` on what is actually a cream `paper` page background — the text is near-invisible. Rebuild with ink-on-cream tokens (`text-ink`, `text-muted-foreground`, `border-border`) matching the rest of the detail page.
8. **Section rhythm.** Six stacked full-width `card-surface` blocks (intro, description, itemised, payment terms, materials, options) with identical chrome and identical 20px gaps creates a wall. Group into two visual bands with a thin divider/`mt-6` between bands: (a) the quote itself — intro, description, itemised — (b) the deal — payment terms, materials, options. Cheap, big readability win.
9. **Native confirms.** `removeRecordedDeposit`, `markUnpaid`, `removeQuote` all use `window.confirm()` — inconsistent with the `AlertDialog` we just standardised on in Settings. Replace with `AlertDialog` (no typed-DELETE required here — these are reversible/low-stakes, just match the shadcn surface).
10. **"Just sent" banner timing.** The lime "Quote sent" banner is persistent for the whole session as long as `?sent=1` is in the URL. Auto-dismiss after ~5s (or on first scroll) and strip the query param so a refresh doesn't re-show it.
11. **Options accordion label.** "Options" is the least descriptive label possible for a list containing share, call, email, mark-paid, regenerate link, etc. Rename to "More actions" and add a one-line subtitle ("Share, payments, customer link") so collapsed state hints at contents.
12. **Payment-terms "Change" affordance.** The lime payment-terms card has a tiny underlined "Change" text link as its only tap target. The whole card is already a meaningful unit — make the entire card the button (active-scale, focus ring) and drop the inline link.

## Out of scope (this pass)

- `LineItemsEditor` internals (separate audit — it's substantial)
- The various Sheets (`MaterialListSheet`, `SendQuoteDialog`, `AssignClientDialog`, deposit/invoice/timing sheets) — audited with their respective owning screens
- Mobile gesture refinements on `SwipeRow` and long-press
- Any data/RLS/server-fn changes

After this lands, I'll move to **Clients** (list, detail, new) as the next pass.
