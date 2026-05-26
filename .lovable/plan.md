## Goal

Auto-send a branded, HMRC-compliant invoice PDF to the customer by email the moment Stripe confirms payment, and surface the same "Paid ✓ — Download invoice" panel on the SMS/WhatsApp token portal.

## 1. Resend integration

- Add Resend as the email provider using `RESEND_API_KEY` (you'll add it as a secret — I'll request it once we're in build mode).
- Sender domain: `invoices@quottr.co.uk`. You must verify `quottr.co.uk` (or a subdomain like `invoices.quottr.co.uk`) in your Resend dashboard separately — I'll flag this. Until verified, sends will fail but the webhook will still succeed.
- Create `src/lib/email/send-invoice.server.ts` — a small server-only helper that takes the quote + profile + client + PDF buffer and calls Resend's `/emails` API directly via `fetch` (no SDK needed, keeps Worker bundle clean).

## 2. Server-side PDF generation

- Refactor `src/lib/portal-pdf.ts`: extract the pure `generatePortalPdf()` core (already isomorphic — jsPDF runs in Workers) so it can be called from server code. Browser-only bits (`navigator.share`, `URL.createObjectURL`) stay in `downloadPortalPdf()`.
- Add a server entry `src/lib/invoice-pdf.server.ts` that builds the PDF as a `Uint8Array` for emailing.

## 3. Webhook wiring

In `src/routes/api/public/payments/webhook.ts`, after the existing `invoice_payments` upsert for `checkout.session.completed` / `payment_intent.succeeded`:

1. Load the quote, client, and pro profile via `supabaseAdmin`.
2. Generate the invoice PDF.
3. Send via Resend with:
  - From: `"{businessName} <invoices@quottr.co.uk>"`
  - Reply-To: `profile.email`
  - Subject: `Invoice {ref} from {businessName} — Paid`
  - HTML body: short branded "Thanks for your payment" with business name, phone, email, and totals
  - Attachment: `Invoice-{ref}.pdf`
4. Wrap in `try/catch` — log failures, never throw. Webhook always returns 200.

## 4. Token portal download

In `src/routes/portal.$token.tsx`:

- When `status === "paid"`, render a "Paid ✓ — Download invoice" card above the bottom bar (matching the visual style of `portal.c.$code.tsx`).
- Button calls `downloadPortalPdf(..., "invoice")` using the data already loaded by `getPortalData`.
- Replace the Accept/Decline bottom bar with a green "Paid" pill when status is paid.

## 5. UK HMRC compliance

Audit + fix `generatePortalPdf` invoice variant. Current state vs required:


| Field                              | Status                                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trader business name               | ✅ in header                                                                                                                                                                                      |
| **Trader address**                 | ❌ profile only has `town` — I'll render whatever address fields exist (business_name, town, phone, email, registration_number) and recommend you add a proper `address` field later if HMRC asks |
| Trader VAT number                  | ✅ in header when vat_registered                                                                                                                                                                  |
| Customer name + address            | ✅                                                                                                                                                                                                |
| Invoice number                     | ✅ (`quote.ref`)                                                                                                                                                                                  |
| Invoice date                       | ⚠️ currently uses `quote.created_at` — change invoice variant to use `paid_at`                                                                                                                   |
| Itemised lines                     | ✅                                                                                                                                                                                                |
| Net subtotal, VAT, gross           | ✅ (adds "VAT not applicable" note when not VAT-registered)                                                                                                                                       |
| **PAID indicator + date + method** | ❌ — add a green "PAID" stamp box with payment date + "Paid by card via Stripe"                                                                                                                   |
| **Payment reference**              | ❌ — add the Stripe payment intent / quote ref                                                                                                                                                    |


I'll pass `paid_at`, `payment_method`, and `stripe_payment_intent` into the PDF generator for the invoice variant only.

## Files touched

- `src/lib/portal-pdf.ts` — extract core, add PAID stamp + payment metadata for invoice variant, use paid_at as invoice date
- `src/lib/invoice-pdf.server.ts` *(new)* — server-side PDF builder returning `Uint8Array`
- `src/lib/email/send-invoice.server.ts` *(new)* — Resend API call + HTML email template
- `src/routes/api/public/payments/webhook.ts` — call PDF + email after successful payment (best-effort)
- `src/routes/portal.$token.tsx` — Paid panel + download button
- `src/routes/invoices.$quoteId.tsx` — pass paid_at/method so the pro's download also includes PAID stamp (small follow-on so both paths produce the same legal invoice)

## Open question

The `profiles` table doesn't currently store a full street address — only `town`. Do you want me to (a) add an `address` column to `profiles` + a settings field for it now, or (b) ship with just business name + town + phone + email + registration number on the invoice and add a proper address later? HMRC strictly requires a trader address on a VAT invoice.

On the HMRC compliance open question: go with option (a). 

Add the address fields properly now.

1. Add columns to profiles table:

- address_line_1 (text)

- address_line_2 (text, nullable)

- postcode (text)

(Keep the existing town column for backwards compatibility 

or rename it to city.)

2. Add the input fields to settings.tsx under Business 

Profile, after the existing town field:

- Address line 1 (required for VAT-registered traders)

- Address line 2 (optional)

- Postcode (required for VAT-registered traders)

3. On the invoice PDF, render the full address as:

[business_name]

[address_line_1]

[address_line_2] (if present)

[town], [postcode]

[phone] · [email]

VAT: [vat_number] (if VAT-registered)

4. Show a one-time prompt on the home screen for existing 

traders without a full address set: "Add your business 

address for HMRC-compliant invoices."

This must happen before any real invoices are sent to real 

customers.

Update the Resend email configuration so:

From: "[Business Name] <[invoices@quottr.co.uk](mailto:invoices@quottr.co.uk)>"

Reply-To: [trader's email from their profile]

This means customer replies go directly to the trader who 

sent the invoice, not to a Quottr inbox. The "invoices@" 

address is for branded sending only — no mailbox needed.

I will verify the [quottr.co.uk](http://quottr.co.uk) domain in Resend with the 

required SPF and DKIM DNS records before going live.