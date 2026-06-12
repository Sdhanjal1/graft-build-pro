# Bug & security fixes — F2 through F13

Applies the full sweep we agreed on. **Critical guardrail (per your note):** the connect-webhook payment routing into `handlePaidEvent` / `handleFailedEvent` and the `STRIPE_CONNECT_WEBHOOK_SECRET` signature verification stay **exactly as they are**. The only change to that file is swapping the missing-secret response from `500` to `200`. After applying, I'll verify a `checkout.session.completed` still flips the quote to paid.

Skipping F1 / F11 (bank fields + `stripe_connect_charges_enabled` in `getPortalData`) — those are intentional: customers need the bank details to pay by transfer and the flag to render the right payment button on the portal. Happy to revisit if you'd rather the server derive booleans.

## HIGH

**F3 — Stripe key mismatch (`src/lib/subscription.functions.ts`)**
Change `process.env.STRIPE_API_KEY` → `process.env.STRIPE_BYOK_SECRET_KEY` so subscription checkouts pick up the same live key as invoice + Connect flows. Without this, live subs silently route to sandbox.

**F2 — Module-scope `supabaseAdmin` imports in 7 `*.functions.ts` files**
Remove the top-level `import { supabaseAdmin } from "@/integrations/supabase/client.server"` and replace with a handler-local `const { supabaseAdmin } = await import("@/integrations/supabase/client.server")` at the top of each handler that needs it. Files:

- `account.functions.ts` · `connect.functions.ts` · `messages.functions.ts` · `payments.functions.ts` · `portal.functions.ts` · `quote-requests.functions.ts` · `subscription.functions.ts`

## MED

**F4 — PI dedup in `handlePaidEvent` (`src/lib/payments-webhook-shared.server.ts`)**
When the event has no `cs_*` session id but has a `pi_*` payment intent, check `invoice_payments` for an existing row with that `stripe_payment_intent`. If found, `update` to `paid`; otherwise `insert`. Prevents duplicate paid rows + duplicate invoice emails on Stripe's `payment_intent.succeeded` retries.

**F5 — Portal checkout idempotency (`src/lib/payments.functions.ts::createPortalCheckout`)**
Before creating a new Stripe session, query `invoice_payments` for a `pending` row matching `(quote_id, request_type, status='pending')`. If a recent one (<24h) exists with a `stripe_session_id`, return it instead of creating another. Stops orphan pending rows from repeated taps.

**F6 — Ownership filter on `markRequestRead**`
Add `.eq("pro_user_id", context.userId)` to the update query. Defence-in-depth in case RLS UPDATE policy is missing.

**F7 — Connect webhook missing-secret response**
`src/routes/api/public/payments/connect-webhook.ts` line 41: when `STRIPE_CONNECT_WEBHOOK_SECRET` is unset, return `200 "ok (not configured)"` + `console.warn` instead of 500. **Signature verification, the four payment-event handlers, and `handlePaidEvent` / `handleFailedEvent` routing remain untouched.**

**F8 — `removeManualDeposit` user_id guard**
Add `.eq("user_id", context.userId)` to the `supabaseAdmin` delete, even though the quote ownership is already verified.

## LOW

**F9 — Portal toggle ownership filters (`src/lib/portal.functions.ts`)**
Add explicit `user_id` filter to:

- `togglePortalActive` → `.eq("user_id", context.userId)` on clients
- `toggleQuotePortalVisible` → `.eq("user_id", context.userId)` on quotes
- `toggleDocumentPortalVisible` → `.eq("user_id", context.userId)` on client_documents
- `regeneratePortalCode`, `deleteClientDocument`, `updateServiceReminder`, `sendProClientMessage` — same treatment for consistency.

**F10 — Voice builder flicker (`src/routes/quotes.new.tsx` ~line 644)**
In `regenerateLiveQuote` finally block, only call `setBuilding(false)` when `pendingCountRef.current === 0` after decrement. Prevents spinner flash between concurrent phrases.

**F12 — Restrict `createInvoiceCheckout` redirect URLs**
Validate `successUrl` / `cancelUrl` against the same `ALLOWED_PORTAL_ORIGINS` set used by `createPortalCheckout`. Reject anything else.

**F13 — Timing-safe cron secret (`src/routes/api/public/hooks/service-reminders.ts`)**
Replace `auth !== \`Bearer ${secret}`with a length-check +`crypto.timingSafeEqual`over`Buffer`s.

## Verification after apply

1. Confirm build passes (Vite plugin + TS strict).
2. Hit the connect-webhook locally with a sample `checkout.session.completed` event for a connected account → confirm the matching quote flips to `paid` and `invoice_payments` upserts correctly. (No regression vs current behaviour.)
3. Smoke-check live voice quote builder still loads items and doesn't flash the spinner mid-stream.
4. Spot-check that the subscriptions flow still opens checkout in live mode when `STRIPE_BYOK_SECRET_KEY` is present.
  &nbsp;

Three watch items, in priority order:

1. F3 is only half the fix — confirm the secret’s value, not just the variable name. The code change points subscriptions at STRIPE_BYOK_SECRET_KEY, but that only fixes prod if that variable actually holds your live key (sk_live_…) in the production environment. If it’s empty or holds a test key there, subscriptions stay on sandbox despite the code change. So when their verification step says “subscriptions open checkout in live mode,” make that real — eyeball that STRIPE_BYOK_SECRET_KEY in your prod secrets is the live value, and confirm a checkout actually opens in live mode. This is the single most important thing to verify in the whole sweep.

2. F7 makes a missing webhook secret silent. Returning 200 + a console.warn instead of 500 is the correct security choice (you can’t safely process unverified events anyway), but it means a misconfigured STRIPE_CONNECT_WEBHOOK_SECRET in prod would silently drop real payments with only a log line. That ties straight to your manual Stripe dashboard step — make sure that secret is actually set in prod, because nothing will shout if it isn’t.

3. [quotes.new](http://quotes.new).tsx is getting stacked edits. F10 (the spinner-flicker fix) touches the same regenerateLiveQuote area as your Prompt B tombstone/metadata changes, and payments.functions.ts gets both F2 and F5. Both should coexist fine — F10 only touches the setBuilding finally block — but glance at the diff to confirm F10 layered on top of the Prompt B logic rather than rewriting around it. Their “build passes” check covers the rest.

Everything else (F4–F6, F8, F9, F12, F13) is clean defence-in-depth and real authorization tightening. Let it run.