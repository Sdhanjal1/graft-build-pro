## Fix manual "record deposit paid" — refresh UI + surface the action

Scope: `src/routes/quotes.$quoteId.tsx` only. Manual/off-platform path (cash/bank) for `deposit_then_balance`. Stripe webhook path untouched.

### 1. Fix the "no refresh" bug (local state refetch, not router invalidation)

Approach: **local refetch** of `getQuotePaymentStatus`, not `router.invalidate()`. Reason: `depositPaid` / `depositRecorded` are local `useState` populated by an in-component `useEffect` calling `fetchPaymentsFn` — they aren't loader data, so invalidating the route wouldn't re-run that effect. Refetching directly is the reliable, minimal change and keeps the existing data flow.

Changes:
- Extract the body of the existing `useEffect` (lines 231–245) into a `refreshPayments` callback (`useCallback`, deps `[quote.id, fetchPaymentsFn]`) that sets `depositPaid` and `depositRecorded` from the latest rows. The `useEffect` just calls it on mount.
- In `handleRecordManualDeposit` (line 206), after `recordDepositFn` succeeds, `await refreshPayments()` before the `setTimeout` that closes the sheets. This guarantees the balance line (`LineItemsEditor depositPaid={...}`) and the new "Deposit received" state both reflect the new row immediately — no reload.
- Same `refreshPayments()` call added to `removeManualDeposit`'s success handler so reversal also updates instantly (small consistency fix, no behaviour change otherwise).

### 2. Surface the action for `deposit_then_balance`

Today the totals block (lines 741–752) shows "Deposit due / Balance" when `timing === "deposit_then_balance" && configuredDeposit > 0`. Add an inline CTA directly under that block, only when:

- `timing === "deposit_then_balance"`
- `configuredDeposit > 0`
- `status !== "paid"`
- `depositPaid === 0` (i.e. not yet recorded — covers both card-via-Stripe and manual; once either lands, this disappears)

CTA UI: a single tappable row inside the same card, styled like the existing inline prompts on this screen — left: "Deposit not yet received · Tap to record bank/cash payment"; right: chevron. Tapping it opens the **existing** `recordDepositOpen` sheet (already wired at line 1237 with Cash received / Bank received buttons), so no new sheet, no new server fn, no duplicated logic.

When `depositPaid > 0`, the CTA is replaced by a "Deposit received · £X" confirmation row (same card), and the existing balance line continues to render. The "Cash received / Bank received" buttons in More-actions stay as-is for power users.

### Files

- `src/routes/quotes.$quoteId.tsx` — extract `refreshPayments`, await it in record/remove handlers, add CTA + received row inside the totals card.

### Out of scope

- No changes to `payments.functions.ts`, webhook, Stripe path, or other routes.
- No router/loader invalidation; local refetch only.