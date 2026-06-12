## Problem

On the quote create/edit page (`/quotes/new`, also used for editing via `?id=…`), the Payment card has a large empty gap below it before the sticky Save / Save & send bar (visible in screenshot).

Cause: the form wrapper uses `pb-64` (256px) to clear the sticky bar, but the bar only needs ~152px of clearance (`bottom-20` = 80px + ~56px bar height + small buffer).

## Change

`src/routes/quotes.new.tsx`, line 1272:

- `className="px-5 mt-4 space-y-4 pb-64"` → `className="px-5 mt-4 space-y-4 pb-40"`

This tightens the gap below the last card (Payment, or Deposit panel when expanded) so it sits closer to the sticky action bar without overlap.

## Scope

- Single file. Same component renders both the new-quote and edit-quote flows (edit is keyed off `editId`), so this one change covers both pages as requested.
- No other layout, no logic, no other padding touched.