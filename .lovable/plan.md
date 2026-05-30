## Stage 2 — Bank transfer payment option on customer portal

Single file change: `src/routes/portal.$token.tsx`.

### Logic

Add derived flags from the already-fetched `profile`:

- `hasBank` = true when `account_number` AND `sort_code` are present (both required for a usable transfer).
- `hasCard` = existing `stripe_connect_charges_enabled`.
- `canShowBank` = `status === "accepted" && !isPaid && hasBank`.
- `canPayNow` stays as-is (Stripe-gated).

### UI

When `status === "accepted"` and not paid, render a new "How to pay" section above the bottom bar (between the existing `status === "accepted"` confirmation block and the footer), containing whichever options apply:

1. **Card** card (only if `hasCard`): the existing lime "Pay now {amount}" button + "Secured by Stripe" + `WalletBadges`, moved out of the fixed bottom bar.
2. **Bank transfer** card (only if `hasBank`): shows
   - Account name (`bank_account_name`, fallback to `business_name`)
   - Bank name (if present)
   - Sort code (formatted `xx-xx-xx`)
   - Account number
   - Reference: `payment_reference_note` if set, otherwise `quote.ref`
   - A "Copy details" button that copies a plain-text block to clipboard.
   - Small note: "Once you've sent the transfer, your tradesperson will mark it as paid."

If both exist, render them as two equal-weight cards stacked. If neither, render nothing (cash/in-person path — silent).

### Bottom bar

When `status === "accepted"` and not paid:
- If `hasCard` OR `hasBank` → show a neutral "Accepted" pill (the payment options live in the section above; no duplicate Pay button in the bar).
- Else → show the current "Accepted" pill (unchanged).

This removes the in-bar Pay button so card + bank sit side-by-side as equal options. The accept flow, paid state, and declined state are untouched.

### Out of scope

- No backend changes — `getPortalData` already returns the bank fields from Stage 1.
- No new "mark as paid" action for bank transfers (tradesperson does that elsewhere).
- No changes to Stripe checkout flow.
