## Goal
Add in-app messaging as the primary quote-sending channel in Quottr while preserving the existing WhatsApp flow, plus a customer portal with two-way messaging and Do Not Disturb working hours.

## Scope

### 1. Send Quote — three-option chooser
Replace the current single Send action with a dialog showing:
1. **Send via Quottr** (recommended badge, primary) — SMS to customer with portal link; all comms inside portal.
2. **Send via Email** — branded email with portal link; same portal experience.
3. **Send via WhatsApp** — existing flow unchanged, with subtle tip: *"Using Quottr keeps your business communication separate from your personal WhatsApp."*

Triggered from existing Send buttons on quote detail / quotes list.

### 2. Customer Portal (public, token-based)
New public route `/portal/$token` where the customer can:
- View the quote
- Approve / request changes
- See documents
- **Message thread** with Nav (two-way)

Token generated per quote on send; no auth required for customer.

### 3. In-app inbox for Nav
- New `Messages` section (or surface inside quote detail) showing message threads per quote/customer
- Real-time updates via Supabase Realtime
- Push/toast notification on new customer message (respecting DND)

### 4. Do Not Disturb (Settings)
- Working hours editor (per-day on/off + start/end times)
- Customisable auto-reply (default provided)
- When customer sends a message outside hours: Nav notifications paused + auto-reply posted into thread

### 5. Database
New tables:
- `quote_portal_tokens` — quote_id, token, expires_at
- `quote_messages` — quote_id, sender ('customer' | 'pro'), body, created_at, read_at
- `working_hours` — user_id, per-day schedule JSON, auto_reply_text, dnd_enabled

RLS: pro sees only their own; portal endpoints use service-role server functions gated by token validation.

### 6. Server functions
- `sendQuoteViaQuottr` — generate token, send SMS (stub/log for now if Twilio not wired), insert audit
- `sendQuoteViaEmail` — generate token, send email via Lovable Emails
- `getPortalQuote(token)` — public, no auth
- `postPortalMessage(token, body)` — public; triggers auto-reply if outside hours
- `postProMessage(quoteId, body)` — auth required

### 7. Keep existing
- WhatsApp send option works exactly as today
- All existing design tokens, components, routes preserved

## Technical Notes
- SMS: if Twilio connector not yet configured, scaffold the call site and surface a clear setup CTA; do not block the flow
- Email: use Lovable Emails (`scaffold_transactional_email`) for branded portal-link email
- Realtime: enable on `quote_messages` for live thread
- Portal route is public — no `AuthGate`; uses token-only server fns with `supabaseAdmin`

## Out of Scope (this iteration)
- Customer-side push notifications
- File uploads inside portal messages (text only first pass)
- Multi-language auto-reply
