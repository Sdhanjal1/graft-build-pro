Building the previously-approved plan. RESEND_API_KEY will be read from `process.env` — if missing or send fails, log and continue. Webhook always returns 200.

## Steps

1. **Migration** — already applied: added `address_line_1`, `address_line_2`, `postcode` to `profiles`.
2. **Settings page** — add the three address inputs under Business Profile, after `town`.
3. **Home prompt** — one-time banner when an existing pro has no full address.
4. **`src/lib/portal-pdf.ts`** — extract pure `generatePortalPdf()` core (already isomorphic). Render full trader address block. For invoice variant: use `paid_at` as invoice date, add green PAID stamp with date + method, add payment reference (stripe_payment_intent or quote ref), add "VAT not applicable" note when not VAT-registered.
5. **`src/lib/invoice-pdf.server.ts`** *(new)* — server-side wrapper returning `Uint8Array`.
6. **`src/lib/email/send-invoice.server.ts`** *(new)* — Resend `/emails` POST via `fetch`. From `"{businessName} <invoices@quottr.co.uk>"`, Reply-To `profile.email`, branded HTML body, PDF attachment. Returns `{ok, error}` — never throws.
7. **`src/routes/api/public/payments/webhook.ts`** — after marking quote paid, load quote+client+profile, build PDF, send email. Entire block wrapped in try/catch; webhook always 200.
8. **`src/routes/portal.$token.tsx`** — when `status === "paid"`, show "Paid ✓ — Download invoice" panel; bottom bar becomes a green Paid pill.

Files touched: `src/routes/settings.tsx`, `src/routes/index.tsx` (or wherever home is), `src/lib/portal-pdf.ts`, `src/lib/invoice-pdf.server.ts` (new), `src/lib/email/send-invoice.server.ts` (new), `src/routes/api/public/payments/webhook.ts`, `src/routes/portal.$token.tsx`, `src/lib/messages.functions.ts` (only if `getPortalData` needs paid_at — will check).