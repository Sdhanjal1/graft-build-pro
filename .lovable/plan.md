# Paid quotes: auto-complete + simplified view

Two issues on quote `18772138…` (status = paid):
1. The detail page still shows the full editable Itemised list and the "Payment terms" card, even though the job is paid in full — nothing left to configure.
2. A "Job done — send receipt" button is still required as a manual tap, even though Stripe already confirmed payment. The receipt email is sent by the webhook, so the manual step is redundant.

## Changes

### 1. Auto-complete on payment (server)

In `src/lib/payments-webhook-shared.server.ts`, inside `handlePaidEvent` after the quote status is updated to `paid` for `requestType === "full" | "balance"`:

- Also set `completed_at = now()` on the quote when it isn't already set.
- Keep the existing branded receipt email + push notification (already automated — no UI tap needed).

For `requestType === "deposit"` leave behaviour unchanged (deposit only → still needs job-done step for the balance).

### 2. Simplified paid view (UI only)

In `src/routes/quotes.$quoteId.tsx`, when `status === "paid"` AND `completed_at` is set (i.e. fully settled job):

- **Hide the Payment terms card** (lines ~926–942). Nothing to change once paid.
- **Replace the editable `LineItemsEditor`** with a read-only summary: list each line (description + amount), no add/edit/delete controls, no deposit-paid banner inside. The Job description block stays.
- **Remove the "Job done — send receipt" primary button branch** at line 746–748. For a `paid` quote with no `completed_at`, the webhook will now have set `completed_at`, so this branch becomes unreachable for online payments. As a safety net for cash/bank "Mark paid" flows, fall through to the existing `status === "paid"` branch (line 753) which shows "Share receipt".
- The top money card already shows the green "Paid" badge, total in lime, and a checkmark — that becomes the single source of truth for "Job complete · Paid".

### 3. Cash/bank mark-paid parity

In the `markPaid` handler (around line 415) — when a user records a manual cash/bank payment, also set `completed_at` at the same time so the simplified view applies consistently.

## Files touched

- `src/lib/payments-webhook-shared.server.ts` — set `completed_at` on full/balance payments.
- `src/routes/quotes.$quoteId.tsx` — conditional rendering for paid+completed: hide payment-terms card, swap LineItemsEditor for read-only summary, drop the redundant "Job done — send receipt" button.

## Out of scope

- Deposit-only paid state still shows payment terms + editor (balance is still owed).
- No schema changes — `completed_at` column already exists on `quotes`.
- No changes to chases (cancelled on paid already) or notifications.
