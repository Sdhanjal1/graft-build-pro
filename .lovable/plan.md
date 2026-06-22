## Root cause

`handlePaidEvent` is called from **both** webhook endpoints (platform `webhook.ts` and `connect-webhook.ts`) and is matched by **three** event types: `checkout.session.completed`, `payment_intent.succeeded`, and `transaction.completed`. A single card payment normally fires **two distinct Stripe events** (session.completed + payment_intent.succeeded), each with a different `stripe_event_id`, so the audit-table UNIQUE gate on `stripe_event_id` does **not** dedupe them.

There IS a secondary gate (`priorReceipt` lookup by `stripe_payment_intent` in `payment_webhook_audit`), but it has two holes:

1. **Race window.** It's a SELECT-then-INSERT pattern. The two events typically arrive within ~100 ms; both pass `priorReceipt is null` before either has finished sending and stamping `receipt_status='sent'`. Both then send the receipt email and call `notifyTraderOfPayment` → 2 emails, 2 pushes.
2. **Push isn't gated at all.** `priorReceipt` only short-circuits the function when an existing `invoice_payments` row is found AND receipt was previously stamped. On the first-ever delivery the code falls through to email + push without a per-`(quote_id, request_type)` lock.

A third compounding source: when Stripe Connect is wired, the platform webhook and the connect webhook can both receive the same checkout completion for direct charges — same PI, different event IDs, same race.

## Fix

Move dedupe from "by stripe_event_id" to "by side-effect already performed for this `(quote_id, request_type)`" — and gate **both** the email and the push behind it, using a DB-level atomic claim so concurrent deliveries can't both win.

### Steps

1. **Add a unique partial index** on `payment_webhook_audit` so only one row per `(quote_id, request_type)` can have `receipt_status='sent'`:
   ```sql
   CREATE UNIQUE INDEX payment_webhook_audit_receipt_once
     ON public.payment_webhook_audit (quote_id, request_type)
     WHERE receipt_status = 'sent';
   ```
   This is the durable lock — even across two webhook endpoints and two event types, only one row can flip to `sent`.

2. **Atomic claim in `payments-webhook-shared.server.ts`** (just before the email send around line 396):
   - Before sending, attempt `UPDATE payment_webhook_audit SET receipt_status='sending' WHERE id = auditRowId AND receipt_status IS NULL RETURNING id`. If no row returned, we lost the race — skip both email and push and return.
   - After successful send, `UPDATE ... SET receipt_status='sent'`. The unique partial index then blocks any sibling event from also reaching `sent`.
   - If the send fails, revert to `NULL` (or stamp `'failed'`) so a future retry can re-attempt.

3. **Gate `notifyTraderOfPayment` behind the same claim.** Move the push call to only fire when the email-claim attempt actually won. This is the line that's currently firing twice.

4. **Tighten the `priorReceipt` check** to also look up by `(quote_id, request_type)` (not just `stripe_payment_intent`), so the cheap short-circuit catches the platform-vs-connect-webhook case where PIs could differ in edge cases (e.g. Connect destination charges with separate platform/connect event PIs).

5. **No changes** to `invoice_payments` insert logic, quote-status flips, or the audit row insert itself — those are already idempotent.

### Files touched

- `supabase/migrations/<new>.sql` — the unique partial index.
- `src/lib/payments-webhook-shared.server.ts` — atomic claim + gated push + broadened `priorReceipt` lookup.

### Verification

- Typecheck.
- Manual: trigger a sandbox card payment in the preview and confirm the trader receives exactly one push and one invoice email. Inspect `payment_webhook_audit` to see one row stamped `receipt_status='sent'` and the sibling row left `NULL` or `'skipped'`.
- Spot-check `invoice_email_status` on the quote — should be `sent` once, with one `invoice_email_sent_at`.

### Out of scope

- No change to subscription billing or failed-payment paths.
- No change to client-facing portal/PDF rendering.
- No change to the email template or push payload.
