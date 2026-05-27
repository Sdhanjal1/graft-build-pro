## Step 7 — Audit & sharpen pricing-patterns influence

Patterns are fetched and appended, but the influence is weak: 50 unfiltered rows are dumped flat into the system prompt with no category context, no relevance ranking against the current job, and the capture handler's `LineItemSchema` is missing the `category` field (so saved patterns lose category accuracy for capture-flow quotes).

### Findings

1. **`patternsForPrompt` (pricing-patterns.functions.ts:37)** — lists `description: £price (count×)` only. No `item_category`, no min/max range. Claude can't tell labour from materials in the learned block.
2. **No relevance filter** — top 50 by `price_count` regardless of trade or current job text. A plumber asking about a boiler still sees decorating patterns.
3. **`ai-capture-quote.functions.ts` LineItemSchema (line 15-20)** — missing `category` enum that `ai-quote.functions.ts` has. Means capture-flow line items never carry category → downstream `upsertPatternsFromQuote` relies on `inferCategory(description)` instead of the model's judgement.
4. **System-prompt rule for `learned`** — current text says "use these prices for items they have quoted before" but doesn't tell Claude how to handle close-but-not-exact matches (e.g. "magnetic filter" vs "MagnaClean filter").

### Changes

**1. `patternsForPrompt` — richer formatting + category grouping**
- Group patterns by `item_category` (labour / materials / certificate / cis_labour / other).
- Each line: `- <desc> — £<typical> (range £min–£max, n=<count>)`.
- Cap at 40 lines total to stay token-friendly.
- Update the surrounding instruction text: explicitly tell Claude to (a) prefer learned price for fuzzy matches (same item, different wording) and (b) keep the learned price even when their general UK estimate would differ.

**2. Relevance pre-filter in `fetchTopPatterns` callers**
- Add a small `rankPatternsForJob(patterns, jobText)` helper in `pricing-patterns.ts` (client-safe, pure): token-overlap score against the job description / captured items; ties broken by `price_count`.
- Both AI handlers fetch top 80, then `rankPatternsForJob` → top 30 passed to `patternsForPrompt`.

**3. Add `category` to capture handler `LineItemSchema`**
- Mirror the enum from `ai-quote.functions.ts`.
- Add the same "CATEGORY FIELD" block to the capture `SYSTEM_PROMPT`.
- Update the JSON shape example in the user prompt.

**4. No DB changes, no new env vars, no payload changes for callers.**

### Verification
- As a plumber, generate a quote referencing an item already in patterns ("install Vaillant boiler") — expect `source: "learned"` with the user's typical price, not a generic estimate.
- As a decorator, generate a quote — verify the learned block in the prompt is dominated by decorator-relevant rows (manual inspection via a temporary `console.log` in dev, removed before finishing).
- Save a capture-flow quote → verify line items now arrive with sensible `category` values and `upsertPatternsFromQuote` stores them with the correct `item_category`.
