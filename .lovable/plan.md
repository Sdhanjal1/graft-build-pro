# Step 4 follow-up: Make line item editing easier

## Problem

The current tap-to-edit on `/quotes/$id` line items turns each field into a tiny inline input (qty `w-16`, price `w-20`, description squeezed in a flex row). On mobile this is fiddly to tap accurately and awkward to type into — especially the price field next to the total.

## Fix

Replace the three independent tap-to-edit fields with a single per-row **Edit** affordance that expands the row into a proper edit panel.

### Read state (default)

Each line item row stays compact and read-only by default, with one clear edit control:

- Show description, qty × price, total as plain text (no more clickable buttons that look like text).
- Add a small **pencil icon button** on the right of the row (next to the total) — `aria-label="Edit line item"`, ghost styling, `h-8 w-8` touch target.
- Tapping the row anywhere outside the category selector also triggers edit (whole row is a button on mobile), keeping discoverability high.

### Edit state (expanded)

When a row is being edited, the row expands vertically into a stacked form inside the same `<li>`, pushing other rows down:

```
┌─────────────────────────────────────────┐
│ Description                             │
│ [ Replace boiler pressure valve      ]  │  ← full-width input, h-11
│                                         │
│ Qty           Unit price                │
│ [   1   ]     [ £  120.00 ]             │  ← both h-11, text-base
│                                         │
│ Category: [ Labour ▾ ]                  │
│                                         │
│        [ Cancel ]   [ Done ]            │  ← right-aligned, Done = primary
└─────────────────────────────────────────┘
```

Specifics:
- Inputs are `h-11` (44px) with `text-base` (16px — already enforced globally for mobile, but explicit here so desktop matches).
- Description: `<input>` full row width.
- Qty: numeric, `inputMode="decimal"`, `w-24`.
- Price: prefixed with `£`, `inputMode="decimal"`, `w-32`.
- Category selector moves into the edit panel (currently always visible — keeps the read row cleaner).
- **Done** button calls a single `commitAll()` that diffs all three fields against the original and persists in one `updateQuoteLineItems` call (one save, one toast instead of three).
- **Cancel** discards the draft and collapses without saving.
- Enter in any field commits; Escape cancels.
- Auto-focus the description input on open; do not auto-select (user usually wants to append/tweak, not retype).

### State shape change

Replace:
```ts
const [editing, setEditing] = useState<{ idx: number; field: ... } | null>(null);
const [draft, setDraft] = useState("");
```

With:
```ts
const [editingIdx, setEditingIdx] = useState<number | null>(null);
const [draft, setDraft] = useState<{ description: string; qty: string; price: string } | null>(null);
```

`beginEdit(idx)` loads all three fields. `commitAll()` builds the next items array applying any changed fields (re-badges as `"voice"` if price changed, same as today) and persists once.

### Files touched

- `src/routes/quotes.$quoteId.tsx` — only the `LineItemsEditor` component (lines ~884-1099). No changes to `updateQuoteLineItems`, persistence, or quote data flow.
- Add `Pencil` import from `lucide-react`.

### Out of scope

- "+ Add line" button (Step 5).
- Delete line item (separate follow-up if needed).
- Reordering line items.

Confirm and I'll implement.
