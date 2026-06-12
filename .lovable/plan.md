# Voice → Quote: additional items not loading

## Root cause

The live voice pipeline calls `generateAIQuote` (`src/lib/ai-quote.functions.ts`) on every pause and **replaces** `liveItems` with the AI's full list. As the transcript grows (and items pile up), the Anthropic response gets truncated because `max_tokens` is set too low:

- `src/lib/ai-quote.functions.ts:324` — `max_tokens: 2048`

When Claude truncates, the JSON closes early and one of two things happens in `regenerateLiveQuote`:
1. `text.match(/\{[\s\S]*\}/)` finds no balanced closing brace → throws "Claude returned no JSON".
2. JSON parses but trailing items are missing, or `QuoteSchema.parse(parsed)` rejects it.

In either case the `try { ... } catch { console.warn(...) }` in `regenerateLiveQuote` (line 641) swallows the failure silently — `setLiveItems` is never called, so the UI keeps the previous list and the newly-spoken items never appear. Symptom = "voice doesn't load additional items".

Secondary contributor: `QuoteSchema.line_items` is capped at `.max(20)`. A genuinely big job that returns >20 items would also fail the parse and silently keep the stale list.

## Fix (scoped, narrow)

`src/lib/ai-quote.functions.ts` only:

1. Raise `max_tokens` on the Anthropic call from `2048` → `4096`. Live regeneration sends the full transcript, so the response needs headroom as the list grows. Matches what `ai-capture-quote.functions.ts` already uses (`3072`) and the Lovable guidance on truncated LLM output.
2. After parsing the response JSON, read `payload.stop_reason` and, when it is `"max_tokens"`, `console.warn` a clear "[ai-quote] response truncated — consider raising max_tokens" message so future regressions are visible in server logs.
3. Bump `line_items` cap from `.max(20)` → `.max(30)` to match `ai-capture-quote.functions.ts` and stop silently rejecting large jobs.

No other files change. No prompt changes. No client/UI changes. No payments/webhook touch. Existing error mapping (429 / 402 / TimeoutError) is preserved.

## Out of scope

- The live overlay UI, debounce timing, `regenerateLiveQuote` logic, tombstones/edit refs — all working as designed; the AI response was the bottleneck.
- `ai-capture-quote.functions.ts` (already at 3072 / 30 items).
- Anything in Prompt A territory (payments, webhooks).

## Acceptance

- Long voice session with many items → each pause regeneration returns the full list and new items appear instead of being silently dropped.
- Truncated responses, if they still happen, leave a visible warning in server logs.
