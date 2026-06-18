# Auto-accept on deposit + sandbox webhook test

## Scope

You confirmed:

- Billing settings: keep as-is (already wired in Settings → Account & billing).
- Webhook quote status: add **auto-mark `accepted` when a deposit is paid**; everything else already works.
- Verification: scripted sandbox end-to-end test against the webhook handler.

## 1. Auto-mark `accepted` on deposit payment

In `src/lib/payments-webhook-shared.server.ts`, inside `handlePaidEvent`, the current `requestType !== "deposit"` block flips the quote to `paid`. Add the deposit branch right after it:

```ts
if (requestType === "deposit") {
  // Treat a successful deposit as implicit client acceptance.
  // Don't overwrite a quote that's already further along
  // (paid / completed / cancelled).
  try {
    await supabaseAdmin
      .from("quotes")
      .update({ status: "accepted" })
      .eq("id", quoteId)
      .eq("user_id", userId)
      .in("status", ["draft", "sent", "viewed"]);
  } catch (e) {
    console.error("[payments/webhook] failed to mark quote accepted", e);
  }
}
```

The `.in("status", […])` guard makes the update idempotent and avoids regressing a quote that's already `accepted` or `paid` (Stripe retries the same event multiple times).

I'll first run a quick `select distinct status from quotes` so the allow-list matches the real status vocabulary in this DB — if the project uses different intermediate states (e.g. `pending`), I'll widen the list accordingly before shipping.

## 2. Sandbox end-to-end webhook test

I can't run a real live card charge from here (it would charge a real card real money), so the verification is a scripted sandbox round-trip against the deployed webhook endpoint. Three signed POSTs hitting `https://project--e4be6907-c837-4e5e-9461-63fadfdad91e.lovable.app/api/public/payments/webhook?env=sandbox`, each carrying a valid Stripe-style `stripe-signature` header computed with `PAYMENTS_SANDBOX_WEBHOOK_SECRET`:

1. **Seed** — insert a throwaway `quotes` row owned by my signed-in user with `status='sent'`, capture its id.
2. **Deposit paid** — POST a synthetic `checkout.session.completed` event with `metadata.quote_id`, `metadata.user_id`, `metadata.request_type='deposit'`. Re-read the quote and assert `status === 'accepted'` and a matching `invoice_payments` row exists with `status='paid'`.
3. **Full paid** — POST a second `checkout.session.completed` with `request_type='full'` and a different `session_id`. Assert the quote flips to `paid` and a second `invoice_payments` row lands.
4. **Idempotency** — replay event #2 a second time. Assert no duplicate `invoice_payments` row (dedup by `stripe_session_id`) and the quote stays `paid`.
5. **Cleanup** — delete the seeded `invoice_payments` and `quotes` rows.

The script will live at `/tmp/webhook-e2e.ts` (not committed), reads `PAYMENTS_SANDBOX_WEBHOOK_SECRET` from project env, and prints pass/fail per step. I'll report the assertions back to you.

## Files

- `src/lib/payments-webhook-shared.server.ts` — add deposit → accepted branch.

That's the only code change; everything else (Billing Portal button, webhook signature verification, paid-row write, branded invoice email, push notification, subscription lifecycle) is already in place.

## Out of scope

- New `/billing` route — you said keep as-is.
- Overdue cron — you said paid flow is enough.
- Real live card test — would mean charging a real card; I can't safely do that for you. If you want, after the sandbox test passes you can run one £1 quote yourself end-to-end and I'll tail logs in real time.

**Two confirmations to send back:**

1. **Confirm the** `accepted` **status flip doesn't break anything downstream.** Adding a new `accepted` state into the quote lifecycle — make sure nothing in the UI or other logic assumes a quote goes straight `sent → paid` and chokes on an intermediate `accepted`. Ask Lovable: "does anything in the app's quote-status handling not account for an `accepted` state, now that deposits will produce it?" You don't want a quote in `accepted` to render oddly or break a filter.
2. **The allow-list should probably include** `accepted` **itself getting overwritten by full payment.** When a deposit flips it to `accepted`, then the customer pays the balance, the `full` branch flips it to `paid`. Confirm the `full`/`paid` branch's own status guard *allows* `accepted` → `paid` (the deposit case), or a deposited-then-fully-paid quote could get stuck at `accepted`. Worth checking the full-payment branch's guard, not just the deposit one.