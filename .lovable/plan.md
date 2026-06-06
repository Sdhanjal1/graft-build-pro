# Two AI Quality Mitigations for Learned Pricing

Both changes are small and safe. I found one important thing in the existing code that changes Mitigation 2's shape — flagging it up front.

---

## Mitigation 1 — `price_count >= 2` filter

**File:** `src/lib/pricing-patterns.ts`, function `rankPatternsForJob` (lines 65–84).

Apply the prompt's change verbatim: split patterns into `authoritative` (`price_count >= 2`) and `advisory` (`< 2`), score both, and sort authoritative tier above advisory.

**One small refinement worth your call:** the patterns array fed in is already capped at 20 by `fetchTopPatterns`. With the new ordering, a single noisy one-off pattern can no longer push a 5x-quoted pattern out of the prompt — good. But if a user is new and has *only* one-off patterns, the advisory tier still flows through to the prompt (Claude can still use them as soft signal). That matches your "advisory not authoritative" intent. No code change needed beyond the prompt's snippet.

**Effort:** 5 min. **Risk:** zero.

---

## Mitigation 2 — "from your last job" chip on learned items

**Important finding before we touch this:** the chip infrastructure already exists and is *deliberately suppressed* for learned items.

In `src/routes/quotes.$quoteId.tsx`:

- `badgeText()` (line 1246) already returns `"Your usual price"` for `source === "learned"`.
- `badgeClass()` (line 1241) already has a lime-tinted style for learned.
- But line 1515 hard-codes: `const label = effectiveSource === "ai" && isEstimate ? badgeText(effectiveSource) : null;` — i.e. **only AI estimates currently render a badge**. Learned items render nothing.

So the actual fix is a one-line change at 1515, not a new JSX block. The prompt's proposed standalone `<div className="rounded-lg ...">` chunk doesn't match the existing layout (which uses inline pill badges next to the description, not stacked text under the price).

**Proposed change at line 1515:**

```ts
const label = (effectiveSource === "ai" && isEstimate) || effectiveSource === "learned"
  ? badgeText(effectiveSource)
  : null;
```

That immediately renders the existing lime "Your usual price" pill next to learned items — same visual language as the Estimate pill, no new styles.

**Wording question for you:**
The prompt suggests **"from your last job"**. Existing copy is **"Your usual price"**. They mean slightly different things:

- *"Your usual price"* — implies repeated/established (matches the new `price_count >= 2` gate from Mitigation 1).
- *"from your last job"* — implies recency, which we don't actually track per-item on the detail render path.

Recommendation: keep **"Your usual price"** — it's accurate, already in the codebase, and aligns with Mitigation 1's "must be quoted twice" rule. If you want the prompt's wording, we change `badgeText` line 1248. Tell me which.

**One more thing to check before merging:** `normalizeSource(li.source, paidQuoteCount)` is called at line 1511 and may already downgrade `learned` → `ai` until the user has enough paid quotes. If it does, very new users will still see no chip even after this fix — that's probably correct behaviour (don't claim "your usual price" on quote #2), but worth knowing. I'll verify the function's logic during build.

**Effort:** 10 min including the `normalizeSource` check. **Risk:** zero — purely cosmetic.

---

## Files Touched

- `src/lib/pricing-patterns.ts` — `rankPatternsForJob` filter/sort change.
- `src/routes/quotes.$quoteId.tsx` — one-line label condition at ~1515 (+ optional `badgeText` wording change at 1248).

No schema, prompt, or status-flow changes.

## Open Questions

1. Keep **"Your usual price"** (existing) or switch to **"from your last job"** (prompt's wording)?
2. Should the chip also appear on the customer-facing portal view, or detail-page only? (Current scope = detail page only, matching the prompt.)

Implement both as specified. Mitigation 1 verbatim. Mitigation 2: one-line fix at 1515, keep 'Your usual price' wording, detail-page scope only."