## Step 5 — One-tap "+ Add line" with price suggestion

Add a tappable "+ Add line" row at the bottom of the line-items list on the quote detail page. Tapping it opens the same edit panel used for existing lines, prefilled blank. As the user types a description, suggest a unit price from their own past pricing (`user_pricing_patterns`). Tapping the suggestion fills the price field; they can override it.

### UX

1. New row directly under the last line item (above the totals block):
   - Full-width tappable row, `+ Add line` with a subtle dashed/secondary style so it reads as an action, not a real line.
2. On tap → expand the existing edit panel (reuse `LineItemsEditor` editing branch) with empty `description`, `qty = "1"`, `price = ""`, `category = "other"`.
3. Suggestion chip under the description input (only when adding, not when editing existing):
   - Appears after the user has typed ≥ 2 chars and there is a matching pattern.
   - Shows: `Last time: £{typical_price} · used {price_count}×` as a tappable chip.
   - Tap → fills `draft.price`. No auto-fill without a tap (avoids surprises).
4. On **Done**: append the new line to `items`, call existing `persist()` (which already runs `updateQuoteLineItems` and re-syncs totals). Cancel just collapses.
5. Validation: require non-empty description and price > 0 before Done is enabled for the new row. Qty defaults to 1.

### Suggestion source

- Add a small serverFn `suggestPriceForDescription({ description })` in `src/lib/pricing-patterns.functions.ts`:
  - Normalizes the input via `normalizeDescription`.
  - Returns the single best match for `auth.uid()` from `user_pricing_patterns`:
    - Exact match on normalized `item_description` wins.
    - Otherwise top match by `ILIKE %token%` on the first significant token, ordered by `price_count desc`.
  - Returns `{ typical_price, price_count, item_description } | null`.
- Client calls it via `useServerFn` + a debounced (~300ms) effect tied to `draft.description` while in "adding" mode. Cache last query in a ref to skip duplicates. Empty/short input → clear suggestion.

### Edits in `src/routes/quotes.$quoteId.tsx` `LineItemsEditor`

- Add state: `addingNew: boolean` plus reuse `draft`. Treat `editingIdx === -1` (or a separate flag) as "adding".
- Render order: existing `<ul>` items → "+ Add line" row (when not adding) OR an inline edit panel mirroring the existing one (when adding), with the suggestion chip under the description field.
- Refactor `commitAll` to branch: editing index ≥ 0 updates that line; adding appends a new `LineItem` with `source: "voice"` (treat manual price as user-entered, same as edits today).
- Keep `persist()` as-is.

### Technical notes

- No DB migration — `user_pricing_patterns` already exists with the right columns and RLS.
- Reuse `normalizeDescription` and the existing serverFn auth middleware.
- Keep `LineItem` shape unchanged; new items get a fresh id only if existing items have ids (check shape; current code preserves `...li`, so just spread defaults).
- Mobile-first: suggestion chip sits below the description input, full-width tap target, ~44px tall.