## Inbox polish pass (`src/routes/messages.tsx`)

Apply the same density, hierarchy and status-dot patterns established in earlier passes. UI/presentation only — no backend, no thread/composer build (deferred).

### Header & summary
1. `PageHeader` subtitle: replace `"Requests and chats"` placeholder with a single source of truth even while loading. Build it from cached counts so it doesn't flash. Format: `"3 requests · 2 new · 5 chats"`; drop segments that are zero. When everything is zero, show `"All caught up"`.
2. Promote `… new` indicator from text to an amber/lime status dot inline with the count, matching the dot pattern used on Clients.

### Quote requests section
3. Section heading row: drop the duplicate `n new` pill in the header (already in subtitle). Keep heading clean: `Quote requests` + a muted count `(3)`.
4. Request card chrome: tighten to `p-3.5`, avatar `h-10 w-10` already fine but switch unread treatment from `ring-1 ring-lime` to a left status bar (`before:absolute before:left-0 before:top-3 before:bottom-3 before:w-0.5 before:bg-lime before:rounded-full` on a `relative` card). Less shouty, matches Clients duplicate-warning pattern.
5. Add a small unread dot (lime, `h-1.5 w-1.5 rounded-full`) inline before the title for unread requests; remove the `ring`.
6. Title line: hierarchy — `New request` muted `text-[11px] uppercase tracking-wide`, customer name on its own line as `text-sm font-semibold text-ink`. Phone moves next to name as a muted suffix `· 07…`.
7. Timestamp: use the shared relative-time formatter already used elsewhere ("2h", "yesterday", "Mon") instead of full date — consistent with Clients/Quotes list.
8. Body preview: keep `line-clamp-2`, bump to `text-[13px]` for legibility on the small viewport (550px).
9. Actions row: keep the single `Create quote` CTA but switch styling to `bg-lime text-ink` to match the project's primary action token (currently `bg-ink text-paper`, which clashes with Clients/Quotes primaries). Add a secondary ghost `Mark as read` for unread requests so users can dismiss without creating a quote.
10. Wrap the whole row click in a non-button `<div role="button">` so the inner `Create quote` Link and `Mark as read` ghost button don't nest interactive elements (currently invalid: button-inside-button).

### Messages (threads) section
11. Heading: keep `Messages` but right-align a muted unread total when `>0`: `Messages · 4 unread`.
12. Thread card: tighten to `p-3.5`, avatar `h-9 w-9`, swap generic `MessageSquare` icon for customer initial in a `bg-secondary` circle when we can derive it from the last message; fall back to the icon.
13. Sender label: replace literal "Customer" with the customer's name when resolvable from the quote (deferred — `threads` only has `quote_id`); for now, prefix with quote ref short-form (`#A1B2 · Customer`) so users can tell threads apart at a glance.
14. Move the unread `n` pill to the left as a small lime dot before the sender label, with the numeric count only when `>1` (`+3`), matching the request pattern.
15. Timestamp: same shared relative formatter as requests.
16. Body preview: `text-[13px]`, single-line `truncate` stays. Prefix `system` sender with a small `bg-secondary` "Auto" chip.

### Empty / loading
17. Loading: replace `Loading…` text with a skeleton list (3 request cards + 3 thread cards) using `animate-pulse bg-secondary` blocks — same skeleton helper used in Clients list.
18. Empty state: keep the existing `EmptyState` but only show when BOTH requests and threads are empty (currently correct). When only threads are empty but requests exist, render nothing under the Messages heading — drop the heading entirely in that case to avoid an orphan section.

### Out of scope (explicit)
- Building the in-app thread view & composer on `quotes.$quoteId.tsx` (`listQuoteMessages`/`sendProMessage` remain unwired).
- `getInbox`, `getMyIncomingRequests`, `markRequestRead` server fns.
- Realtime subscription logic.
- Push/`Notification` permission UX.
- Resolving customer name from `quote_id` for threads (requires a join change in `getInbox`).

### Files touched
- `src/routes/messages.tsx` (only)
- Possibly a tiny shared `formatRelativeShort` helper if not already exported — reuse existing if present.
