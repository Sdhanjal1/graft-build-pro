## Problem

When sending a quote via SMS, WhatsApp, or email, the message contains **two links**:

1. The quote portal link (`/q/<token>`) — what the customer needs
2. "View your quotes and service history" link (`/q/<portal_code>`) — confusing extra

Customer just needs one link to the quote where they can review and approve.

## Fix

In `src/components/SendQuoteDialog.tsx`:

- Remove the `portalHistoryLine()` helper and the `${historyLine}` interpolation from both the SMS and email message bodies.
- Remove the now-unused `fetchClientCode` / `getPortalCodeForQuote` import if nothing else uses it in this file.

Resulting messages:

- **SMS / WhatsApp**: "Hi Sundeep, your quote Q-123 for Bathroom refit is ready. View, ask questions and approve here: [https://quottr.co.uk/q/…](https://quottr.co.uk/q/…)"
- **Email body**: "Hi Sundeep, Your quote is ready to view. You can review it, ask questions and approve from your secure portal: [https://quottr.co.uk/q/…](https://quottr.co.uk/q/…) Thanks."

No backend, schema, or portal route changes — purely a copy/message-template change. The client portal (quotes + service history) still exists at `/q/<portal_code>`; we just stop appending it to outbound quote messages.

&nbsp;