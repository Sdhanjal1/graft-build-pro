Use the **Quottr sandbox** (`acct_1TY3mWLC2psBihUH`) — not "Test mode" and not "Sunny".

### Why

Your app's `STRIPE_CONNECT_SANDBOX_WEBHOOK_SECRET` and the existing test Connect account that produced QTR-001's `cs_test_…` session both live in whichever sandbox the deposit checkout was created from. The check is simple:

- The connected trader account you onboarded in test mode (the one with `stripe_connect_charges_enabled = true`) lives in **one specific sandbox**. That same sandbox is where the Connect webhook must be registered, because connected-account events only fire in the sandbox that owns the connected account.
- "Test mode" (the legacy shared test environment, `acct_1TY3m9Q5a2i6zJkA`) is a separate account; webhooks registered there will never see events from a connected account that lives in "Quottr sandbox".
- "Sunny" is unrelated.

### How to confirm before you click

In the Stripe dashboard, switch into **Quottr sandbox** → Connect → Accounts. You should see the test trader account you used for QTR-001 listed there. If you do, that's the correct sandbox. If it's not there, switch to "Test mode" and check — wherever the connected account appears is the sandbox you must register the webhook in.

### Then

In that same sandbox:

1. Developers → Webhooks → Add endpoint
2. **Events from: Connected accounts** (not Your account)
3. URL: `https://id-preview--e4be6907-c837-4e5e-9461-63fadfdad91e.lovable.app/api/public/payments/connect-webhook?env=sandbox`
4. Events: `account.updated`, `checkout.session.completed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`
5. Copy the signing secret → update `STRIPE_CONNECT_SANDBOX_WEBHOOK_SECRET` in Lovable secrets
6. Re-run a deposit on QTR-001 and confirm the POST appears in preview logs and `invoice_payments` flips to `paid`

give me the update to add the new WHSEC

&nbsp;