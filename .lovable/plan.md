## Status: most of this is already shipped — one delta to add

Last turn I built the single payment-type-aware "Job done" action you described. Quick recap of what's already live on `quotes.$quoteId.tsx`, then the **one new piece** this request adds.

## What already exists (shipped last turn)

1. **One primary CTA "Job done"** on accepted quotes (and on `paid`-but-not-yet-completed for upfront), with label adapting to payment timing:
  - `on_completion` → "Job done — send invoice"
  - `deposit_then_balance` → "Job done — send £{balance} balance"
  - `upfront` / already paid → "Job done — send receipt"
2. **Confirmation AlertDialog** ("Mark done and send the £700 balance to John?") before anything runs.
3. `**jobDone()` handler** that, in order:
  - marks the job complete (`markJobComplete`),
  - issues the invoice record (`markInvoiced` + `ensureChasesFor`), **skipped** for receipt mode, which instead calls `cancelChasesFor()` so an already-paid customer never gets chase reminders,
  - auto-emails via `sendInvoiceEmailForQuote` (Resend, through the existing `invoice-email.functions` path),
  - navigates to `/invoices/$quoteId` (which already shows live email status: sent ✓ / failed / no email).
4. **Result toasts**: "Invoice emailed to {first}" / "Receipt emailed to {first}" / fallback to WhatsApp toast / "No email or phone — share manually".
5. **Mark as paid demoted** — removed from the primary CTA except for the cash/bank-outside-the-app case (status=`completed` and not paid). Still available in More actions → Payments.
6. `**buildJobDoneMessage(quote, first, mode, amount, depositPaid)**` in `user-data.ts` produces three message variants:
  - `invoice` → delegates to `buildInvoiceMessage` (full total),
  - `balance` → "balance of £X due (deposit of £Y received, thank you)" + bank/card details,
  - `receipt` → "All paid — thank you", **no** bank details, **no** payment link, **no** ask.
7. All existing auto flows untouched: customer accept push, Stripe card webhook auto-mark-paid + receipt email, the `markPaid` cash/bank handler still triggers `sendInvoiceEmailFn` so manual cash-paid quotes also get an email.

## Delta to add now

Your new ask: when email IS on file and the auto-email goes out, **also surface a WhatsApp backup share** so the trader can nudge the customer through their preferred channel. Today my impl only opens WhatsApp when there's no email. Two small changes do it:

1. **After a successful auto-email**, instead of just a toast, show a **persistent post-send sheet** with:
  - "✓ Invoice/Receipt emailed to {client.email}"
  - Secondary button: **"Also share on WhatsApp"** (only if `client.phone` exists) — opens `waLink` with the same `buildJobDoneMessage` body.
  - Secondary button: **"View invoice"** → navigates to `/invoices/$quoteId`.
  - Primary "Done" closes the sheet.
2. **When email fails or is skipped**, the same sheet shows:
  - "⚠ Email didn't send" / "No email on file"
  - Primary button: **"Send via WhatsApp"** (one-tap) — opens WhatsApp with the prefilled message.
  - Link: "View invoice" (where the user can retry the email via the existing Resend button).

The sheet replaces the current fire-and-forget toast + auto-navigate. After it closes (or via "View invoice"), the trader lands on the invoice screen — same destination, just with the explicit channel choice surfaced.

### Files to touch (delta only)

- `src/routes/quotes.$quoteId.tsx`:
  - Add `jobDoneResult` state (`{ mode, emailedTo, emailFailed, message } | null`).
  - In `jobDone()`, replace the toast + immediate `navigate(...)` with `setJobDoneResult(...)`.
  - Add a `Sheet` (use the existing `@/components/ui/sheet` like the deposit sheet does) with the two-state UI above.
  - WhatsApp button calls `window.open(waLink(client.phone, message), "_blank")`.

No backend, DB, server-fn, webhook, email-template or invoice-screen changes — this is a pure UI delta on the already-built action.

## Out of scope

- No changes to `payment_timing`, `markJobComplete`, `markInvoiced`, `markQuotePaid`, the Resend send path, or the Stripe webhook.
- No changes to `invoices.$quoteId.tsx` — its existing email-status banner + "Resend" button already covers the "Email failed — try again" case.

Confirm and I'll ship just the post-send sheet delta.

Approved. Two confirmations:

1. For the email-sent case, make the sheet feel like a clean confirmation, not an extra task — a single obvious "Done" to close, with WhatsApp clearly *optional* (the email already went). It shouldn't read as "now pick a channel" when the email's already sent.
2. Gate the "✓ Invoice emailed to {email}" message on the ACTUAL Resend success response — if the send fails, show the failure/WhatsApp state, never a false "emailed ✓".  
Everything else — the two-state sheet, WhatsApp backup, View invoice, the already-shipped jobDone flow — approved. Ship it.