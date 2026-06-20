## Findings: deposit maths is right, email amount is WRONG, confirmation text needs tightening

I checked the three things you asked about. Two are small, one is bigger than a copy tweak because the email template itself is hard-coded as a "Payment received / PAID" receipt — so we need to be careful what we send for each mode.

## 1. Confirmation text — small change

Current `jobDonePreview` titles (`src/routes/quotes.$quoteId.tsx:514-531`) don't match the phrasing you asked for:


| Mode      | Current title                          | Your spec                                                                                       |
| --------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `invoice` | "Mark done and send the £700 invoice?" | "Mark done and send the £700 invoice to John?"                                                  |
| `balance` | "Mark done and send the £400 balance?" | "Mark done and send the £400 balance to John?" — body should show "(£300 deposit already paid)" |
| `receipt` | `Mark "{quote.title}" done?`           | "Mark done and send John a paid-in-full receipt?"                                               |


Body for `balance` already says "(deposit of £300 credited)" — I'll match your wording "(£300 deposit already paid)".

Fix: just rewrite the three branches in `jobDonePreview`. Pure copy edit.

## 2. Deposit maths — correct in calc, WRONG in the actual email

### `depositPaid` source (correct)

`src/routes/quotes.$quoteId.tsx:227-240` fetches `invoice_payments` via `fetchPaymentsFn`, then:

```ts
const paid = rows
  .filter((r) => r.status === "paid" && r.request_type === "deposit")
  .reduce((sum, r) => sum + (Number(r.amount_cents) || 0), 0) / 100;
setDepositPaid(paid);
```

So `depositPaid` is the **real** money received (sum of `invoice_payments` rows that are `status='paid' AND request_type='deposit'`), in pounds, from cents. **Not** the configured percentage. ✓

### `jobDoneAmount` (correct)

Line 509-512: `Math.max(0, total - depositPaid)` for balance mode, `total` otherwise. ✓

### What's actually emailed (WRONG)

`jobDone()` calls `sendInvoiceEmailFn({ data: { quoteId } })` with **only the quote id** — no amount override. Inside `sendAndRecordInvoiceEmail` (`src/lib/invoice-email.server.ts:90`):

```ts
const amount = (opts.amountCents ?? Math.round(Number(quote.total) * 100)) / 100;
```

It falls back to `**quote.total**` every time. The PDF (`generateInvoicePdfBytes`) is built from `quote.total` and stamped `paid_at: now()`.

Worse, the email HTML template (`src/lib/email/send-invoice.server.ts:53-83`) is **hard-coded as a paid receipt** — header literally says "Payment received", body says "Thanks for your payment — we've received {amount}", green "PAID · {amount}" badge, subject `Invoice {ref} from {biz} — Paid`.

So today for **all three modes**:

- `invoice` (on_completion): emails the customer a "PAID — thanks for your payment" receipt for the full total… **before they've paid**. ❌
- `balance`: same — "PAID — full total received", **wrong amount, wrong message, ignores deposit**. ❌
- `receipt` (already paid in full): this is the case the template was originally built for — correct. ✓

This is the case where you said "show me a plan if the email amount is wrong" — it is, for two of three modes. Here's the fix:

### Fix plan (focused, no rewrite of the receipt path)

a. **Extend `sendAndRecordInvoiceEmail` to take an explicit mode** so it stops pretending everything is a paid receipt:

```ts
sendAndRecordInvoiceEmail({
  userId, quoteId,
  mode: "invoice" | "balance" | "receipt",
  amountCents,        // already exists; we'll start passing it for balance
  depositPaidCents?,  // new, only for balance
});
```

b. **Pick subject + template + PDF stamp from `mode**` inside the server helper:

- `receipt` → today's "Payment received / PAID" template, `paid_at = now`, amount = total. **Unchanged behaviour** — the Stripe webhook still calls this and is unaffected.
- `invoice` → new "Invoice for £{total} — please pay by {due_date}" template (no PAID badge, no "Thanks for your payment"), `paid_at = null` so the PDF renders as an unpaid invoice.
- `balance` → "Balance of £{balance} due — deposit of £{depositPaid} received, thank you", PDF shows total / less deposit / balance due, `paid_at = null`.

c. `**jobDone()` passes the right mode + amount**:

```ts
const res = await sendInvoiceEmailFn({
  data: {
    quoteId: quote.id,
    mode: jobDoneMode,
    amountCents: Math.round(jobDoneAmount * 100),
    depositPaidCents: jobDoneMode === "balance" ? Math.round(depositPaid * 100) : 0,
  }
});
```

d. **Stripe webhook caller stays as-is** — it already passes `amountCents` and means "receipt" by default; I'll explicitly pass `mode: "receipt"` so the new switch picks the existing template.

e. **PDF**: `generateInvoicePdfBytes` currently always hard-codes `paid_at: paidAt` (line 80 of `invoice-email.server.ts`). I'll branch: `paid_at: mode === "receipt" ? paidAt : null` so the existing PDF renderer's invoice-vs-paid styling kicks in correctly (this is already controlled inside `generatePortalPdf` based on `paid_at`).

Files touched for #2:

- `src/lib/invoice-email.server.ts` — add `mode` + `depositPaidCents`, branch subject/template/PDF stamp.
- `src/lib/invoice-email.functions.ts` — extend the input validator to accept `mode`, `amountCents`, `depositPaidCents`; default to `mode: "receipt"` for the Stripe webhook caller's existing call shape.
- `src/lib/email/send-invoice.server.ts` — split the single `buildHtml` into three small builders (`receiptHtml`, `invoiceHtml`, `balanceHtml`), keep `bytesToBase64`, `escapeHtml`, and the `sendInvoiceEmail` fetch wrapper exactly as today; add a `mode`/`depositPaidFormatted` field to the input. Subject line varies by mode.
- `src/lib/payments-webhook-shared.server.ts` — pass `mode: "receipt"` explicitly when the Stripe webhook fires (no behaviour change).
- `src/routes/quotes.$quoteId.tsx` — `jobDone()` passes `mode`, `amountCents`, `depositPaidCents`.

No DB migrations, no new tables, no changes to chases, status, or `markInvoiced`.

## 3. Resend-email button on failure — small change

Today `setJobDoneResult({ mode, emailedTo, waMessage })` collapses "skipped (no email)" and "failed (provider error)" into the same `emailedTo = null` state, so the post-send sheet can't tell the difference. The sheet just shows "Send via WhatsApp".

Two small additions:

a. **Capture the failure** distinctly. After the `sendInvoiceEmailFn` call:

```ts
let emailedTo: string | null = null;
let emailFailed = false;
try {
  const res = await sendInvoiceEmailFn({ data: ... });
  const s = (res as { status?: string })?.status;
  if (s === "sent") emailedTo = (res as { to?: string }).to ?? client?.email ?? null;
  else if (s === "failed") emailFailed = true;
  // "skipped" → neither (no email on file)
} catch { emailFailed = true; }
setJobDoneResult({ mode, emailedTo, emailFailed, waMessage });
```

b. **Sheet UI** (`src/routes/quotes.$quoteId.tsx`, the post-send `<Sheet>` block):

- Success state (`emailedTo` set): unchanged.
- Failure state (`emailFailed === true`): header `"⚠ Email didn't send"`, body explains the send failed.
  - Primary button: **"Send via WhatsApp"** (one-tap, unchanged).
  - Secondary button: **"Resend email"** — calls `sendInvoiceEmailFn({ data: { quoteId, mode, amountCents, depositPaidCents } })` again, shows spinner, on success flips the sheet to the success state, on failure shows a toast and stays on the failure sheet. Disabled while in-flight.
  - "View invoice" link unchanged.
- No-email-on-file state (`emailedTo === null && !emailFailed`): unchanged (WhatsApp primary, no resend button — there's nothing to retry).

Need a small `resending` state and a `resend()` handler in the component.

## Out of scope

- No changes to the portal page, the chases system, `markInvoiced`, `markJobComplete`, or Stripe webhook behaviour (only adds `mode: "receipt"` to its existing call so the new switch returns today's template).
- No DB schema changes.
- The `invoices.$quoteId.tsx` email-status banner still works — it reads `invoice_email_status` which the server helper continues to write.

Approve and I'll ship all three together: copy fix, email-mode plumbing, and the resend button.

Approved — and good catch on the email template. The "PAID receipt for unpaid invoices" bug is serious (a customer getting a "Payment received, £700 PAID" email before they've paid would mean we never get paid and they lose trust), so this is important to fix. The three-mode plan is right.

Two things to confirm as you build:

1. **Don't break the Stripe webhook receipt** — confirm that after splitting into three templates, a real card payment still triggers the correct "paid receipt" email exactly as it does today (you've passed `mode: "receipt"` explicitly — just verify the actual output is unchanged).
2. **The cash/bank "mark as paid" path** — when a trader marks a quote paid by cash/bank, that should send a *receipt* (it's paid), not an invoice. Confirm that path passes `mode: "receipt"` too, so manually-paid quotes get the right "paid" email, not a "please pay" one.  
Ship all three (copy, email-mode plumbing, resend button).