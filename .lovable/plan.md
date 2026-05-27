## Goal

Labour line items quote in **hours** or **days** instead of "Qty". Materials, certificates and other categories keep "Qty" unchanged. The AI that drafts quotes also estimates labour duration and pre-fills it.

## Changes

### 1. Data model — `src/lib/user-data.ts`
Add optional `unit` to `LineItem`:
```ts
type LineItemUnit = "qty" | "hours" | "days";
type LineItem = {
  description: string;
  qty: number;          // still the multiplier (hours / days / items)
  unit_price: number;   // price per hour / per day / per item
  unit?: LineItemUnit;  // missing ⇒ "qty" (back-compat)
  category?: LineItemCategory;
  source?: ...;
};
```
Totals math (`qty * unit_price`) unchanged. Existing quotes render exactly as before.

### 2. New quote editor — `src/routes/quotes.new.tsx`
For lines with `category` of `labour` or `cis_labour`:
- Replace "Qty" with a small **Hrs / Days** toggle (defaults to Hrs).
- Price label flips to `£/hr` or `£/day`.
- All other categories untouched (still "Qty" + "£").

### 3. AI duration estimation
Extend the existing quote-drafting AI call (the server function that turns the voice/text brief into line items) so that for each `labour` / `cis_labour` line it also returns:
- `unit`: `"hours"` or `"days"`
- `qty`: estimated duration

Prompt addition: "For labour items, estimate realistic UK trade duration. Use hours for jobs under a day, days otherwise. Round hours to 0.5 and days to 0.5." The trader can override the toggle and number on the line — value is tagged `source: "ai"` so the existing "Quottr suggested" badge already shows.

### 4. Read-only display surfaces
Update labour-line rendering in:
- `src/routes/quotes.$quoteId.tsx`
- `src/routes/invoices.$quoteId.tsx`
- `src/routes/portal.$token.tsx`, `src/routes/portal.c.$code.tsx`
- `src/lib/pdf.ts`, `src/lib/portal-pdf.ts`

Labour rows render as `"3 hrs × £55/hr"` or `"2 days × £320/day"`. Non-labour rows unchanged. `AccountingExportButton.tsx` keeps `qty * unit_price` for totals — no export schema change.

## Verification
- Voice-brief a labour-heavy job → AI returns labour lines pre-filled with hours/days estimates; trader can flip toggle.
- Materials line is unchanged (still Qty + £).
- Save, reopen, view PDF + portal → labour rows show hrs/days; legacy quotes without `unit` render as before.

## Out of scope
- Supabase schema changes (line_items is JSON — new field accepted as-is).
- Per-trade default hourly/day rates.
- Backfilling unit on historical quotes.
