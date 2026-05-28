## Fix: Hide "Pay now" button after customer pays via Stripe

**Problem:** On the customer portal (`/portal/$token`), after a customer completes a Stripe payment and is redirected back with `?paid=1`, the "Payment received" banner correctly appears (driven by local `paymentResult` state). However, the sticky bottom CTA bar still shows the **"Pay now"** button because `isPaid` is derived solely from `quote.status === "paid""` in the database. The Stripe webhook hasn't yet updated the DB row, causing a confusing race condition where the customer sees both "Paid" and "Pay now" simultaneously.

**Fix:** Update the `isPaid` boolean in `src/routes/portal.$token.tsx` to also check the local `paymentResult` state:

```ts
// Line 149
const isPaid = status === "paid" || paymentResult === "paid";
```

This ensures the bottom bar immediately shows the "Paid" pill after Stripe redirect, while existing polling reconciles the DB status within ~30 seconds.

**Scope:** Single-line change in one file. No backend or database changes required.