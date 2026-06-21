## Two bugs in one

### Bug 1 — Duplicate push when both Stripe events arrive

`handlePaidEvent` (`src/lib/payments-webhook-shared.server.ts`) is called for both `checkout.session.completed` and `payment_intent.succeeded`. Each carries a **different** `stripe_event_id`, so the audit-row gate at line 116 doesn't dedupe across them — it only blocks same-event retries.

The downstream dedup is **order-dependent**:

- If `checkout.session.completed` arrives first → row inserted with `stripe_session_id`. PI event then lands in the `paymentIntent` branch, finds the existing row, early-returns at line 201. ✅
- If `payment_intent.succeeded` arrives first → row inserted with `stripe_payment_intent` only (no session id). CS event then runs the `sessionId` branch (line 146), looks up by `stripe_session_id`, finds nothing → **inserts a second paid row** → falls through to email + `notifyTraderOfPayment` → trader gets two pushes (and two emails).

**Fix:** before the session-id insert branch, also check for an existing row by `stripe_payment_intent`. If one exists, treat it as the existing row (update it with the session id, skip notify/email).

```ts
// inside the `if (sessionId)` branch, before "if (existing) { ... } else { insert }"
let existing = (await supabaseAdmin
  .from("invoice_payments").select("id")
  .eq("stripe_session_id", sessionId).maybeSingle()).data;

if (!existing && paymentIntent) {
  const fallback = await supabaseAdmin
    .from("invoice_payments").select("id")
    .eq("stripe_payment_intent", paymentIntent).maybeSingle();
  if (fallback.data) {
    // Backfill the session id on the PI-first row and short-circuit
    await supabaseAdmin.from("invoice_payments")
      .update({ stripe_session_id: sessionId, status: "paid", paid_at: new Date().toISOString() })
      .eq("id", fallback.data.id);
    return; // email + push already fired (or will fire when row was created)
  }
}
```

The same early-return semantics already used in the PI-only branch (line 201).

### Bug 2 — Personalised notification

Current copy: `"Paid. That's in the bank. 💰"` / `"{title} · £{amount}"`.

In `notifyTraderOfPayment`, also pull the client's first name and the request type so the push reads like a human update.

- Fetch `clients(first_name, last_name)` alongside the quote (`quotes.client_id → clients`).
- Derive `who` = first name, falling back to `"Customer"`.
- Derive `what`:
  - `requestType === "deposit"` → `"paid the deposit"`
  - `requestType === "balance"` → `"paid the balance"`
  - else → `"paid"`
- New copy:
  - **title:** `` `${who} just ${what} · £${amount} 💰` ``
  - **body:** `quote.title ?? quote.ref ?? "Invoice"` (job name on its own line gives context without repeating the amount)

Pass `requestType` from `handlePaidEvent` into `notifyTraderOfPayment` (currently not threaded through). Keep the `tag: quote-${quoteId}-paid` for the OS-level collapse so a deposit push and a later balance push don't stack stale — actually switch `tag` to include `requestType` (`quote-${quoteId}-${requestType}`) so deposit and balance notifications coexist instead of overwriting each other.

### Files touched

- `src/lib/payments-webhook-shared.server.ts` — dedup fallback + thread `requestType` through + rewrite `notifyTraderOfPayment` (client lookup, copy, tag).

### Out of scope

- Email copy (handled separately by `sendBrandedInvoiceEmail`).
- Connect webhook path — same shared handler, gets the fixes automatically.
- Notification preferences / muting.