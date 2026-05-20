# Customer Portal — Magic Link Implementation

A per-client permanent portal at `/portal/[12-char-code]` showing all their quotes, documents, and a messaging thread — no login required.

## Scope

Replaces the current per-quote portal token model with a per-client portal code. Existing `/portal/$token` (per-quote thread) stays for backward compatibility; new client-wide portal lives at `/portal/c/$code`.

## Database changes (one migration)

1. **`clients`** — add columns:
   - `portal_code text unique` (12-char alphanumeric, auto-generated)
   - `portal_active boolean default true`
   - `service_due_date date null`
   - `service_type text null`
2. **`quotes`** — add `portal_visible boolean default true`
3. **New table `client_documents`**:
   - `id`, `user_id`, `client_id`, `title`, `kind` (cert/service/warranty/other), `file_url`, `portal_visible boolean default true`, timestamps
   - RLS: owner-only manage
4. **New table `client_portal_messages`** (client-wide thread, distinct from per-quote `quote_messages`):
   - `id`, `user_id`, `client_id`, `sender` (pro/customer), `body`, `read_at`, timestamps
   - RLS: owner-only manage
5. **Storage bucket `client-docs`** (public read), RLS on objects: owner write under `{user_id}/...`
6. **Trigger**: on `clients` insert, populate `portal_code` if null (12-char base36 random).
7. **Backfill**: existing clients get a `portal_code`.

## Server functions (new file `src/lib/portal.functions.ts`)

- `getClientPortalData({ code })` — public (admin client). Returns: `{ client: { first_name, business_name_pro, logo_url, service_due_date, service_type }, quotes: [...portal_visible & completed-ish], documents: [...portal_visible], messages: [...] }`. Returns 404 if `portal_active=false` or code unknown.
- `postClientPortalMessage({ code, body, firstName?, lastName? })` — public. Inserts customer message; optionally updates `clients.name` once if blank.
- `regeneratePortalCode({ clientId })` — auth, regenerates code.
- `togglePortalActive({ clientId, active })` — auth.
- `toggleQuotePortalVisible({ quoteId, visible })` — auth.
- `toggleDocumentPortalVisible({ documentId, visible })` — auth.
- `listClientDocuments({ clientId })` / `uploadClientDocument` / `deleteClientDocument` — auth.
- `sendProClientMessage({ clientId, body })` / `listClientPortalMessages({ clientId })` — auth.

## Customer-facing route — `src/routes/portal.c.$code.tsx`

Public route. Flow:
1. Fetch portal data via server fn.
2. Check `localStorage[`quottr_portal_${code}_name`]` — if missing, show name confirmation card (first + last name → Confirm). Save to localStorage; POST to server so pro sees the customer name.
3. Header: business logo (via `BusinessLogo`), business name, "Hi {firstName}".
4. Gold service-due card if `service_due_date` within 60 days → tap opens message composer.
5. **Your quotes & jobs** — list cards (date, title, total, StatusBadge). Tap to expand line items; Download PDF button per quote (links to existing invoice/quote PDF).
6. **Your documents** — list visible docs with download button.
7. **Messages** — simple thread (pro/customer bubbles), composer at bottom.
8. **Request a new quote** — big lime button → `/request/$proId`.
9. Footer: "Powered by Quottr" → quottr.co.uk.

Design: dark ink bg, lime green CTAs, Bebas Neue headings, DM Sans body — matches existing portal route.

## Pro-side controls — `src/routes/clients.$clientId.tsx`

Add a **Customer portal** section:
- Portal URL display + Copy + Share buttons
- Regenerate link button (confirm dialog)
- Preview portal button (opens `/portal/c/{code}` in new tab)
- Portal active toggle
- Documents list with per-row visibility toggle + upload button + delete
- Quotes list (existing) with per-row "Show in portal" toggle
- Service reminder fields (service type, due date)

## Quote send messaging

Update `SendQuoteDialog` (and any SMS/email body builder) to append:
```
View your quotes and service history: https://quottr.co.uk/portal/c/{portal_code}
```
when sending. Use the client's `portal_code` from the quote's `client_id`.

## Files

**Created**
- `supabase/migrations/<ts>_customer_portal.sql`
- `src/lib/portal.functions.ts`
- `src/routes/portal.c.$code.tsx`
- `src/components/portal/PortalQuoteCard.tsx` (expandable card)
- `src/components/portal/PortalNameGate.tsx`
- `src/components/portal/PortalMessageThread.tsx`

**Edited**
- `src/routes/clients.$clientId.tsx` — portal management UI
- `src/components/SendQuoteDialog.tsx` — append portal link
- `src/integrations/supabase/types.ts` — regenerates after migration

## Security notes (as specified)

- 12-char base36 = ~62 bits, unguessable enough for non-financial data.
- Public route, no PII shown beyond what client already knows (their own quotes/docs).
- No bank/card details exposed.
- Pro can regenerate code to invalidate shared links.
- `portal_active=false` returns "Portal disabled" page.

## Not in scope

- Real-time messaging (simple poll on load, per spec).
- Replacing existing `/portal/$token` per-quote portal.
- Email/SMS sending infra (we only append the URL to message bodies — the user's existing flow handles delivery).
