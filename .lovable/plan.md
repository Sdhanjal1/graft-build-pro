## Problem

In `SendQuoteDialog.tsx`, tapping WhatsApp, SMS, or Email currently:
- Opens the share sheet / mailto / sms / wa.me link
- Immediately fires the "Sent to [customer]" toast, plays the success sound, and flips into the success state (which is what marks the quote as sent and engages the auto-chaser).

Because `navigator.share()` resolves on share-sheet open (not on actual send), and `window.location.href = mailto:` / `window.open(waLink)` have no completion signal at all, cancelling or just previewing still marks the quote sent. The trader needs to explicitly confirm.

## Fix

Introduce an intermediate "pending confirmation" step in the dialog. The three handlers open the channel as before but stop short of declaring success. The dialog then shows a "Did you send the quote?" screen with two buttons. Only "Yes, sent" triggers the existing success path.

### State change

Add one piece of state:
- `pendingChannel: SentVia | null` — set after a channel is launched, cleared on confirm/retry.

Keep `sentVia` as-is; it continues to drive the existing success view (which is what persists the "sent" status via the surrounding flow). The success view is only reached after explicit confirmation.

### Handler changes (all three channels)

For `handleQuottr` (SMS / native share), `handleEmail` (mailto), and the inline WhatsApp handler:
1. Open the channel exactly as today (navigator.share, `window.location.href = mailto:`, `window.open(waLink…)`).
2. Remove the immediate `toast.success(...)`, `feedback("success")`, `playSample("whoosh")`, and `setSentVia(...)` calls.
3. Instead, after the launch attempt, call `setPendingChannel("sms" | "email" | "wa")`.
4. For the navigator.share branch in `handleQuottr`: still treat a thrown error as cancellation and fall through to the sms: fallback as today, but do not mark anything sent. After the sms: fallback also set `setPendingChannel("sms")`.
5. The `updatedLinkPortalCode` branch keeps its current behaviour of closing the dialog immediately — that flow is not "mark as sent", it is just sharing an updated link, so no confirmation step is needed there.

### New confirmation view

Render this view when `pendingChannel && !sentVia`, before the existing `sentVia` success block.

Content:
- Heading: "Did you send the quote?"
- Subtext: "Confirm once you've actually sent it to {customerName ?? firstName} via {CHANNEL_LABEL[pendingChannel]}."
- Primary button "Yes, sent": runs the success side-effects that used to fire inline — `toast.success(\`Sent to ${customerName ?? firstName} via ${CHANNEL_LABEL[pendingChannel]}\`)`, `feedback("success")`, `playSample("whoosh")`, then `setSentVia(pendingChannel)` and `setPendingChannel(null)`. This transitions into the existing success/auto-chaser screen, which is the path that records the quote as sent.
- Secondary button "Not yet": `setPendingChannel(null)` to return to the channel picker so the user can retry. No toast, no status change.

Styling: reuse the existing rounded-2xl / `bg-secondary` / `bg-ink text-paper` / `bg-card border border-border` button patterns from the dialog — no new tokens.

### Close behaviour

Update `handleClose` to also reset `pendingChannel`, so dismissing the sheet from the confirmation step does not silently mark the quote sent and does not leave stale pending state next time the dialog opens.

## Out of scope

- The success view, auto-chaser toggle, and downstream "mark as sent" logic outside this dialog are unchanged.
- The "Copy portal link" helper and `updatedLinkPortalCode` flow are unchanged.
- No changes to feedback.ts, sounds, or other components.

## Files

- `src/components/SendQuoteDialog.tsx` — state, three handlers, new confirmation view, `handleClose`.
