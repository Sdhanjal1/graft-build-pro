## What's congested today

Looking at `src/routes/messages.tsx`, the page stacks a lot of competing UI on one screen:

1. **5 filter chips** (All / Unread / Requests / Notifications / Messages) — three of them duplicate what "All" already shows.
2. **3 separate sections** rendered simultaneously on the default "All" view (Quote requests, Messages, Notifications), each with its own H2 + count + list, so the eye has nowhere to rest.
3. **Repeated metadata** on every card: icon avatar, title, ref (#ABCD), preview line, relative time, unread dot, per-row menu — all at full weight.
4. **Bulk-action menu always visible** in the header even when there's nothing to act on.
5. **Section headers compete with the page header** ("Inbox" + subtitle + Quote requests + Messages + Notifications all visible at once).

## Recommendations

### 1. Collapse 3 sections into one chronological feed

On the default view, merge requests + messages + notifications into a **single time-sorted list**. Group by day with lightweight sticky dividers (`Today`, `Yesterday`, `This week`, `Earlier`) instead of by type. The item's icon + colour already tells the user what kind it is — they don't need a section header too.

### 2. Reduce filters from 5 to 3

Replace the chip row with three tabs:

- **All** (default)
- **Unread** (with count badge)
- **Requests** (kept as its own tab because these are revenue actions)

Drop the standalone "Messages" and "Notifications" filters — power users can still see only one type by tapping an item's icon, but they don't need top-level chips for it. This halves the chrome above the feed.

### 3. Tighter, calmer cards

- One line for title, one line for preview, time right-aligned.
- Drop the `#ABCD` ref from the row (show it on the detail page).
- Replace the per-row dropdown with **swipe-to-delete / swipe-to-mark-read** (already used elsewhere via `SwipeRow`), so the row itself is just content.
- Unread = subtle left border + bolder title, not a separate dot + badge + colour.

### 4. Move bulk actions out of the header

Hide the `MoreHorizontal` menu by default. Show a "Select" affordance only when the list has ≥ 5 items, and surface "Mark all read" inline as a small text button at the top of the feed **only when `totalUnread > 0**`. This removes a permanent control most users never tap.

### 5. Quieter page header

Keep "Inbox" + subtitle, but drop the subtitle when empty/loading states already say the same thing ("All caught up" appears in two places today).

### 6. Empty-state cleanup

When a filter yields zero items, show one centred `EmptyState` instead of three empty section shells.

## Files touched

- `src/routes/messages.tsx` — the entire restructure lives here. No backend or data-layer changes; this is purely presentation. Server functions (`getInbox`, `getMyIncomingRequests`, `listMyNotifications`) and realtime subscriptions stay untouched.
- Possibly reuse `src/components/SwipeRow.tsx` for the new row interactions (already in the project).

## What I will NOT change

- Data fetching, realtime, mark-read/delete server functions.
- Navigation targets when a row is tapped.
- The `quote_requests` / `notifications` / `quote_messages` schemas.

## Open question before I build

Do you want me to **keep "Requests" as its own tab** (my recommendation, since unanswered requests = money) or fold everything into just **All / Unread**? Either works — the first protects request visibility, the second is the most minimal. - Yes 