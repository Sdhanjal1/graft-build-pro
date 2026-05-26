# Add accept/decline to quote portal + remove customer messaging

## Goal
The single-quote portal at `/portal/$token` (what `/q/<code>` resolves to) currently shows the quote but has no Accept/Decline action and ships a customer messaging thread. Add accept/decline as the primary action; drop the messaging UI everywhere on the customer side. Pros can still use WhatsApp via existing share buttons.

## Changes

### 1. `src/lib/messages.functions.ts`
Add a new public server fn `respondToQuoteByToken` (mirrors the existing `respondToQuote` in `portal.functions.ts`, but keyed by token instead of portal code):
- Input: `{ token, response: "accepted" | "declined" }`
- Resolves the token → quote, sets `quotes.status` to accepted/declined (only if currently `pending` or `sent`)
- Inserts a system row into `quote_messages` so it shows up in the pro's inbox/timeline
- Pushes a notification to the pro via `notifyUser`
- Returns `{ status }`

### 2. `src/routes/portal.$token.tsx`
- Show current status. If `pending`/`sent`: render two sticky bottom-bar buttons — **Accept quote** (filled lime) and **Decline**. Show a confirm before declining.
- If `accepted`: replace bottom bar with a green "Accepted ✓" pill; show a small success banner under the total.
- If `declined`: show a muted "Declined" pill; offer no action.
- If `paid`/`invoiced`: hide buttons.
- **Remove the entire Messages section** (heading, thread, composer, realtime channel, `MessageSquare` icon, `postPortalMessage` import, message state).

### 3. `src/routes/portal.c.$code.tsx` (client portal hub)
- Remove the Messages section (`#messages` anchor target, composer, message list) and the "Tap to send … a message" CTA on the service-reminder card (make it a plain status card).
- Keep quote list, documents, service reminder header.

### 4. Keep but don't surface
- `postPortalMessage` / `postClientPortalMessage` server fns stay in place (unused by UI). No DB / RLS changes. If/when messaging comes back we just re-wire the UI.
- Pro-side inbox (`/messages` route) is untouched — pros may still see existing historical customer messages.

## Out of scope
- No DB migrations.
- Pro-side outbound WhatsApp/SMS flow is unchanged (already removed the second portal link in the previous change).
- No design exploration — using the same lime/ink tokens already in the portal.

## Files touched
- `src/lib/messages.functions.ts` — add `respondToQuoteByToken`
- `src/routes/portal.$token.tsx` — add accept/decline, strip messaging
- `src/routes/portal.c.$code.tsx` — strip messaging section + reminder CTA
