## Why the deposit isn't being marked paid automatically

Short version: **Quottr never hears about the payment.** The customer's card does charge on the trader's connected Stripe account, but the event that tells our app "this deposit was paid" is never delivered to our webhook, so the `invoice_payments` row stays `pending` and the "deposit received / balance due" calculation on the invoice never flips.

### How it's supposed to work

```text
Customer pays deposit on portal
        │
        ▼
Stripe Checkout Session created WITH Stripe-Account header
   (direct charge on the trader's connected account)
        │
        ▼
Card is charged on the CONNECTED account (not the platform)
        │
        ▼
Stripe fires checkout.session.completed
   ── on the CONNECTED account, NOT the platform account ──
        │
        ▼
Delivered to a Connect (connected-account) webhook endpoint
        │
        ▼
/api/public/payments/connect-webhook?env=sandbox
        │
        ▼
handlePaidEvent → invoice_payments.status = 'paid'
        │
        ▼
Invoice UI recomputes: deposit paid £X, balance £Y due
```

### Where it's actually breaking

Every step up to "Stripe fires the event" is working. The break is at delivery:

1. `stripe_connect_charges_enabled = true` on the trader → checkout is created on the connected account (confirmed).
2. The `invoice_payments` row exists with a `cs_test_…` session id and status `pending` (confirmed — this is the row that should flip to `paid`).
3. **No POST from Stripe** to `/api/public/payments/connect-webhook` appears in the preview's runtime logs — only the manual health GET. So nothing called `handlePaidEvent`.
4. No `payments.connect_webhook.no_secret` and no `payments.connect_webhook.invalid_signature` rows in `error_events` since the attempt. That rules out "secret missing" and "signature mismatch" — both of those would have logged. The endpoint simply isn't being hit.
5. The handler code itself is correct: it verifies the signature, then routes `checkout.session.completed` and `payment_intent.succeeded` into the same shared `handlePaidEvent` that the platform webhook uses. If a real Stripe POST arrived with a matching secret, the row would flip.

### Why the deposit math depends on this

The invoice's "deposit received · £Y still due" badge is computed from `invoice_payments` rows for that quote where `status = 'paid'`. As long as the row stays `pending`, the invoice considers the deposit unpaid and shows the full balance. There is no other place in the app that marks deposits paid automatically — the only automatic path is the webhook. (The one "paid" deposit row that exists for QTR-001 has no `stripe_session_id` and no `stripe_payment_intent`, which means it was recorded manually, not by Stripe.)

### What's actually missing

A **test-mode Connect webhook endpoint registered in Stripe** that:

- points at the same preview host the checkout session was created from
- URL: `https://<preview-host>/api/public/payments/connect-webhook?env=sandbox`
- listens on **"Events on Connected accounts"** (not the platform account)
- subscribes to at least: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.expired`, `account.updated`
- has its signing secret stored as `STRIPE_CONNECT_SANDBOX_WEBHOOK_SECRET` (already present in secrets)

Without that endpoint registered on the connected-account scope, Stripe has nowhere to send the event, so it's never delivered — which is exactly the silence we see in logs.

### Recommendation (no code changes needed)

This is a Stripe-dashboard configuration task, not a code change. The handler, the secret, the trader's Connect status, and the checkout flow are all correct. The next action is to register the test Connect webhook on the correct preview host with the event list above, then re-run a deposit on QTR-001 and confirm:

- a POST to `/api/public/payments/connect-webhook?env=sandbox` shows in preview logs
- the `invoice_payments` row for that session flips from `pending` to `paid`
- the invoice UI then shows "deposit received · balance £Y due"

If after registering the endpoint we still see no POST in our logs, the next thing to check is whether the preview host the customer paid from matches the host configured on the webhook — a mismatch there is the most common cause of silent non-delivery for Connect webhooks.