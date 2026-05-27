## Step 10 — Push notifications on accept / paid

Most of the plumbing already exists: VAPID keys, `push_subscriptions` table, `/sw.js` push handler, the trader-facing `PushPermissionCard` enable flow, and `respondQuoteFromPortal` already calls `notifyUser` with "Quote accepted 🎉" / "Quote declined" when a customer responds via the portal.

What's missing is the **paid** ping and the user-facing promise that paid events trigger a notification. Manual mark-paid happens by the trader themselves so doesn't need a push.

### Changes

1. **`src/routes/api/public/payments/webhook.ts`** — after the `invoice_payments` insert/update on `checkout.session.completed` / `payment_intent.succeeded`, fetch `quotes.title` + customer name and call `notifyUser(userId, …)` with:
   - title: `Payment received 💰`
   - body: `${quote.title} · £${(amountCents/100).toFixed(2)}`
   - url: `/quotes/${quoteId}`
   - tag: `quote-${quoteId}-paid` (dedupes if the same event re-fires)
   Wrap in try/catch so a push failure never breaks the webhook.

2. **`src/components/CustomerQRCard.tsx` → `PushPermissionCard`** — update the two copy strings to mention the three pings the trader will now get: new quote requests, quotes accepted, and payments received. No structural changes.

### Out of scope here
- iOS PWA install prompt and home-screen instructions (covered by Steps 11 / 17).
- Per-event mute toggles.
- Stripe Connect / subscription webhooks (only invoice payments here).

### Verification
- Trigger a sandbox `checkout.session.completed` for a real quote → server logs show one push send, the device gets "Payment received 💰" with the correct title and total, tapping opens `/quotes/{id}`.
- Re-fire the same event → no duplicate banner (same `tag`).
- Disable push on the device → webhook still returns 200 and the payment row still updates.
