Add `quotes.paid_at` and stamp it from both the webhook (card) and `markQuotePaid` (cash/bank), so the PDF "PAID" stamp and paid-date label fire correctly. Mirrors the `deposit_paid_at` fix.

## 1. Migration — add `quotes.paid_at`

New column, same shape as `deposit_paid_at`:

```sql
ALTER TABLE public.quotes ADD COLUMN paid_at timestamp with time zone;
```

Applied to the Cloud DB.

## 2. Webhook — `src/lib/payments-webhook-shared.server.ts` (full/balance branch, ~line 331–358)

In the `else` branch (full/balance), mirror the deposit pattern:

- Forward-flip: add `paid_at: now` to the `status:"paid"` update (lines 340–345). Status guard already prevents regressing already-paid rows.
- Idempotent backfill: extend the existing "stamp `completed_at` if null" backfill (lines 348–354) to also `coalesce(paid_at, now)` — i.e. only set `paid_at` when currently null. A separate `.is("paid_at", null)` update keeps it surgical, matching the deposit shape.

Deposit branch untouched — deposits intentionally don't set `paid_at`.

`invoice_payments.paid_at` writes (lines ~181/201/234/252) stay as-is.

## 3. `markQuotePaid` — `src/lib/user-data.ts` ~line 1622

Add `paid_at: completedAt` to the update:

```ts
.update({ status: "paid", paid_via: paidVia, completed_at: completedAt, paid_at: completedAt })
```

So cash/bank manual-mark also stamps `paid_at`, and PDF behaves identically to card-paid.

## 4. `portal-pdf.ts` — verify only

Already reads `quote.paid_at` at lines 202, 297, 316. No edit. Will fire once column is populated.

## 5. Types

`src/integrations/supabase/types.ts` regenerates after the migration runs; no manual edit.

## Verification

- Card full/balance payment → webhook stamps `quotes.paid_at` → PDF renders PAID stamp + correct paid date.
- `markQuotePaid` (cash/bank) → `quotes.paid_at` set → PDF renders PAID stamp.
- Webhook replay → forward-flip's status guard (`.in("status", ["pending", "sent", "accepted", "overdue"])`) blocks re-write; backfill's `.is("paid_at", null)` guard blocks churn.
- Deposit payment → only `deposit_paid_at` set; `paid_at` stays null.
- Run existing money-correctness suite (`tests/payments-money.test.ts`, `tests/invoice-pdf-golden.test.ts`, `tests/invoice-badge-matrix.test.ts`) to confirm no regression.

## Out of scope

- No edits to deposit branch, `invoice_payments` writes, or `portal-pdf.ts`.
- No change to status state machine or any other field.

One addition: the invoice-pdf-golden test will legitimately change once the PAID stamp fires

(it wasn't rendering before). Re-baseline that golden deliberately and show me the before/after

of the rendered PAID region, so we confirm the stamp appears correctly rather than just

force-accepting a new snapshot.