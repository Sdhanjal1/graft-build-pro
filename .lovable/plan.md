# Portal: collapse the deposit-paid story to one card + one button

Display-only changes to `src/routes/portal.$token.tsx`. No `onPay`, webhook, or payment logic touched.

## 1. Top "Payment received" card (~line 348)

No changes. Gating stays `paymentResult === "paid"`.

## 2. Mid "Deposit paid" strip (~line 617)

- Condition becomes `!isPaidInFull && hasPaidDeposit && paymentResult !== "paid"` so it can't render alongside the top card.
- Remove the inner "Pay balance" button (lines 626-636). Strip becomes header-only: green check + "Deposit paid" + "Balance of £Y due on completion."

## 3. Bottom sticky bar (~line 649)

Reorder the branch chain inside `canRespond ? ... : ...` so the deposit case is matched before the generic accepted pill, and add the Pay-balance action there:

```
canRespond
  → accept/decline buttons (unchanged)
isPaidInFull
  → "Paid" pill (unchanged copy/styling)
hasPaidDeposit && !isPaidInFull
  → if hasCard && balanceAmount > 0:
       <button onClick={() => onPay("balance")}> lime "Pay balance £Y"
         (same h-12 rounded-full bg-lime styling as the accept button,
          with Loader2 when `paying`, CreditCard icon otherwise)
     else:
       <div> "Deposit paid · £Y due on completion" pill (current copy)
status === "accepted"
  → "Accepted" pill (unchanged) — only reached for accepted-but-unpaid
else
  → "Declined" pill (unchanged)
```

The current `isPaid` branch collapses into the two cases above (`isPaidInFull` and `hasPaidDeposit && !isPaidInFull`), so the `isPaid` check is removed from the chain.

`showBottomBar` is not modified — deposit-paid re-opens already satisfy it via `status === "accepted"`, so the bar continues to render.

## Net result

- Top "Payment received" card: only at Stripe return moment.
- Mid "Deposit paid" strip: persistent state card, text-only.
- Sticky bar: the single Pay-balance entry point, present on both the just-paid moment and every re-open.

## Files touched

- `src/routes/portal.$token.tsx` (only)

Amendment to the bottom sticky bar (section 3): do NOT simply remove the

`isPaid` check. Removing it lets the "just returned from Stripe, webhook not

yet written back" state (paymentResult === "paid" but status still "sent"/

"accepted") fall through to the "Accepted" or "Declined" pill — showing

"Declined" on a job the customer just paid. Keep a paymentResult guard.

Corrected branch chain:

canRespond

  → accept/decline buttons (unchanged)

paymentResult === "paid" && !isPaidInFull && !hasPaidDeposit

  → "Confirming payment…" pill (Loader2 + "Payment received" or neutral

     processing copy) — the brief pre-writeback window. Do NOT show Declined.

isPaidInFull

  → "Paid" pill (unchanged)

hasPaidDeposit && !isPaidInFull

  → if hasCard && balanceAmount > 0: lime "Pay balance £Y" button → onPay("balance")

       (h-12 rounded-full bg-lime, Loader2 when `paying`, CreditCard icon otherwise)

     else: "Deposit paid · £Y due on completion" pill (current copy)

status === "accepted"

  → "Accepted" pill (unchanged) — accepted-but-unpaid only

else

  → "Declined" pill (unchanged)

Everything else in the plan (sections 1, 2, mid-strip guard, showBottomBar

untouched) is correct as written.