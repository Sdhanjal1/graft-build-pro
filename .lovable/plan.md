
# Fix 1 — Connect payments never mark quotes as paid

**Root cause.** `payments.functions.ts` creates Checkout sessions as **direct charges on the connected account** once Connect is live (`Stripe-Account` header set). For direct charges, `checkout.session.completed` / `payment_intent.succeeded` are delivered to the **connected-account** endpoint (`/api/public/payments/connect-webhook`, verified with `STRIPE_CONNECT_WEBHOOK_SECRET`). That handler today only processes `account.updated` and silently 200s every payment event, so no `invoice_payments` row is updated, no `quotes.status = 'paid'` flip, no invoice email, no trader push. The platform `webhook.ts` (which has all the paid-marking logic) never sees these events.

## Changes

### a) Extract paid/failed handlers into a shared server module

New file: `src/lib/payments-webhook-shared.server.ts`

Exports:
- `handlePaidEvent(evt: any): Promise<void>` — contains the current `webhook.ts` block (~lines 352–462): identifier extraction, `metadata.kind === "quottr_subscription"` skip, `invoice_payments` upsert-by-session-id (with payment-intent fallback insert), `quotes.status = 'paid'` flip when `request_type !== "deposit"`, best-effort `sendBrandedInvoiceEmail`, best-effort `notifyTraderOfPayment`.
- `handleFailedEvent(evt: any): Promise<void>` — contains the existing `payment_intent.payment_failed` / `checkout.session.expired` block that flips the pending `invoice_payments` row to `failed` / `expired` by `stripe_payment_intent`.

Pure extraction — no logic, ordering, error-swallowing, or query change. Imports `supabaseAdmin`, `sendBrandedInvoiceEmail`, `notifyTraderOfPayment` from their current locations.

### b) Slim down `webhook.ts`

Replace the inlined paid block (lines ~352–462) with `await handlePaidEvent(evt); return new Response("ok", { status: 200 });` and replace the failed/expired block with `await handleFailedEvent(evt); return new Response("ok", { status: 200 });`. Subscription handling, signature verification, GET health check — unchanged.

### c) Wire payment events into `connect-webhook.ts`

After the existing `account.updated` branch, add:

```ts
if (type === "checkout.session.completed" || type === "payment_intent.succeeded") {
  console.log("[connect-webhook]", type, "account:", evt.account);
  await handlePaidEvent(evt);
  return new Response("ok", { status: 200 });
}
if (type === "payment_intent.payment_failed" || type === "checkout.session.expired") {
  console.log("[connect-webhook]", type, "account:", evt.account);
  await handleFailedEvent(evt);
  return new Response("ok", { status: 200 });
}
```

Signature verification, `STRIPE_CONNECT_WEBHOOK_SECRET` usage, and `account.updated` logic unchanged. Idempotency comes for free from the existing upsert-by-session-id pattern.

### d) Out of scope

`payments.functions.ts` fee/session logic, subscription event handling, signature verification in either webhook.

## Acceptance

1. Platform `webhook.ts` behaviour byte-equivalent to today.
2. A Connect `checkout.session.completed` with `metadata.quote_id`/`user_id`/`request_type=full` → `invoice_payments` paid, `quotes.status = 'paid'`, email + push attempted, errors swallowed.
3. `request_type=deposit` → payment row updated, quote stays `accepted`.
4. `account.updated` still updates profile flags.

---

# Fix 2 — Cancelled send sheet shows "Quote sent" banner

**Root cause.** In `src/routes/quotes.new.tsx` the `SendQuoteDialog`'s `onClose` always navigates to `/quotes/$quoteId?sent=1`, even when the trader opened the sheet via "Save & Send" and then cancelled without sharing. The `sent=1` query both shows the lime banner and bypasses the detail page's pending→editor guard.

## Changes (single file: `src/routes/quotes.new.tsx`)

- Add `const wasSentRef = useRef(false);` alongside the send-sheet state.
- In the sheet's `onSent` callback set `wasSentRef.current = true`; in `onUndo` set it back to `false`.
- Reset `wasSentRef.current = false` whenever the sheet opens.
- In `onClose`: navigate to `/quotes/$quoteId` with `search: { sent: 1 }` only if `wasSentRef.current`; otherwise navigate without the `sent` param so the detail page's existing pending-quote guard sends the trader back to `/quotes/new?edit=<id>`.

## Acceptance

- Save & Send → share via any channel → close → detail page with "Quote sent" banner.
- Save & Send → cancel sheet → land back in the editor, no banner, no banner flash.

---

# Not for Lovable (Sunny's manual steps)

1. Stripe Dashboard → Webhooks: endpoint at `https://quottr.co.uk/api/public/payments/connect-webhook` listening to **Connected accounts**, subscribed to `account.updated`, `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.expired`; signing secret must match `STRIPE_CONNECT_WEBHOOK_SECRET`. Repeat for live.
2. Regenerate `package-lock.json` (`npm install` and commit).
3. End-to-end test on a Connect-onboarded account: quote flips to paid, invoice email arrives, 0.5% application fee shows on the payment.
