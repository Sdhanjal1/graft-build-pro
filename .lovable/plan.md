# Three Voice-to-Quote Improvements — Implementation Plans

Important upfront finding: **two of the three are partially already built.** I read the actual files before planning so the work below is the real delta, not a re-build.

---

## Plan 1 — Sticky Primary Action Bar (Quote Detail)

### What's already there

`src/routes/quotes.$quoteId.tsx` lines 801–813 already render a fixed bar at `bottom-20` (above `BottomNav` which is `fixed bottom-0 h-16` per `src/components/BottomNav.tsx`). The `primary` action is already status-driven (lines 491–504): pending → "Send to {FirstName}" / "Add client to send", sent → "Mark as accepted", accepted → "Mark job complete", completed → "Mark as paid", else → "Share PDF". A 128px spacer (line 799) keeps content above it.

So the bar exists. The gaps the user described are the polish layer.

### Gaps to close

1. **Label clarity for two states.** "Mark as accepted" is jargon — change to "Customer accepted". "Share PDF" (the catch-all for paid/invoiced/declined) is too generic — branch it: paid → "Share receipt", invoiced → "Share invoice", declined → "Reopen quote" (and wire the existing `setQuoteStatus(id, "pending")` call from line 571 into it).
2. **Hide-on-scroll-down, show-on-scroll-up.** Trades scroll long line-item lists; the bar overlaps content. Track `window.scrollY` direction in a small hook and translate the bar `translateY(120%)` on downscroll past 200px, restore on upscroll or when within 80px of bottom. Always visible at the top of the page and when the keyboard is open.
3. **Loading + disabled state.** Today `primary.onClick` is fire-and-forget — a slow `acceptQuote`/`completeJob` lets the user double-tap. Add a local `actioning` boolean wrapping the click, swap the icon for `Loader2 animate-spin`, and disable the button while pending.
4. **Secondary action slot.** When status = `sent`, the #2 job is chasing. Add a small ghost button to the LEFT of the primary ("Send chaser" → opens the existing WhatsApp `waHref` from line 507) for `sent` quotes older than 3 days.

### Files

- `src/routes/quotes.$quoteId.tsx` — edit the `primary` branch logic (lines 491–504) and the sticky bar JSX (lines 801–813); add the scroll hook + `actioning` state near the existing `useState` block around line 87.
- Optional: extract a tiny `src/hooks/use-scroll-direction.ts` for reuse.

### Risk on payment/status flow

**Low.** No changes to `acceptQuote`, `completeJob`, `markQuotePaid`, `recordManualDeposit`, or any of the `payments.functions.ts` calls. Pure presentation + a wrapper around existing handlers. The decline/reopen path already exists at line 571 — we'd reuse the same `setQuoteStatus(quote.id, "pending")` call, not invent a new mutation.

### Edge cases

- Bottom sheets (`timingOpen`, `askingPaid`, `MaterialListSheet`) sit at `z-50`+ and cover the bar — already fine, no overlap conflict.
- iOS Safari safe-area: bar must respect `safe-bottom` like `BottomNav` does; current code doesn't and works because of the `bottom-20` offset, but on the iPhone "home indicator" devices the gap looks off. Add `pb-[env(safe-area-inset-bottom)]` to the wrapper.
- Hide-on-scroll must NOT engage when `pending` and there's no client (the "Add client to send" CTA is the whole point of the page) — keep always-visible for that one state.

### Effort: **~2 hours.** It's polish on existing structure.

---

## Plan 2 — Streaming Partial Transcript (Voice Quote)

### What's already there

`src/routes/quotes.new.tsx` already runs `webkitSpeechRecognition` with `interimResults = true` (lines 631–667). Every keystroke of recognised speech goes into `setLivePreview(...)` at line 657 — combined final + interim text. The state is passed as a prop through to the overlay (line 835) and into `LiveBuildingPanel`'s props (line 1582). **It just isn't rendered anywhere in the JSX.** `liveSupported` is also tracked (line 122, set at 632/672) but unused in the UI.

### Implementation

1. **Render the dim transcript line** inside `LiveBuildingPanel` (around `src/routes/quotes.new.tsx` line 1669, between the pinned header and the building indicator/list):
  - When `recording && livePreview` and no items yet → centred, two-line max, `text-paper/40 italic text-sm`, with fade-mask on overflow.
  - When `recording && livePreview && hasItems` → render as a single muted line below the running total ("Hearing: …last 8 words…"), so the user sees we're still listening while items already exist.
  - When `transcribing` or `!recording` → render nothing (it gets cleared at line 601 anyway).
2. **Truncate to last ~80 chars** so the line doesn't push layout around as speech accumulates. Use a `useMemo` over `livePreview.slice(-80)` with a leading ellipsis.
3. **Fallback for non-WebKit browsers** (Firefox desktop, in-app browsers without Web Speech). `liveSupported` already flips to `false` at line 672 — surface it: when `recording && !liveSupported`, render "Transcribing on stop — you can speak freely" in the same dim slot. That's truthful: the existing pipeline already does a single Whisper pass at stop (line 621) when Web Speech produces nothing.
4. **No clear-on-finalize special case needed** — `setLivePreview("")` already runs at lines 387, 534, 601, 615 across the success and reset paths. The new render is reactive to that state.

### Files

- `src/routes/quotes.new.tsx` only. Two edits: add the JSX block inside `LiveBuildingPanel` (lines 1645–1811) and a one-line conditional for the fallback message. `livePreview` and `liveSupported` are already in the props.

### Risk on payment/status flow

**Zero.** This is pure rendering of state that's already being set. No changes to `generateAIQuote`, `transcribeAudio`, `MediaRecorder` lifecycle, or any persistence.

### Edge cases

- **Privacy:** the interim transcript is visible on the lock-screen-style overlay — fine, the user is the only viewer, but DON'T persist it. (Already true — it's local state.)
- **Long pauses:** Web Speech often re-fires the same interim text — the trailing-ellipsis truncation hides this naturally.
- **iOS Safari + Web Speech:** iOS *does* support `webkitSpeechRecognition` on Safari 14.5+ but it's flaky in standalone PWA mode. The fallback path (line 671: `setLiveSupported(false)`) covers it — the "Transcribing on stop" message is the right UX there.
- **Sub-1s utterances:** `livePreview` may flash then clear when the chunk is too short. Add `transition-opacity duration-150` to avoid flicker.

### Effort: **~1 hour.** Pure UI on already-flowing data.

---

## Plan 3 — Per-Trade Pricing Priming (AI Generation)

### What's already there

`src/lib/ai-quote.functions.ts` already does almost everything the user asked for:

- Lines 264–273 fetch the user's labour rates from `profiles` and their pricing patterns from `user_pricing_patterns` (capacity 80) via `fetchTopPatterns` in `src/lib/pricing-patterns.functions.ts` (lines 14–32).
- Line 275 ranks patterns by relevance to the current job text (`rankPatternsForJob`).
- Lines 276–280 compose the system prompt as `SYSTEM_PROMPT + labourRatesBlock + tradeGuidance(data.trade) + patternsForPrompt(patterns)`.
- `patternsForPrompt` (pricing-patterns.functions.ts lines 35–60) groups by category, shows typical price + min/max range + sample count, and includes an explicit override clause: *"Do not substitute a generic UK estimate when a learned match exists."*

So **the priming exists and the override policy is "patterns win when the spoken job mentions a matching item."** That answers the user's "override vs inform" question directly: it's currently override-on-match, inform-otherwise. That's the correct default and shouldn't change.

### Real gaps

1. `**trade_type` is fed to `tradeGuidance(data.trade)` and into the user prompt header ("Trade: {trade}"), but is NOT in the `LEARNED PATTERNS` block.** When patterns are sparse and the spoken job is ambiguous ("install the thing in the airing cupboard"), the model can't reason from "this user is an electrician, the thing is probably an immersion isolator, not a cylinder." Prepend a one-liner at the top of `patternsForPrompt`'s output: `"Tradesperson: {trade}. The patterns below are their actual historical prices for {trade} work."`
2. **Pattern cap is 10** (`pricing-patterns.functions.ts` line 37: `patterns.slice(0, 10)`). The user asked for "last 20." Raise to 20 — Claude Haiku 4.5 handles 20 patterns comfortably and `rankPatternsForJob` already filters to relevance, so the bottom of the list is the long-tail safety net. Token cost is negligible (~600 extra tokens per call).
3. `**fetchTopPatterns` orders by `price_count DESC**` (line 25), not `last_quoted_at`. "Last 20" implies recency. Either:
  - (a) Add a second query path ordered by `last_quoted_at DESC` and merge-dedupe with the count-ordered set (keeps "go-to items" + "what I quoted this month"), or
  - (b) Switch to a weighted Postgres `ORDER BY (price_count * 0.6 + recency_score * 0.4) DESC` via an RPC.
  - **Recommendation: (a).** It's a 6-line change with no new SQL.
4. **Document the override policy in the system prompt header** so future agents (and the user) don't accidentally invert it. One-line addition to `SYSTEM_PROMPT`: `"When the LEARNED PATTERNS block contains a match for a spoken item, use that price verbatim. Otherwise estimate from UK 2026 market knowledge."` (Currently this rule lives only in the patterns block itself, lines 60+ of pricing-patterns.functions.ts.)

### Files

- `src/lib/pricing-patterns.functions.ts` — raise cap to 20 in `patternsForPrompt` (line 37), add the trade-type header line, add a recency-ordered second fetch in `fetchTopPatterns` and merge-dedupe.
- `src/lib/ai-quote.functions.ts` — pass `data.trade` into `patternsForPrompt(patterns, data.trade)`, add the one-liner to `SYSTEM_PROMPT`.
- Mirror the same `patternsForPrompt` signature change in `src/lib/ai-capture-quote.functions.ts` (it imports the same helper).

### Risk on payment/status flow

**Zero.** Read-only on `user_pricing_patterns` and `profiles.labour_hourly_rate`/`labour_day_rate`. No writes, no schema changes, no Stripe/payment surface touched. The only behavioural change is Claude's output JSON — and the validator (`QuoteSchema`) at the call site catches anything malformed.

### Edge cases

- **New user, zero patterns:** `patternsForPrompt` already returns `""` early (line 36) — no empty `LEARNED PATTERNS:` block leaks into the prompt. Don't break this guard.
- **Patterns from a different trade** (user changed `trade_type` in settings): the trade-type header line will make the conflict obvious to Claude; combined with `rankPatternsForJob` relevance scoring, mismatched patterns naturally fall off the bottom of the truncated list. No code needed.
- **Token budget:** 20 patterns at ~60 chars each + categories ≈ 1.3 KB system overhead. Haiku 4.5's 200K context window is fine. Worth a one-line `console.log` of system prompt length while testing, deletable after.
- **Stale rates:** `prefetchedContextRef` (quotes.new.tsx line 525) caches labour rates + patterns ONCE per recording session. If the user edits Settings mid-session, they'd need to start a new recording — acceptable; document it in a code comment.

### Effort: **~1.5 hours** including a manual test recording across two trades.

---

## Total scope


| Plan                    | Net new code             | Risk to payment/status | Effort |
| ----------------------- | ------------------------ | ---------------------- | ------ |
| 1. Sticky bar polish    | ~80 lines + 1 hook       | Low                    | 2h     |
| 2. Streaming transcript | ~25 lines                | Zero                   | 1h     |
| 3. Per-trade priming    | ~40 lines across 3 files | Zero                   | 1.5h   |


**Combined: half a day.** No migrations, no schema changes, no payment-flow touchpoints. All three are reversible behind a one-line revert per file.

### Order I'd ship them

1. **Plan 2 first** — biggest perceived-quality win, smallest risk, the data is literally being thrown away today.
2. **Plan 3 second** — quality-of-quote improvement compounds with every quote the user generates.
3. **Plan 1 third** — polish on something that already works; do it after the higher-leverage wins.

Execute all three in this order (Plan 2 → Plan 3 → Plan 1). This is half a day of work with zero payment-flow risk. After these land, we're ready for Nav's full validation.