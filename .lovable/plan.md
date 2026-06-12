## Block empty / £0 quotes from being saved or sent

Scoped guard so blank or zero-total quotes can't reach a customer, plus a tiny backend safety net for sub-30p payment requests. Out of scope: AI generation, connected-account charge path, payment-gating from the previous round.

### 1. `src/routes/quotes.new.tsx` — disable Save/Send when empty

Just above the action bar (near line 1797), derive:

```ts
const hasItems = (draft?.line_items.length ?? 0) > 0;
const hasTotal = total > 0;
const canSend = clientName.trim() && hasItems && hasTotal && !saving;
const blockedReason =
  !clientName.trim() ? "client"
  : !hasItems || !hasTotal ? "items"
  : null;
```

Wire both buttons:

- Draft button (line 1802): `disabled={!clientName.trim() || !hasItems || !hasTotal || saving}`.
- Send button (line 1818): `disabled={!canSend}`. In its onClick, before the `clientName` early-return, add an items/total guard that scrolls to the line-items section (reuse an existing ref if available; otherwise fall back to a no-op return, since the button is already disabled).
- Send button label/colour (lines 1820–1826): extend the existing ternary so the "needs items" state shows `"Add an item ↓"` with the same muted styling already used for `!clientName.trim()`. Three states: missing client → "Add a customer ↑", missing items/total → "Add an item ↓", else "Save & send".

### 2. Inline hint above the action bar

Reuse the existing error-pill styling pattern at lines 1788–1795 (rounded card, `text-xs font-semibold text-ink` + muted subtext). Render conditionally when `blockedReason === "items"` only (the client-name case is already handled by the inline button label, so we don't double up):

```
Add at least one item before sending.
```

Keep it visually distinct from the red "Couldn't save quote" error — neutral paper background, no red accent.

### 3. `src/lib/payments.functions.ts` — Stripe 30p minimum guard

- `createInvoiceCheckout` handler (~line 73, right after `amountCents` is computed): if `amountCents < 30`, throw `"Quote total is too low to request payment (minimum 30p)."` before any Stripe call.
- `createPortalCheckout` handler (~line 254, where `if (amount <= 0)` already throws): change the condition to `if (amountCents < 30)` with the same message wording, so the existing zero check and the new minimum are one branch. Compute `amountCents` just before the check (already happens at line 256).

No changes to the connected-account routing, fees, idempotency, or webhooks.

### Acceptance

- Save and Send are disabled with an inline "Add at least one item before sending." hint when there are zero line items or total is £0.
- A normal quote with a client + items + non-zero total saves and sends exactly as today.
- A payment request for a sub-30p total throws a clear "too low" error instead of a raw Stripe 400.

createPortalCheckout ordering: in the actual code, the existing if (amount <= 0) check is at line 259, but amountCents isn’t computed until line 260 — after the check. So if Lovable replaces line 259 with if (amountCents < 30) as written, it’ll reference amountCents before it’s declared, which is a build error (TDZ on the const). Tell Lovable to move the amountCents computation above the guard (or just guard on amount < 0.30 in pounds instead). The plan’s note says amountCents “already happens at line 256” — that’s slightly off; it’s at 260, below the check, so the declaration genuinely needs to move up. createInvoiceCheckout doesn’t have this problem — there amountCents is at line 65, already above where the guard goes.

Everything else lines up: the UI logic is sound (the three button states with directional arrows are a nice touch), the inline hint is kept distinct from the red error, and the connect routing/fees/webhooks are correctly left untouched.