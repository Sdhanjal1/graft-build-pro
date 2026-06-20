# Labour pricing fidelity — voice → quote

## What's wrong today

The AI extractors (`ai-quote.functions.ts`, `ai-capture-quote.functions.ts`) are correctly instructed to emit one labour line as `{ qty: <hours|days>, unit: "hours"|"days", unit_price: <rate>, category: "labour" }`. The quote editor and PDF read `unit` and render `6 hrs × £65/hr`.

The break point is `normalizeLineItems` in `src/routes/quotes.new.tsx:56-77`. It unconditionally collapses every labour line into:

```
{ description: "Labour", qty: 1, unit_price: <summed total>, unit: "qty" }
```

That throws away the hours/days unit and the per-hour rate. After voice generation the user sees `1 × £390.00` instead of `6 hrs × £65.00/hr`, and the saved quote / PDF / portal all carry the flattened form. It also fires on append (line 658), edits (1002), regenerate (956/1023) and chunked capture (1181), so the regression is permanent the moment voice runs once.

## Fix

Rewrite `normalizeLineItems` to keep the unit when it's safe:

1. Split items into materials and labour as today.
2. If there is exactly one labour line, pass it through unchanged (preserve `qty`, `unit`, `unit_price`, `category`, `source`).
3. If all labour lines share the same `unit` (`hours` or `days`) AND the same `unit_price`, merge them into one line with `qty = sum(qty)`, keep the original `unit` and `unit_price`.
4. Otherwise (mixed units, mixed rates, or any qty-based labour) fall back to the existing `qty: 1, unit: "qty", unit_price: total` behaviour — this matches the AI's "mixed prices → one combined line" rule and is the only case where a per-hour rate genuinely can't be represented.
5. Preserve `category` as `cis_labour` if every labour line was `cis_labour`; otherwise `labour` (today's default).

No changes to AI prompts, schemas, save path, editor UI, or PDF — they already handle `unit` correctly. No DB migration.

## Files touched

- `src/routes/quotes.new.tsx` — rewrite `normalizeLineItems` (lines 56-77). All five call sites keep working unchanged.

## Verification

- Voice: "six hours labour at sixty-five an hour, plus a radiator" → quote shows `Labour — 6 hrs × £65.00/hr` and `Radiator — 1 × £…`.
- Voice with day rate: "two days on site" with day rate £280 set → `Labour — 2 days × £280.00/day`.
- Mixed: "two hours at £70 and three hours at £55" → collapses to single `Labour — 1 × £215.00` (current behaviour, intentional).
- Append + regenerate paths exercised by adding a second voice note on top of an existing labour line.
- Edit existing quote: hours/days unit round-trips through save/load.

## Out of scope

- AI prompt wording — already correct.
- Quote editor row UI — already reads `unit`.
- `computeQuoteTotals` — uses `qty * unit_price` regardless of unit, unaffected.

Approved — good catch. The original labour-combining was over-flattening even clean single labour lines (losing "6 hrs × £65/hr" → "1 × £390"), and keeping the unit when it's representable is the right fix. The conditional logic is correct: pass-through single lines, merge same-unit-same-rate, flatten only on mixed units/rates where a single rate genuinely can't be shown. Apply it.  
After it's in, I'll specifically check the day-rate case ("2 days × £280/day") round-trips through save/load, and that the unit survives the append and regenerate paths, not just initial generation.