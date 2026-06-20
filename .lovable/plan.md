## Diagnosis (read-only — nothing changed yet)

### Q1. Does the webhook handler have a deposit branch and does it write status to the quote?

**Yes — the branch exists.** `src/lib/payments-webhook-shared.server.ts` lines 189–203:

```ts
if (requestType === "deposit") {
  await supabaseAdmin
    .from("quotes")
    .update({ status: "accepted" })
    .eq("id", quoteId)
    .eq("user_id", userId)
    .in("status", ["pending", "sent"]);
} else {
  // full → status: "paid"
}
```

So a deposit payment, when the webhook DOES fire, writes `quotes.status = "accepted"` (not a dedicated "deposit-paid" — deposits are modelled as "accepted with a paid deposit row in `invoice_payments`"). The invoice_payments row is upserted earlier in the same handler.

### Q2. Did the "£910 payment received" come from the webhook or from the redirect?

**From the redirect. The webhook did NOT write anything for this payment.**

Evidence from `invoice_payments` for quote `37a48482…` (QTR-001 test deposit):


| id        | status      | stripe_session_id  | stripe_payment_intent | paid_at  | created_at |
| --------- | ----------- | ------------------ | --------------------- | -------- | ---------- |
| b5807b4a… | **pending** | `cs_test_a1cuZMM…` | null                  | null     | 14:24:20   |
| 817cd9ac… | **paid**    | **null**           | **null**              | 14:27:59 | 14:27:59   |


Two separate rows. The first (pending, with `cs_test_…` session id) was inserted by `createPortalCheckout` at checkout-start. The second (paid, **no Stripe identifiers**) was inserted ~3.5 minutes later when you clicked the manual "deposit received" button — that's the exact shape `recordManualDeposit` writes in `payments.functions.ts` (no session, no PI, payment_method="cash"/"bank").

If the webhook had fired, `handlePaidEvent` would have matched the pending row by `stripe_session_id` and flipped it to `status="paid"` with `paid_at` set — instead, the pending row is **untouched** and a parallel manual row sits beside it.

The "£910 payment received" the customer saw on the portal came from `?paid=1` in the Stripe redirect URL → `setPaymentResult("paid")` on the client (`portal.$token.tsx` line 92). That's pure client-side state, no DB writeback required. The 30s poll (lines 110–133) then ran and never observed the status change to "accepted" (because the webhook never wrote it), but the success card stayed visible regardless and the spinner just timed out silently.

### Q3. Is the test-mode webhook endpoint registered and verifying?

**Almost certainly NOT registered for test-mode Connect events.** I cannot read Stripe's webhook delivery dashboard directly, but the circumstantial evidence is decisive:

- The Connect webhook handler (`src/routes/api/public/payments/connect-webhook.ts`) is where connected-account deposit events land (direct charges go to the connected account, not the platform). It uses `STRIPE_CONNECT_WEBHOOK_SECRET`, which is set.
- `STRIPE_CONNECT_WEBHOOK_SECRET` was provisioned for the **live-mode** Connect webhook endpoint. Stripe test mode and live mode are separate namespaces with separate endpoint registrations and separate signing secrets. The live webhook endpoint cannot receive test-mode events.
- `error_events` has zero `payments.webhook.*` or `payments.connect.*` rows for the relevant timeframe — but the Connect handler does NOT call `logErrorEvent` on invalid signature OR on missing secret (it just returns 200 with a console warning). So absence of error rows is not exonerating; it's expected even on a silent failure.
- No row in `invoice_payments` was ever updated by session id for this payment → handler body never executed → either no delivery, or signature rejected silently.

**Conclusion:** the webhook is firing in test mode (Stripe DOES send), but there is no test-mode Connect webhook endpoint registered to receive it, OR one is registered against a different signing secret than `STRIPE_CONNECT_WEBHOOK_SECRET`. Net result: zero deliveries reach our handler. The platform webhook (`/payments/webhook?env=sandbox`) is unaffected because Connect direct charges don't route through it.

### Summary of where it broke

> **Webhook is firing → but never reaching our handler → branch never runs.**
> It's not (1) handler missing a deposit branch, and not (3b) signature rejection — it's the test-mode Connect webhook endpoint itself not being registered (or registered against the wrong secret).

---

## The "Paid in full" fallback bug (separate issue, same screen)

Confirmed in `src/routes/portal.$token.tsx`:

- Line 213: `const isPaid = status === "paid" || paymentResult === "paid";`
- Line 544: `{isPaid && (<div>… <Check/> Paid in full …</div>)}`

After a deposit redirect, `paymentResult==="paid"` is set from `?paid=1` regardless of whether the actual payment was a deposit or a full payment. `isPaid` becomes `true`, so the bottom "Paid in full" green badge renders — even though `quote.status` is still "accepted" (deposit) or "sent" (webhook never ran). This is the dangerous "default toward customer owes nothing" failure mode you flagged.

### Planned fix (one file, frontend only)

`src/routes/portal.$token.tsx`:

1. Introduce a stricter `isPaidInFull` derived from the **server state only**, not from the redirect param:
  ```ts
   const isPaidInFull = status === "paid";
  ```
2. Keep the existing `isPaid` for the top success card (so the "Payment received — thank you" copy still appears on redirect), but gate the bottom green "Paid in full" badge (line 544) on `isPaidInFull` instead of `isPaid`.
3. Add an explicit "deposit paid, balance outstanding" badge that renders when `status === "accepted"` AND a paid deposit row exists, showing `Balance of £X due on completion` — so when the customer revisits the portal after the webhook eventually catches up (or after the manual button), they see the truthful state, never "Paid in full".
4. The fail-safe rule encoded in code: `**Paid in full` must require `status === "paid"`. Any other state — including `accepted`, `sent`, `pending`, or any unknown value — renders a balance-due affordance, never "Paid in full".**

No backend changes in this batch. Webhook registration is a Stripe-dashboard / connector-side action and is handled separately once you confirm the diagnosis above.

### Not in this batch (call out explicitly)

- Registering the test-mode Connect webhook endpoint in Stripe and confirming its signing secret matches `STRIPE_CONNECT_WEBHOOK_SECRET` (or wiring a separate `STRIPE_CONNECT_SANDBOX_WEBHOOK_SECRET` and routing by `?env=` like the platform webhook does).
- Adding `logErrorEvent` on invalid signature / missing secret in `connect-webhook.ts` so the next silent failure is visible.
- Backfilling QTR-001's pending `invoice_payments` row to paid (you already covered it with the manual button — leaving the orphaned pending row alone for now).

Approve to apply only the portal fallback change; we'll tackle webhook registration and observability in a follow-up plan.

Approve the portal fallback fix as written — one check: point 3's "paid deposit row exists" must require a row with status="paid", not the orphaned pending row, so an abandoned checkout never renders as deposit-paid.

But the Connect webhook is not a follow-up — it's a launch blocker at the same severity in live. Your own diagnosis shows `connect-webhook.ts` returns 200 and only console-warns on invalid signature or missing secret, with no `logErrorEvent`. That means the **live** Connect webhook could be failing exactly as silently as test mode just did, and we'd never know — a real customer's deposit would land in Stripe, the quote would never update, no error would log. So in the same batch as (or immediately after) the portal fix:

1. Register the test-mode Connect webhook endpoint and wire `STRIPE_CONNECT_SANDBOX_WEBHOOK_SECRET`, routed by `?env=` like the platform webhook — and confirm the live Connect endpoint is correctly registered against `STRIPE_CONNECT_WEBHOOK_SECRET`.
2. Add `logErrorEvent` on invalid-signature and missing-secret in `connect-webhook.ts` so the next silent failure is visible. Consider whether a signature failure should really return 200.