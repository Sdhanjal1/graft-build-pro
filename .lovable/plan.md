## Goal

Two connected changes to `quotes.$quoteId.tsx`: (1) remove customer-facing payment UI from the trader view and replace with status-appropriate actions, and (2) introduce per-quote `payment_timing` with configurable deposits, wired through AI generation, settings, customer portals, and the chaser.

---

## Part 1 — Trader quote detail cleanup

**File:** `src/routes/quotes.$quoteId.tsx`

- Remove the "Payment method" section (the `Pay by card / bank transfer / cash` selector) and the "Pay by card" CTA from the trader view. These remain in `portal.c.$code` and `portal.$token` only.
- Replace the primary action area with status-driven buttons:
  - `pending` + no client → lime **"Add client to send"** (opens client picker)
  - `pending` + client → lime **"Send to [first name]"** (existing send flow)
  - `accepted` → lime **"Mark job complete"**, outline **"Take payment on site"** (only if Stripe Connect enabled)
  - `completed` → lime **"Mark as paid"**, outline **"Send reminder"**
  - `paid` → status pill `Paid on [date] · [method]`, outline **"Download invoice"**
- Bottom bar: primary action + single `⋯` overflow menu (`dropdown-menu`) holding Duplicate, Delete, View as customer, Download PDF.
- Add a server fn / handler `markJobComplete` (sets `status = 'completed'`, stamps `completed_at`/uses existing field) and `markPaid` (manual mark-paid path that inserts an `invoice_payments` row with `payment_method = 'manual'`).

---

## Part 2 — Payment timing & deposits

### Schema (migration)

Add to `quotes`:

- `payment_timing text not null default 'on_completion'` — values: `on_completion | deposit_then_balance | staged | upfront`
- `deposit_amount numeric not null default 0`
- `deposit_percent numeric not null default 0`

Add to `profiles`:

- `default_deposit_percent integer not null default 30` (0–100)

### AI generation

`src/lib/ai-quote.functions.ts` (and `ai-capture-quote.functions.ts` if it also persists quotes): after generation, before insert, derive:

- total < 500 → `on_completion`
- 500 ≤ total ≤ 2000 → `deposit_then_balance`
- total > 2000 → `deposit_then_balance` + UI flag (no schema field; computed at render time as `total > 2000 && timing !== 'staged'`)

Deposit defaults from `profile.default_deposit_percent` (fallback 30). Compute `deposit_amount = round(subtotal * pct / 100, 2)`.

### Trader UI on `quotes.$quoteId.tsx`

Below totals:

- `on_completion` → "Payment: Due on completion"
- `deposit_then_balance` → "Payment: £X deposit (Y%), balance £Z on completion"
- `upfront` → "Payment: £Total upfront"
- `staged` → "Payment: staged schedule" (placeholder text; no schedule editor in this pass)

Small **Change** link next to it → dropdown with the four options; persists via existing quote update mutation.

When timing is `deposit_then_balance`, render two linked inputs (`Deposit £` / `Deposit %`):

- Editing one updates the other (percent of `subtotal`, rounded to 2dp / integer %).
- Accept free-text like `50%` or `£500` in either field via a small parser; sync the partner field and save both.
- Debounced save through existing update server fn.

If total > 2000 and timing ≠ `staged`, show a muted hint chip: "Large job — consider staged payments" with a one-click switch to `staged`.

### Settings

`src/routes/settings.tsx`: add **"Default deposit percentage for jobs over £500"** integer input (0–100, default 30). Save via existing profile update path (`user-data.ts`).

### Customer portal

`src/routes/portal.c.$code.tsx` and `src/routes/portal.$token.tsx`:

- Under total, show payment timing line (same copy as trader side).
- Accept button label:
  - `on_completion` → "Accept quote — pay when complete"
  - `deposit_then_balance` → "Accept and pay deposit £X"
  - `upfront` → "Accept and pay £X"
  - `staged` → "Accept quote"
- Existing pay-by-card / bank / cash selector stays.

### Chaser

`src/routes/chaser.tsx`: filter logic

- `on_completion` / `upfront` / `staged`: only chase when `status = 'completed'` (job done).
- `deposit_then_balance`:
  - If `status = 'accepted'` and no deposit payment recorded → chase the deposit.
  - If `status = 'completed'` and balance unpaid → chase the balance.
- Existing `status = 'paid'` quotes excluded.

---

## Files touched

- **Migration** (new): adds 3 quote fields + 1 profile field.
- `src/routes/quotes.$quoteId.tsx` — large refactor of action area and totals block; new deposit inputs and timing dropdown.
- `src/routes/settings.tsx` — default deposit % input.
- `src/routes/portal.c.$code.tsx`, `src/routes/portal.$token.tsx` — timing line + Accept button label.
- `src/routes/chaser.tsx` — filter by `payment_timing` + status.
- `src/lib/ai-quote.functions.ts` (+ `ai-capture-quote.functions.ts` if needed) — derive timing & deposit on insert.
- `src/lib/user-data.ts` — surface `default_deposit_percent`.
- New small helper `src/lib/payment-timing.ts` — pure helpers for label, deposit math, and parsing "50%" / "£500".

## Out of scope

- Building a staged-payment schedule editor (just stored value + label this pass).
- Changing the AI prompt itself.
- Wiring "Take payment on site" beyond the button (assumes existing Stripe Terminal/Connect link or stub if not present — will inspect before deciding).

On "Take payment on site": if Stripe Terminal or an equivalent in-person payment flow is not actually implemented, do not render the button at all. Hide it rather than stub it. We can add it properly in a separate pass when in-person card payments are built end to end.

On manual "Mark as paid": when the trader taps this, show a small sheet asking how they were paid: - Cash - Bank transfer - Card (in person) - Other Save the chosen method to invoice_payments.payment_method so the invoice PDF and CSV export show the correct method. Default selection: Bank transfer (most common for manual marking).