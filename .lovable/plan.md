## Overview

Three related changes to make AI-generated quotes match how each tradesperson actually prices their work:

1. **Honour spoken prices** — when a voice note says "Worcester for £1,200", use it.
2. **Pricing memory** — remember each tradesperson's typical prices and reuse them on the next quote.
3. **Show provenance** — badge every line item as *Your price* / *Your usual price* / *Quottr suggested* so it's clear where each number came from.

Everything stays in the current design (dark ink, lime green, Bebas headings, DM Sans body).

---

## 1. Database — `user_pricing_patterns`

New migration creates one table:

- `id`, `user_id` (uuid, references `auth.users`)
- `item_description` (text, normalised lowercase)
- `item_category` (text — boiler / labour / materials / fitting / other)
- `typical_price` (numeric, rolling average)
- `price_count` (int, how many quotes contributed)
- `price_min`, `price_max` (numeric)
- `last_quoted_at`, `created_at`, `updated_at` (timestamptz)
- Unique `(user_id, item_description)`
- Index on `(user_id, price_count desc)` for fast top-N lookups
- RLS: users see/manage only their own rows

No trigger — updates happen inside the server function so we can compute the rolling average atomically.

---

## 2. AI quote generation — `src/lib/ai-quote.functions.ts` and `ai-capture-quote.functions.ts`

**Schema change:** add `source: 'voice' | 'learned' | 'ai'` to each line item in the Claude response. Default `'ai'` if Claude omits it.

**System prompt additions:**
- Tell Claude to use exact prices the tradesperson speaks ("Worcester for £1,200", "6 hours at £65", etc.) and mark those `source: 'voice'`.
- Inject the user's top 50 pricing patterns (by `price_count desc`) as a "Your typical pricing" block. Tell Claude to use these where applicable and mark them `source: 'learned'`. Anything else estimated by Claude is `'ai'`.

Both `generateAIQuote` and `generateCaptureQuote` fetch patterns via the authenticated supabase client from `requireSupabaseAuth` middleware (already in `requireActiveSubscription` chain — verify or add).

---

## 3. Persisting prices after save

In `saveGeneratedQuote` (and the capture-quote save path), upsert each line item into `user_pricing_patterns`:

- Normalise description: lowercase, collapse whitespace, strip leading qty markers.
- If row exists: `typical_price = (typical_price * price_count + new_price) / (price_count + 1)`, bump `price_count`, update min/max, set `last_quoted_at = now()`.
- Else insert with `price_count = 1`.
- Skip rows with `unit_price = 0`.
- Infer `item_category` with a simple keyword map (boiler / radiator / labour / hour / fitting / fall back to "materials").

Runs as part of the same server function that saves the quote, so it's atomic from the user's POV.

---

## 4. UI — line item badges on quote detail

In `src/routes/quotes.$quoteId.tsx`, next to each line item description, render a small badge based on `li.source`:

- `voice` → lime/30 background, ink text — "Your price"
- `learned` → lime/15 background, ink text — "Your usual price"
- `ai` → secondary background, muted text — "Quottr suggested"

Tapping a line opens an inline price editor (numeric input). Saving updates the line item, recomputes totals, sets `source = 'voice'`, and persists via existing quote update path. Editing also feeds the pattern table (treated as a new voice-priced entry).

Old quotes with no `source` field render as `'ai'` (no badge spam — only show badge when source is known).

---

## 5. Rotating prompts

Update `src/components/RotatingPrompts.tsx` so every example demonstrates speaking prices:

- "Try: Quote Mrs Jones for a combi boiler, Worcester 30i for £1,250, 8 hours labour at £65"
- "Try: Bathroom refit, suite £850, tiles £450, labour £1,200, four days"
- "Try: Consumer unit replacement, £450 parts, full day labour £400"
- Plus 2–3 more in the same shape (radiators, EICR, roof repair).

---

## 6. Insights — "Your pricing patterns"

New section in `src/routes/insights.tsx` below the existing transactions list:

- Total items in pricing memory (count of rows)
- Top 5 most-quoted items (by `price_count`) with their `typical_price`
- Average labour rate (avg of `typical_price` where `item_category = 'labour'`)
- Average markup (placeholder — only shown if we have enough data; skip if unclear)
- Simple "trend" hint per top item: ↑ / → / ↓ based on `price_max` vs `typical_price` and `last_quoted_at` recency

Data comes from a new `getPricingInsights` server function. No charts — keep it to a clean list matching the existing card style.

---

## Files to change

- **new migration** — `user_pricing_patterns` table + RLS
- **new** `src/lib/pricing-patterns.functions.ts` — `getTopPatterns`, `upsertPatternsFromQuote`, `getPricingInsights`
- `src/lib/ai-quote.functions.ts` — prompt + schema + inject patterns
- `src/lib/ai-capture-quote.functions.ts` — same
- `src/lib/user-data.ts` — extend `LineItem` with `source`; call upsert from `saveGeneratedQuote`
- `src/routes/quotes.$quoteId.tsx` — badges + inline price edit
- `src/routes/quotes.new.tsx` — render `source` on draft preview
- `src/routes/insights.tsx` — new "Your pricing patterns" section
- `src/components/RotatingPrompts.tsx` — new examples

## Out of scope

- No back-fill of patterns from historical quotes (only forward from now).
- No category management UI — categories are inferred and used only for the labour-rate stat.
- No editing/deleting patterns directly — they self-correct via new quotes.

Approve and I'll start with the migration.