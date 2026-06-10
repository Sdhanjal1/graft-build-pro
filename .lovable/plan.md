# Customer portal payment instructions audit

## What I checked

`src/routes/portal.$token.tsx` (single quote link) and `src/routes/portal.c.$code.tsx` (multi-quote client portal) both read `quote.payment_timing`, `quote.deposit_amount`, `quote.deposit_percent` and feed them through `paymentTimingLabel()` / `acceptButtonLabel()` from `src/lib/payment-timing.ts`.

| Timing | "Payment terms" banner | Accept button | Pay-now card / bank panel |
|---|---|---|---|
| `upfront` | "£X upfront" ✅ | "Accept and pay £X" ✅ | "Pay now £total" ✅ |
| `deposit_then_balance` | "£deposit deposit (X%), balance £Y on completion" ✅ | "Accept and pay deposit £X" ✅ | "Pay deposit £X" + balance note ✅ |
| `on_completion` | "Due on completion" ✅ | "Accept quote — pay when complete" ✅ | ❌ Still shows "Pay now £total" card + bank panel immediately after accept |

## The bug

For `on_completion` quotes, once the customer hits Accept, the portal still renders the full "How to pay" section with a "Pay now £total" card button and the bank-transfer details. That contradicts the quote's own terms ("Due on completion") and the accept button's promise ("pay when complete"). The customer should only see payment instructions for `on_completion` at invoice time (i.e. once the trader has sent the final invoice / marked invoiced), not the moment they accept.

`portal.$token.tsx:166-169`:

```ts
const canPayNow =
  status === "accepted" && !isPaid &&
  (timing === "upfront" || timing === "on_completion" || timing === "deposit_then_balance") && hasCard;
const showPaymentOptions = status === "accepted" && !isPaid && (canPayNow || hasBank);
```

Both `canPayNow` and `showPaymentOptions` need `timing === "on_completion"` gated behind "invoice has been issued" (e.g. `quote.invoiced_at != null` or `status === "invoiced"`).

Secondary minor issue: when neither `deposit_amount` nor `deposit_percent` is stored, the portal falls back to 50% (line 161), but `defaultDepositPercent()` elsewhere uses 30%. Harmless today because `saveGeneratedQuote` now always writes a value, but the fallback should be `0.3` for consistency.

## The fix

### 1. Gate `on_completion` payment options behind invoice issuance

In `src/routes/portal.$token.tsx`:

```ts
const isInvoiced = !!quote.invoiced_at || status === "invoiced";
const canPayNow =
  !isPaid && hasCard &&
  (
    (timing === "upfront" && status === "accepted") ||
    (timing === "deposit_then_balance" && status === "accepted") ||
    (timing === "on_completion" && isInvoiced)
  );
const showPaymentOptions =
  !isPaid &&
  (canPayNow || (hasBank && (
    (timing !== "on_completion" && status === "accepted") ||
    (timing === "on_completion" && isInvoiced)
  )));
```

Apply the same rule in `portal.c.$code.tsx` where it renders per-quote pay panels.

For `on_completion` after accept (but before invoiced), keep the green "You accepted this quote" banner and the "Payment terms · Due on completion" card — no card/bank panel. Once invoiced, the panel reappears with "Pay now £total" / bank details as today.

### 2. Align the deposit fallback

Change `+(total * 0.5).toFixed(2)` on line 161 to `+(total * 0.3).toFixed(2)` to match `defaultDepositPercent()`.

## Files touched

- `src/routes/portal.$token.tsx` — adjust `canPayNow` / `showPaymentOptions` and the deposit fallback.
- `src/routes/portal.c.$code.tsx` — apply the same `on_completion` + invoiced gate where the per-quote pay UI is rendered.

## Out of scope

- Changing the trader-side quote detail UI.
- Reworking the payment-timing helper labels (already correct).
- Stripe Connect / bank field configuration.

## Acceptance

- Upfront quote: portal shows "£X upfront" terms, "Accept and pay £X" button, and "Pay now £X" card/bank after accept. ✅ (already correct, confirmed)
- Deposit quote: portal shows deposit terms, "Accept and pay deposit £X" button, "Pay deposit £X" card/bank + balance note. ✅ (already correct, confirmed)
- On-completion quote: portal shows "Due on completion" terms and "Accept quote — pay when complete" button. After accept, NO "Pay now" panel. Once the trader marks the quote invoiced, the "How to pay" panel appears with "Pay now £total" / bank details.
