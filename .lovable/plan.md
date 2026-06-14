## Unified chaser (B1) — Awaiting a reply

Add a manual "Awaiting a reply" section to the chaser, above the existing payment chasing. No new automation.

### Part 1 — `src/lib/user-data.ts`

Insert after `buildChaserMessage` (line 789), before `stats` (line 791):

```ts
export const buildQuoteReplyNudge = (quote: Quote, clientFirstName: string) => {
  const first = clientFirstName || "there";
  const amount = formatGBP(quote.total);
  const signOff = `Thanks, ${userProfile.full_name.split(" ")[0]}`;
  const footer = "\n\nSent via Quottr.";
  return (
    [
      `Hi ${first}, just following up on the quote I sent over for ${quote.title} (${amount}).`,
      `No rush — just wanted to check it reached you and see if you had any questions. Happy to go through anything.`,
      signOff,
    ].join("\n") + footer
  );
};
```

### Part 2 — `src/routes/chaser.tsx`

- Add `buildQuoteReplyNudge` to the existing `@/lib/user-data` import.
- Add `daysSince(iso?)` helper next to `daysOverdue`.
- Near the existing derived data, add:
  ```ts
  const awaitingReply = mockQuotes.filter((q) => q.status === "sent");
  const replyTotal = awaitingReply.reduce((s, q) => s + q.total, 0);
  const hasReplies = awaitingReply.length > 0;
  const hasPayments = overdue.length > 0 || due.length > 0 || upcoming.length > 0;
  ```
- Update both `PageHeader` instances (hydrating + main): `title="Chaser"`, `subtitle="Replies & payments"`.

**Body branches:**

1. **Both empty** (`!hasReplies && !hasPayments`): render only the existing `EmptyState` (icon ThumbsUp, celebrate tone). Title "Nothing to chase", body "No quotes waiting on a reply, and nothing owed. Nice work." Remove the old inline `{overdue.length === 0 && <EmptyState…>}` at the bottom of the payment list.
2. **Awaiting a reply** (`hasReplies`): new section placed first (after PageHeader). Header row: `h2 "Awaiting a reply"` + muted count/total. For each sent quote, a `card-surface` mirroring the overdue card but: neutral `text-ink` amount (not red), `bg-status-sent/15 text-status-sent` chip showing "Sent today" / "Sent X days ago" from `daysSince(q.updated_at ?? q.created_at)`, and three actions: Nudge (WhatsApp via `buildQuoteReplyNudge` + `waLink`), Call (`tel:`), Email (`mailto:` with subject `Quote {ref}, {business_name}`). No pause-auto-chase button.
3. **Awaiting payment** (`hasPayments`): wrap the existing "You are owed" card, Auto-chase queue, and `overdue.map` cards in `{hasPayments && (...)}` unchanged. Optionally add `<h2 className="text-lg px-5">Awaiting payment</h2>` above the owed card for symmetry.

### Notes

- `MessageCircle` / `Phone` / `Mail` already imported.
- `bg-status-sent` token already exists (used on quotes list).
- "Chase up" home tile now lands on a populated screen.
- `updated_at` may make a freshly-edited quote show "Sent today" — acceptable.

### Out of scope

Automation for reply nudges, schema changes, settings, quote-preview work.

### Acceptance

- Chaser shows "Awaiting a reply" (sent quotes with Nudge/Call/Email) above "Awaiting payment" (unchanged).
- When both empty, one clean "Nothing to chase" screen.
- Reply totals render in neutral ink, payment totals stay red.

Three quick things to eyeball:

	∙	“Awaiting a reply” renders above “Awaiting payment”, not below.

	∙	Sent-quote amounts are neutral ink, invoice amounts stay red — easy to confirm at a glance.

	∙	With your current data (2 sent, no unpaid invoices) you should see the reply section populated and no payment section and no empty state — that’s the exact case that was broken before.