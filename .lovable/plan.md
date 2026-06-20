## Goal

Lock down deposit/balance/receipt money correctness with three layers of automated checks, plus a one-shot Stripe sandbox lifecycle script that prints raw evidence (PI ids, pence, PDF text, DB rows) rather than pass/fail.

## Layer 1 — Unit tests (CI, `bun test`)

New file: `tests/payments-money.test.ts`

Pure-function coverage of the money pipeline. No network, no DB.

- `**payment-timing.ts**`
  - `computeDepositAmount` / `computeDepositPercent` round-trip across 0%, 30%, 50%, 100%, and rounding-edge totals (£99.99, £100.01, £3.33, £0.30).
  - `parseDepositInput` for `"30%"`, `"£500"`, `"500"`, `"abc"`, `""`.
  - `DEFAULT_DEPOSIT_FRACTION === 0.3` (locks the C1 fix).
- **Balance arithmetic per mode** — extract the headline/balance/deposit calc out of `invoice-email.server.ts` into a tiny pure helper `computeInvoiceAmounts({ mode, totalCents, amountCents?, depositPaidCents? })` and unit-test it. Cases:

  | mode                          | total  | amountCents in | depositPaid in | expect headline | expect balanceDue | expect depositPaid |
  | ----------------------------- | ------ | -------------- | -------------- | --------------- | ----------------- | ------------------ |
  | invoice                       | 100000 | –              | –              | 100000          | 100000            | 0                  |
  | receipt (full)                | 100000 | –              | –              | 100000          | 0                 | 0                  |
  | receipt (post-deposit)        | 100000 | 70000          | 30000          | 70000           | 0                 | 30000              |
  | balance                       | 100000 | 70000          | 30000          | 70000           | 70000             | 30000              |
  | deposit-received              | 100000 | 30000          | –              | 30000           | 70000             | 30000              |
  | deposit-received 33% rounding | 100000 | 33333          | –              | 33333           | 66667             | 33333              |
  | zero-deposit edge             | 100000 | 0              | 0              | (refuse)        | –                 | –                  |
  | balance ≤ 0 edge              | 100000 | 0              | 100000         | (refuse)        | –                 | –                  |

- **VAT rounding to the penny** — for the same fixtures, with `vat_registered: true` and a 20% VAT rate, assert `subtotal + vat === total` to the penny across totals £33.33, £99.99, £100.00, £123.45, £1.

Refactor required: extract `computeInvoiceAmounts` from `invoice-email.server.ts` into `src/lib/invoice-amounts.ts` (pure, no I/O) and have the server call it. This makes the test possible without mocking Supabase.

## Layer 2 — Badge state-machine matrix (CI)

New file: `tests/invoice-badge-matrix.test.ts`

Generates the full cartesian product of `{ mode } × { quote.status } × { deposit_paid_cents } × { amount_cents }` for representative values and asserts hard invariants on the email template + PDF stamp:

- For every (mode, balanceDue > 0) row: rendered HTML must NOT contain `>PAID`  badge text and the badge color must NOT be `#15803D` (green).
- `requestType === "deposit"` → mode resolved to `deposit-received` → HTML contains `DEPOSIT RECEIVED` and `BALANCE` line, never `PAID IN FULL`.
- PDF generator called with `paid_at` must be non-null ONLY when `mode === "receipt"` (asserted via spy on `generateInvoicePdfBytes`).
- `balance` mode with `amount <= 0` and `deposit-received` with `amount <= 0` return `{status: "skipped"}` (no email sent).

Implementation: import `buildHtml`, `buildSubject` from `send-invoice.server.ts` and the new `computeInvoiceAmounts`. No network. Spy on `generateInvoicePdfBytes` via a vitest-style mock (or plain function override since we use `bun test`).

## Layer 3 — Golden PDF tests (CI)

New file: `tests/invoice-pdf-golden.test.ts` + fixtures in `tests/__snapshots__/`.

For each of the four modes, render the PDF via `generateInvoicePdfBytes` with a fixed fixture quote (£1,200 total, 20% VAT, deposit £360 / 30%):

1. Extract text with `pdf-parse` (add as devDependency).
2. Normalise: strip the jsPDF `CreationDate`, lowercase whitespace runs, drop page numbers.
3. **Snapshot** the normalised text per mode (`invoice.txt`, `receipt.txt`, `balance.txt`, `deposit-received.txt` under `tests/__snapshots__/`).
4. **Invariant assertions** layered on top of the snapshot, per mode:
  - `invoice`: contains "£1,200.00", contains "DUE", does NOT contain "PAID", does NOT contain "DEPOSIT RECEIVED".
  - `receipt`: contains "PAID", contains amount paid, does NOT contain "BALANCE DUE".
  - `balance`: contains "BALANCE DUE · £840.00", contains "Less deposit received £360.00", does NOT contain "PAID".
  - `deposit-received`: contains "DEPOSIT RECEIVED · £360.00", contains "Balance to pay on completion · £840.00", PDF stamp is NOT "PAID".
5. Force deterministic creation date by passing a fixed `created_at` and stubbing `Date.now` via the test harness.

## Layer 4 — On-demand lifecycle script

New file: `scripts/lifecycle-deposit.ts`. Not in CI. Run with `bun scripts/lifecycle-deposit.ts --user <uuid>`.

Requires: an existing seeded sandbox user with a connected sandbox Connect account (charges enabled). Reads `STRIPE_SANDBOX_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from env.

Steps, printing raw evidence at each step (no pass/fail summary):

1. **Create quote** in DB via service role: £1,200 / 20% VAT / `payment_timing=deposit_then_balance` / `deposit_percent=30`. Print quote row.
2. **Mint portal token** in `quote_portal_tokens`. Print token + portal URL.
3. **Read portal page** — fetch `/portal/$token` HTML, regex out the displayed deposit figure. Print the rendered figure.
4. **Pay deposit**: call `createPortalCheckout({ token, requestType: "deposit" })`, get `amount` (pounds) + Stripe Checkout URL. Print returned amount in pence. **Assert** `portalDisplayedPence === stripeAmountPence` — fail loudly with both values if not equal.
5. Drive payment via Stripe's testmode `payment_intents` flow on the connected account: create + confirm a PI with the same amount/metadata as Checkout would, or use Stripe's Checkout Session test helper. Print `pi_xxx` id and `amount_received`.
6. Fire the webhook into `/api/public/payments/webhook?env=sandbox` with a signed payload. Print response status.
7. Read back: `invoice_payments` row, `quotes.status`, `quotes.invoice_email_status`. Print all three.
8. Pull the latest sent email PDF (regenerate via `generateInvoicePdfBytes` with same data + `mode: "deposit-received"`), extract text with pdf-parse. Print full text.
9. **Pay balance**: call manual mark-paid path → `sendInvoiceEmailForQuote({ mode: "receipt" })`. Print the computed `amountCents` and `depositPaidCents` (proves M6 auto-subtract).
10. Render the resulting receipt PDF, extract text, print. Read back the final `invoice_payments` rows + `quotes.status`. Print.

Output format per step: a labelled block

```
=== STEP 4: pay deposit ===
portal.displayed_pence: 36000
stripe.checkout.amount:  36000
ASSERT portal == stripe: OK
stripe.payment_intent.id: pi_3Q...
stripe.payment_intent.amount: 36000
db.invoice_payments[0]: { status: 'paid', request_type: 'deposit', amount_cents: 36000, ... }
pdf.extracted_text: |
  DEPOSIT RECEIVED · £360.00
  Total £1,200.00
  Balance to pay on completion · £840.00
  ...
```

## Files

- New: `src/lib/invoice-amounts.ts` (pure helper extracted from `invoice-email.server.ts`)
- Edit: `src/lib/invoice-email.server.ts` (call the helper instead of inline math)
- New: `tests/payments-money.test.ts`
- New: `tests/invoice-badge-matrix.test.ts`
- New: `tests/invoice-pdf-golden.test.ts`
- New: `tests/__snapshots__/{invoice,receipt,balance,deposit-received}.txt`
- New: `scripts/lifecycle-deposit.ts`
- Edit: `package.json` — add `pdf-parse` devDep; add `"test:lifecycle": "bun scripts/lifecycle-deposit.ts"`.

## Out of scope (explicit)

- No changes to production money logic — only the refactor-extract of `computeInvoiceAmounts`. All existing behavior preserved; tests pin it down.
- No CI config edits (existing `bun test tests/` already picks up new files).
- Lifecycle script does NOT auto-create a Connect account; assumes one exists on the chosen test user.

Drop Layer 3 text snapshots entirely — invariant assertions only, no `__snapshots__` files. Confirm the C1 portal figure (step 3) is scraped from the rendered portal page renderer, and the Stripe figure (step 4) from the amount actually sent to Stripe — two independent code paths, not both from createPortalCheckout. Step 5 reads the PI amount from the created Checkout Session object, not recomputed. Add VAT-figure-to-the-penny assertions to the Layer 3 invoice/receipt invariants, using the same rounding the PDF line items use.