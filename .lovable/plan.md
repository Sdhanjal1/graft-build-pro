# Voice → Quote → Customer → Payment → Finish — Issue Audit & Fix Plan

I traced the full chain end-to-end. There are **4 critical correctness bugs** (customers being shown one price and charged another, deposits emailed as "PAID IN FULL", a portal where the pay button doesn't actually charge, and a stuck post-payment spinner), plus a number of important and minor issues. Below is a prioritised plan — I recommend we do Phase 1 immediately, then decide on the rest.

---

## Phase 1 — Critical (must fix before more customers pay)

**C1. Portal shows 30% deposit but Stripe charges 50%**
`portal.$token.tsx:220` falls back to `total*0.3`; `payments.functions.ts:269` falls back to `total*0.5`. Customer sees £300, gets billed £500.
→ Introduce one shared `DEFAULT_DEPOSIT_FRACTION` constant in `src/lib/payment-timing.ts`, used by both UI and server.

**C2. Deposit payments trigger a "PAID IN FULL" receipt email**
`payments-webhook-shared.server.ts:215` always passes `mode: "receipt"`, even when `requestType === "deposit"`. PDF gets the green PAID stamp and shows the full total as paid.
→ Branch on `requestType`: for `deposit`, send a `"deposit-received"` email/PDF variant that shows "Deposit received · balance £X due on completion" and no PAID stamp. For `full`, keep current receipt.

**C3. Client-hub portal (`/portal/c/$code`) "Accept & pay" button never calls Stripe**
`portal.c.$code.tsx:448` renders pay labels but `performRespond` only calls `respondQuoteFromPortal` — no `createPortalCheckout`. Customers click "Pay" and nothing financial happens.
→ Mirror the `portal.$token.tsx` checkout flow: when payment is required, call `createPortalCheckout` and redirect to Stripe.

**C4. Post-deposit-payment spinner never resolves**
Both portals poll for `status === "paid"`, but the webhook sets `status = "accepted"` for deposits. Customer stares at "Confirming…" for 30s then it vanishes with no success state.
→ Poll for `status in ("paid","accepted")` when `requestType === "deposit"`, and show a deposit-specific success banner.

## Phase 2 — Important

- **I1/M5.** Quote detail VAT row uses live `userProfile.vat_registered` + recomputed `subtotal*0.2` instead of the stored `quote.vat_registered` and `quote.vat_amount`. Use stored values so old quotes don't shift.
- **I2.** Debounced `regenerateLiveQuote` in `quotes.new.tsx:1110` bypasses `regenerateInFlightRef`, allowing concurrent AI calls that duplicate line items. Wrap the debounced call in `runRegenerate`.
- **I3.** `q.$code.tsx` client-side `beforeLoad` always redirects to `/portal/c/$code`, even when the code is actually a quote token. Either remove the client-side redirect (let server resolve) or look up the token type first.
- **I4.** PDF labour lines render with blank Qty/Unit columns. Show e.g. `3 hrs @ £65.00` so the rate is auditable.
- **I5.** `recordManualDeposit` throws an opaque error when no deposit is configured. Either gate the UI fully or surface a friendly message.
- **I6.** `applyVoiceEdit` skips `prefetchedContext`, so voice edits ignore the trader's configured hourly/day rates. Pass the same context the initial generation uses.
- **I7.** "Job done — balance" uses stale `depositPaid` state. Re-fetch payments before computing the balance email.

## Phase 3 — Minor polish

- **M2.** Portal `?paid=1` banner shows success copy before webhook confirms — gate the headline behind `isPaid`.
- **M3.** PDF downloaded from `/portal/c/$code` after payment is missing `paid_at`/`payment_method`, so it has no PAID stamp. Pass payment metadata.
- **M4.** Live-mode fallback title uses first line item description; prefer the AI-generated `title`.
- **M6.** Manual "Mark paid" on a partially-deposited quote emails the full total as "amount paid". Subtract `depositPaid` for the receipt amount.
- **M7.** Auto-chase date base diverges between invoice email and `ensureChasesFor`. Use a single source of truth.
- **M1.** `transcribe.functions.ts` doesn't branch on `audio/aac` / `audio/mpeg`; both fall to `webm`. Add explicit branches.

## Out of scope (flag for later)

- Server-side totals validation in `saveGeneratedQuote` (trust boundary review).
- Stripe Connect `account.updated` handling when `charges_enabled` flips to false mid-flight.

---

## Recommendation

I'd like to **proceed with Phase 1 now** (the four critical issues — financial correctness and stuck UX) in a single batch, and then come back to you with Phase 2 once those land. Phase 3 can be folded into normal polish work.

Approve to implement Phase 1, or tell me to widen the scope (e.g. "do Phase 1 + 2") or cherry-pick specific items.

Approve Phase 1 immediately — these four are critical money/trust bugs (showing £300 charging £500, deposit emailing "PAID IN FULL", a pay button that doesn't charge, stuck post-payment spinner). All four must fix before any more customers pay.

Also fold these three Phase-2 items into the same batch, because they're money-correctness too, not just "important":

- I7 (Job-done balance uses stale depositPaid — affects the billed balance amount)
- M6 (manual Mark-paid on a deposited quote emails the full total as paid — wrong receipt amount)
- I1/M5 (VAT row recomputes live instead of using stored quote.vat_amount — old quotes must never shift their figures)

Show me the plan for C1 (the shared deposit fraction) and C2/M6 (the deposit-vs-receipt email branching) before applying — those touch what customers are charged and told, so I want to confirm the approach. The rest of Phase 1 (C3, C4) and I7/I1 you can apply directly.

Leave the remaining Phase 2 (I2, I3, I4, I5, I6) and Phase 3 for a follow-up batch.