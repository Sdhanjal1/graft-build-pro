## Goal

Stop the "Your usual price" badge from appearing for users with no real pricing history. Tighten the prompt that Claude follows, and add a client-side guard so even if Claude ignores the prompt the UI never lies.

## Changes

### 1. `src/lib/ai-quote.functions.ts` — rewrite SOURCE FIELD section

Replace the existing `SOURCE FIELD — STRICT RULES:` block (lines 43–54) of `SYSTEM_PROMPT` with the new stricter wording supplied by the user:

```
SOURCE FIELD — STRICT RULES (READ CAREFULLY):

Each line item MUST have a source field. Use these rules in this
exact order — do not deviate:

Rule 1: If the tradesperson explicitly stated a price for this
specific item in their voice note (using phrases like '£X',
'X pounds', 'at X an hour', 'charging X'), set source = 'voice'.

Rule 2: If a LEARNED PATTERNS section was provided below AND that
section contains a clear match for this item, set source = 'learned'.
If no LEARNED PATTERNS section exists or it's empty, you must NOT
use 'learned' for any item.

Rule 3: For all other items where you estimated the price using
general UK trade knowledge, set source = 'ai'. This is the most
common case for new users.
```

Nothing else in that file changes (schema, handler, pattern fetching all stay the same).

### 2. Client-side safety net

Add the same lightweight override in both screens that display AI-generated line items:

- `src/routes/quotes.new.tsx` (AI preview before save)
- `src/routes/quotes.$quoteId.tsx` (saved quote view)

Logic in each file:

1. On mount, run one Supabase count query:
  ```ts
   const { count } = await supabase
     .from("quotes")
     .select("id", { count: "exact", head: true })
     .eq("status", "paid");
  ```
   Store as `paidQuoteCount` in component state (default `null` while loading, treated as `0` for the guard so we fail safe).
2. Define a tiny helper:
  ```ts
   const LEARNED_MIN_PAID_QUOTES = 5;
   function normalizeSource(src, paidCount) {
     if (src === "learned" && (paidCount ?? 0) < LEARNED_MIN_PAID_QUOTES) {
       return "ai";
     }
     return src ?? "ai";
   }
  ```
3. In `quotes.new.tsx`, when rendering AI preview line items (around the existing `li.source === "learned"` checks near line 733/740), feed `li.source` through `normalizeSource(li.source, paidQuoteCount)` before computing the badge.
4. In `quotes.$quoteId.tsx`, do the same at the rendering site — the existing `badgeClass(source)` / `badgeText(source)` calls (lines 776–783) get `normalizeSource(li.source, paidQuoteCount)` passed instead of `li.source` directly. The underlying stored `line_items` JSON is NOT mutated; this is presentation-only.

That way a new user with 0 paid quotes can never see "Your usual price", regardless of what Claude returns.

## Out of scope

- No DB schema changes, no migration.
- No changes to `badgeText` / `badgeClass` themselves.
- Stored `line_items.source` values are left untouched — the override is render-time only, so once the user accumulates ≥5 paid quotes their historical quotes will start showing the "learned" badge correctly without a backfill.

Additional note on the Supabase count query: cache the result 

at the app level (e.g. in a React context or React Query with 

a 5 minute stale time) so both [quotes.new](http://quotes.new).tsx and 

quotes.$quoteId.tsx share a single fetched value rather than 

each making their own query on mount. Refetch when a quote 

status changes to 'paid'.

Also lower LEARNED_MIN_PAID_QUOTES from 5 to 3 — three paid 

quotes is enough to start surfacing patterns to the user 

without making it feel like the feature never activates.