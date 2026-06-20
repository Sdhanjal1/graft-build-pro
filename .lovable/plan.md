## Goal

After a quote is `accepted` (or `paid` upfront), the trader sees ONE primary button: **Job done**. Tapping it:

1. Marks the job complete (`status = completed`, `completed_at`).
2. Sends the right thing to the customer based on `payment_timing`:
  - `on_completion` → final invoice for the full total (WhatsApp link + email if on file).
  - `deposit_then_balance` → balance invoice for `total − depositPaid`.
  - `upfront` → "Paid in full — thank you" receipt, no payment ask.
3. Issues the invoice record (`markInvoiced`) so chases + the invoice screen wire up, except in the upfront/receipt case where it issues a receipt-only invoice (still calls `markInvoiced` so a clean PDF exists, but the share message is a thank-you, not a payment request).

Existing automatic flows (customer accept, Stripe card webhook auto-mark-paid + receipt email, push notify) are untouched.

## UX flow on `quotes.$quoteId.tsx`

Primary CTA matrix (replaces the current `status === "accepted" → Mark job complete`, `completed → Mark paid`, `paid → Share receipt` chain):


| Status before tap                        | Payment timing                              | Primary button                                          | Confirmation copy                                                                |
| ---------------------------------------- | ------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| accepted                                 | on_completion                               | **Job done — send invoice**                             | "Mark done and send the £{total} invoice to {first}?"                            |
| accepted                                 | deposit_then_balance                        | **Job done — send balance**                             | "Mark done and send the £{balance} balance to {first}?" (shows deposit credited) |
| accepted                                 | upfront (rare — paid but not yet completed) | **Job done — send receipt**                             | "Mark done and send {first} a paid-in-full receipt?"                             |
| paid (upfront, already paid before work) | any                                         | **Job done — send receipt**                             | same as above                                                                    |
| completed                                | —                                           | **Mark paid (cash/bank)** (fallback, secondary styling) | unchanged                                                                        |
| paid + completed                         | —                                           | **Share receipt / invoice**                             | unchanged                                                                        |


Confirmation = an `AlertDialog` (same component as existing confirms) with one bold "Yes, do it" button + Cancel. No second sheet.

## "Mark as paid" stays — but demoted

- Removed from primary CTA except when status is `completed` AND not paid (the cash/bank-outside-app case).
- Still available in the "More actions → Payments" accordion as **Mark paid (cash / bank)** so off-platform payments can be recorded.
- The existing `askingPaid` sheet (cash/bank/card chooser) is reused unchanged.

## Implementation

### 1. New combined handler in `src/routes/quotes.$quoteId.tsx`

Add `jobDone()` that runs sequentially:

```
const balance = timing === "deposit_then_balance"
  ? Math.max(0, quote.total - depositPaid)
  : quote.total;
const mode: "invoice" | "balance" | "receipt" =
  timing === "upfront" || status === "paid" ? "receipt"
  : timing === "deposit_then_balance" ? "balance"
  : "invoice";

await markJobComplete(quote.id);        // skip if already completed
const inv = await markInvoiced(quote.id); // idempotent; gives invoice_due_date
ensureChasesFor(inv);                    // skip for receipt mode
// Open WhatsApp draft with the right message; mailto fallback if no phone.
window.open(waLink(client.phone, buildJobDoneMessage(liveQuote, client.first, mode, balance)), "_blank");
toast.success(mode === "receipt" ? "Job done. Receipt ready to send." : "Job done. Invoice sent.");
```

Then route the user to `/invoices/$quoteId` (the invoice screen already shows email status + resend).

### 2. New message builder in `src/lib/user-data.ts`

`buildJobDoneMessage(quote, firstName, mode, amount)`:

- `invoice` → existing `buildInvoiceMessage` (full total).
- `balance` → variant that says "balance of £X due (deposit of £Y received, thank you)" + payment instructions.
- `receipt` → "All paid — thank you. Your receipt is attached / at this link." NO payment block, NO bank details, NO Stripe link.

### 3. Primary CTA wiring (lines 551–575)

Replace the `accepted`/`completed`/`paid` branches with the matrix above. Use existing `timing`, `status`, `depositPaid`, `configuredDeposit` already in scope. Confirmation alert state: `const [confirmJobDone, setConfirmJobDone] = useState(false)`.

### 4. Remove the now-redundant "Ready to send final invoice?" sheet (`askInvoice`, lines 1172–1192) and its trigger from `markPaid` (line 347). After Stripe card payment, the existing webhook + invoice-email already handle delivery, so no extra prompt is needed.

### 5. Keep all of: `acceptQuote` auto-prompt-deposit, Stripe webhook auto-mark-paid + invoice email, push notifications, `markUnpaid`, deposit recording, "Send a payment link", "Take payment now" on-site.

## Out of scope

- No DB migration (uses existing `status`, `completed_at`, `invoiced_at`, `payment_timing`, `deposit_amount`).
- No changes to portal, webhooks, or email infrastructure.
- No copy changes to the invoice screen itself.

## Files touched

- `src/routes/quotes.$quoteId.tsx` — new `jobDone()`, new confirm dialog, updated primary CTA matrix, remove `askInvoice` sheet, keep "Mark paid" in More actions only.
- `src/lib/user-data.ts` — add `buildJobDoneMessage` (balance + receipt variants).

Confirm and I'll build it. - also note - Strong plan, approved with these changes:

1. **Add the auto-email — it's missing.** The `jobDone()` handler currently only opens WhatsApp. As specified, when the customer has an email on file, it must AUTOMATICALLY send the invoice/receipt via Resend (`sendInvoiceEmail`) — no manual step — and surface "Invoice emailed to {first} ✓". WhatsApp share should be the fallback for phone-only customers, or an optional secondary button when email was used. Do NOT auto-open WhatsApp when the email has already been sent automatically.
2. Confirm the **receipt mode never triggers payment chases** (you noted skip-for-receipt — make it bulletproof; an already-paid customer must never get chase reminders).
3. Handle the **no-email-no-phone** edge case gracefully: mark complete, generate the PDF, tell the trader "no contact on file — share manually" rather than erroring.
4. Removing the "Ready to send final invoice?" sheet — approved.
5. Everything else (CTA matrix, confirmation dialog, demoting Mark-as-paid to More actions, keeping the automatic accept/card-webhook/notify flows) — approved as written.

Rebuild the plan with the auto-email included and confirm before building.

&nbsp;