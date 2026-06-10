## Problem

On the customer portal (`/portal/$token`), payment options (Pay by card / Pay by bank transfer) are gated behind `status === "accepted"`. For **Upfront** and **Deposit then balance** quotes this is the wrong UX — the customer expects to see *how* they'll pay before/while accepting, and on the "Accept and pay £X" tap they expect to land on Stripe Checkout, not on another screen asking them to tap "Pay deposit £X" again.

There is also no clear fallback message when the tradesperson has neither Stripe Connect nor bank details configured, so the section can silently disappear.

## Fix

Edit only `src/routes/portal.$token.tsx` (presentation). No backend / server-fn changes — `createPortalCheckout` already accepts `requestType: "deposit" | "full"` and works correctly for both timings.

### 1. Show "How to pay" preview before accept (upfront / deposit only)

For `timing === "upfront"` or `"deposit_then_balance"`, render the existing "How to pay" section as soon as the quote is opened — not only after accept. Conditions:

- `status` is `pending` / `sent` / `accepted` (i.e. not declined, not paid).
- Same `hasCard` / `hasBank` checks as today decide which sub-cards render.
- When `status !== "accepted"`, render the card with a subtle "Preview — confirm by accepting below" hint and keep the **Pay now** button enabled (tapping it accepts the quote first, then opens Checkout — see step 2). Bank transfer details are read-only info, safe to show.

For `timing === "on_completion"` keep current behaviour (only show after invoice issued).

### 2. One-tap accept-and-pay

When the customer taps the bottom-bar "Accept and pay …" button on an upfront or deposit quote:

1. `respond({ response: "accepted" })` as today.
2. If `hasCard`, immediately call `onPay(payRequestType)` so they land on Stripe Checkout without an extra tap.
3. If only `hasBank`, scroll to the bank-details card (already rendered from step 1) and flash a brief "Transfer to the details below" toast.

The existing "Pay by card" button inside the "How to pay" card gets the same accept-first behaviour when status is still pending — so the preview button in step 1 works end-to-end.

### 3. Friendly fallback when no payment method configured

If `status === "accepted"`, not paid, timing allows pay-now, and **neither** `hasCard` **nor** `hasBank` is true, render a small muted card: "Your tradesperson hasn't set up online payments yet — they'll be in touch with payment details." Today the section just disappears.

### 4. Minor

- Keep the existing `paymentTimingLabel` block in the totals card (already shows "Due on completion" / "£X upfront" / "£X deposit, balance £Y on completion") — no change.
- No DB / RLS / server-fn / token changes.

## Files

- `src/routes/portal.$token.tsx` — adjust `showPaymentOptions` gating, add accept-then-pay handler, add no-method fallback card.

## Out of scope

- Trader-side quote screen, send dialog, on-completion invoice flow, Stripe Connect onboarding UI — all already verified working in earlier audit.
