## Goal

Remove the bell icon from the home header and fold its unread-count behaviour into the Inbox tab in the bottom nav, with a lime numeric badge instead of the current pulsing dot.

## Changes

### 1. `src/routes/app.tsx`
- Drop the `<NotificationsBell />` render and its import. No replacement in the header.

### 2. `src/components/BottomNav.tsx`
- Add a second query: `useQuery({ queryKey: ["notifications-unread"], queryFn: () => getUnreadNotificationCount(), ... })` using the same options as the bell (refetch 60s, focus refetch, retry false).
- Combine into `totalUnread = quoteRequestsUnread + notificationsUnread`. Pass that to the `/messages` `NavItem`.
- Add a realtime subscription mirroring the bell:
  - channel `inbox-nav:{userId}` on `public.notifications` filter `user_id=eq.{userId}`, invalidates `["notifications-unread"]`.
  - Tear down on unmount. Only run when `session` exists and nav isn't hidden.
- Replace the dot indicator inside `NavItem` with a numeric badge styled like the bell's: `min-w-[18px] h-[18px] px-1 rounded-full bg-lime text-ink text-[10px] font-bold ring-2 ring-ink`, positioned `-top-1 -right-1.5`. Show `99+` when over 99. Keep the existing rule that hides the badge while the tab is `active`.
- Update the `sr-only` label to use `totalUnread`.

### 3. `src/components/NotificationsBell.tsx`
- Delete the file (no other importers after step 1 — verified: only `src/routes/app.tsx` imports it).

## Routing

Tapping the Inbox tab continues to navigate to `/messages` (unchanged). The `/notifications` route stays reachable directly; nothing currently links to it from the home header any more, but the page itself isn't deleted.

## Out of scope

- No change to the notifications page, the notifications server functions, or the messages page contents.
- No change to how unread state is marked read (each surface keeps its own read-tracking).
