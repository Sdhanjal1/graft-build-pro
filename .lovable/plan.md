# Fix Qty/Unit price alignment in line-item edit panel

In `src/routes/quotes.$quoteId.tsx` `LineItemsEditor` editing branch:

- Wrap the Qty/Price row with `flex items-end gap-3` so both inputs share a baseline.
- Qty column: `shrink-0`, input stays `w-24`.
- Price column: `flex-1 min-w-0`, input becomes `w-full` (instead of `w-32`) so it fills the column edge-to-edge and the `£` prefix lines up cleanly.

No logic changes.
