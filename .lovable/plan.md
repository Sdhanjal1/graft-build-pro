# Quote page: live status + calmer sent-state CTA

Scope is `src/routes/quotes.$quoteId.tsx` only. No server, schema, portal, or payment changes.

## 1. Realtime sync of quote status

Add a `useEffect` that opens a single Supabase channel filtered to this quote's id:

```ts
supabase.channel(`quote-${quote.id}`)
  .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'quotes', filter: `id=eq.${quote.id}` },
      (payload) => { /* sync local status */ })
  .subscribe();
```

On payload:
- If `new.status !== statusState`, call `setStatusState(new.status)` and refresh related local fields already mirrored in state (`invoicedAt`, `completedAt`, `paidAt` if present on the row).
- When transitioning `sent → accepted`, fire a subtle toast: *"Customer accepted — nice one."* + `feedback("success")`. For `sent → declined`, toast *"Customer declined."* with no celebratory sound. Skip toasts if the change originated from this tab (track a `localChangeRef` set inside `acceptQuote`/`declineQuote`/`setQuoteStatus` callers, cleared after ~1.5s).
- Tear the channel down in the effect cleanup with `supabase.removeChannel(channel)`.

`quotes` is already in scope via existing reads; RLS already restricts to the owner, so the subscription is safe.

## 2. Sent-state action bar rework

In the `primary` resolver (lines ~658-693), replace the `status === "sent"` branch:

- **With client phone present** → primary becomes `{ label: "Nudge customer", icon: MessageCircle, onClick: () => setSendOpen(true) }`. Reuses `SendQuoteDialog` which already supports re-sharing the portal link via the native share sheet.
- **Without phone** → primary becomes `{ label: "Copy portal link", icon: Copy, onClick: copyPortalLink }` (extract the existing copy helper from `SendQuoteDialog` path, or call `ensurePortalToken` inline — already imported elsewhere in the file).

Remove the separate `showChaseSecondary` WhatsApp button on the left (lines 1055-1067) — nudge is now the primary, so the dual-CTA clutter goes away.

## 3. "Waiting on customer" pill

When `status === "sent"` AND no nudge is appropriate (e.g. fewer than ~12 hours since send, no phone/email on file, OR user has just hit "Nudge" — track `nudgedAt` in local state for 60 minutes), render a calm pill in the bar slot instead of the lime button:

```tsx
<div className="flex-1 rounded-full bg-card border border-border py-3.5 inline-flex items-center justify-center gap-2 text-sm text-muted-foreground">
  <span className="relative inline-flex h-2 w-2">…pulsing amber dot…</span>
  Waiting on customer
</div>
```

Conditions for showing the pill instead of the Nudge button:
- `status === "sent"` AND
- (`Date.now() - sentMs < 12h`) OR (`nudgedAt && Date.now() - nudgedAt < 60min`) OR (no phone and no email).

## 4. Move manual accept into the overflow menu

In the More-actions sheet (around line 1025 "Status" group), add — only when `status === "sent"`:

```tsx
<MoreItem icon={ThumbsUp} label="They said yes (mark accepted)" onClick={acceptQuote} />
<MoreItem icon={XCircle} label="They said no (mark declined)" onClick={declineQuote} />
```

(The "Mark declined" item already exists on line 1030-1032; keep it but ensure it sits in the same group.)

When the user taps the manual accept, fire a one-time toast:
*"Marked as accepted. Tip: if your customer uses the link, this happens automatically."* Gate with `localStorage.getItem('quottr.manual-accept-tip-seen')` so it only shows once per device.

## 5. Reduce remaining CTA clutter on sent state

- The duplicate "Chase on WhatsApp" entry in the overflow (line 970-977) stays — it covers WhatsApp specifically; "Nudge customer" uses the share sheet.
- Remove the standalone "Mark sent" overflow item only when `status === "sent"` (already conditional — verify).
- No other action bar changes for `pending`, `accepted`, `paid`, `completed`, `declined`.

## Out of scope

Portal accept/decline server functions, push notifications, inbox rows, deposit/payment logic, SendQuoteDialog internals, and any DB migrations.

## Files touched

- `src/routes/quotes.$quoteId.tsx` (only)
