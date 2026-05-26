## What I checked

I traced the WhatsApp share flow end-to-end:

1. **`SendQuoteDialog`** (the "Send via WhatsApp" button) builds the portal URL like this:
   - If the quote has a saved client with a `portal_code` → uses `https://quottr.co.uk/q/{client.portal_code}` ✅
   - **Fallback** (no client / no portal_code) → calls `ensureToken({ quoteId, channel: "whatsapp" })` to mint a row in `quote_portal_tokens`, then builds `https://quottr.co.uk/q/{token}` ❌

2. **`/q/$code`** unconditionally redirects to **`/portal/c/$code`**.

3. **`/portal/c/$code`** calls `getClientPortalData`, which only looks up the `clients` table by `portal_code`. It has no idea what a `quote_portal_tokens.token` is, so the fallback path lands on **"Portal not available"**.

So the WhatsApp link works for quotes attached to a saved client, and is broken for quotes without one (ad‑hoc / unsaved customer). There is also a legacy `/portal/$token` route that *does* understand quote tokens, but nothing in the share flow points users there anymore.

A secondary minor risk: the `og:image` is added on the root route as well as `/portal/c/$code`, which can cause the root image to override the portal share image on some scrapers — worth checking but not the main issue.

## Proposed fix

Pick **one** of:

**A. Make `/q/$code` smart (recommended).** Change `q.$code.tsx` from a static redirect into a tiny server route that:
   - Looks up `clients.portal_code = code` → redirect to `/portal/c/{code}`.
   - Else looks up `quote_portal_tokens.token = code` → redirect to `/portal/$code` (the existing per-quote portal).
   - Else 404.
   
   This keeps the short `/q/…` link universal and unblocks every WhatsApp share without changing how SendQuoteDialog builds URLs.

**B. Change the SendQuoteDialog fallback** to build `/portal/{token}` directly (skipping `/q/`) when there is no client portal_code. Simpler, but loses the branded short URL for that case and means scrapers see a different OG path.

I'd go with **A**. Estimated change: ~15 lines in `src/routes/q.$code.tsx`, no schema changes.

## Verification after fix

- Quote with saved client → WhatsApp link opens client portal showing the quote.
- Quote without a saved client → WhatsApp link opens the per-quote portal.
- Invalid code → friendly "Portal not available" page (already handled downstream).
