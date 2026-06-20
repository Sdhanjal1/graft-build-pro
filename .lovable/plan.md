## Goal

Close the deposit-then-balance gap so a customer can pay the outstanding balance from the portal (and from the balance-due email), without changing any existing money logic.

## Server-side: amount is computed, never trusted

Extend `createPortalCheckout` (and `createPortalCheckoutFromCode` for the client hub) in `src/lib/payments.functions.ts`:

1. Widen the `requestType` enum: `z.enum(["deposit", "full", "balance"])`.
2. After loading the quote, when `requestType === "balance"`:
  - Sum all `invoice_payments` rows for that `quote_id` where `status = "paid"` and `request_type = "deposit"`, taking `amount_cents` straight from the database (the same column the invoice/email already read). This is the deposit-paid figure.
  - Compute the balance via the shared helper:
    ```
    const amounts = computeInvoiceAmounts({
      mode: "balance",
      totalCents: Math.round(total * 100),
      depositPaidCents,
    });
    ```
    `headlineCents` is the amount we charge. `amounts.ok === false` (no deposit on file, or balance ≤ 0) → throw a clear error ("No deposit recorded for this quote" / "Balance is already settled"). This is the only place the balance amount is derived — the client sends no number.
  - Reject if `quote.status === "paid"` (already covered) and also short-circuit if the quote is the `on_completion`/`upfront`/`full` shape — only `deposit_then_balance` quotes get the balance path.
3. Reuse the existing checkout path verbatim from there (same Connect-direct-charge, same 0.5%/£0.50/£25 application fee on `amountCents`, same pending `invoice_payments` insert with `request_type: "balance"`, same idempotent-reuse-of-pending-session guard).

Notes:

- `computeInvoiceAmounts` is the same helper the balance email already uses, so the figure the customer pays will always equal the figure the invoice/email show.
- Idempotency: the existing pending-session lookup already keys on `(quote_id, request_type)` and amount, so a second `balance` tap reuses the open Stripe session instead of stacking rows.

## Webhook: balance → quote is paid, receipt shows balance only

In `src/lib/payments-webhook-shared.server.ts` (`handlePaidEvent`):

1. `requestType === "balance"` should follow the same "flip to paid" branch as `full` (currently the `else` branch). Change the condition from `if (requestType === "deposit")` / `else` to:
  - `deposit` → status nudge to `accepted` (unchanged)
  - `full` or `balance` → status nudge to `paid` (unchanged guards: only from `pending|sent|accepted|overdue`)
2. `sendBrandedInvoiceEmail`: extend the mode picker so:
  - `deposit` → `deposit-received` (unchanged)
  - `balance` → `receipt`, but also pass `depositPaidCents` (looked up from the same paid-deposit sum) so the receipt body shows "balance £Y collected · deposit £X already credited · total £T" instead of pretending the full total was just collected. The `receipt` branch of `computeInvoiceAmounts` already handles this when both `amountCents` and `depositPaidCents` are supplied — this is the existing M6 behaviour. `amountCents` for the receipt is the Stripe `amount_total` for this charge, i.e. the balance.
  - `full` → `receipt` (unchanged)

## Portal UI: "Pay balance £X" button

`src/routes/portal.$token.tsx`:

1. `onPay` accepts `"deposit" | "full" | "balance"` and forwards to `createPortalCheckout`.
2. The existing `hasPaidDeposit && !isPaidInFull` card (the "Deposit paid · balance £Y due on completion" block) gains a primary `Pay balance £X` button that calls `onPay("balance")`. The button is shown only when `hasCard` is true; bank-only stays as today (instructions in text).
3. Accept a `?pay=balance` query param so the balance-due email link can auto-open Stripe Checkout on arrival (mirrors the existing `?paid=1` / `?cancelled=1` handling — fire `onPay("balance")` once, then strip the param).
4. No changes to the deposit/full buttons, the accept flow, or any totals/displays.

Mirror the button (no auto-open) on `src/routes/portal.c.$code.tsx` if that route already shows the deposit-paid state, calling `createPortalCheckoutFromCode` with `requestType: "balance"`.

## Balance-due email: add a Pay button

`src/lib/email/send-invoice.server.ts` `balanceHtml`:

- Add an optional `payNowUrl` field to `SendInvoiceEmailInput` and render a CTA button under the `BALANCE DUE` panel: "Pay £X online" → `payNowUrl`. Falls back to the existing "Payment details are on the attached invoice" copy when `payNowUrl` is missing (e.g. no portal token available, or trader hasn't enabled card).

`src/lib/invoice-email.server.ts`:

- When `mode === "balance"` and the trader's profile has `stripe_connect_charges_enabled`, look up the most recent non-expired row for this `quote_id` in `quote_portal_tokens` and build `payNowUrl = "{appOrigin}/portal/{token}?pay=balance"`. If no live token exists, mint one with the same shape used elsewhere (or simply omit `payNowUrl` — the email still works, the trader can resend the link). No new token-management semantics.

## Out of scope

- The existing deposit and full checkout paths.
- Any change to displayed totals, deposit math, VAT, or platform-fee logic.
- The client-hub `?pay=balance` auto-open (we add the button only; the auto-open hook is portal-token-only because the email links there).

## Verification

1. New test in `tests/payments-money.test.ts`: balance via `computeInvoiceAmounts` with a £700 balance returns `headlineCents: 70000` and `balanceDueCents: 70000` with deposit credited.
2. Manual smoke on QTR-001 (already has a paid deposit) in the Quottr sandbox: tap "Pay balance" → Stripe Checkout shows £700 → succeed with `4242…` → webhook flips quote to `paid`, receipt email lands showing "Balance £700 collected · £300 deposit credited · Total £1,000".

also ensure the visual layout of the invoices stay consistent from deposit paid to final invoice payment