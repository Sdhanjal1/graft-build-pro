## Goal

Add an in-app notifications inbox so you can see anything a push notification would have fired — even if the push was missed (silenced, offline, browser closed, dead subscription).

## Approach

Persist every notification at the same point we already call `notifyUser(...)`, then show them in an inbox UI with unread tracking. Push delivery is unchanged.

### 1. New table `public.notifications`

Columns (domain-specific only):
- `user_id` — owner (the pro who should see it)
- `title`, `body` — same strings already passed to `notifyUser`
- `url` — deep link the row opens
- `kind` — short tag, e.g. `quote_request`, `customer_message`, `portal_message`, `quote_accepted`, `quote_declined`, `payment_paid`, `service_reminder`, `test`
- `tag` — the existing dedupe tag (used as a uniqueness hint per user to prevent duplicates on Stripe webhook replays)
- `read_at` — nullable timestamp

RLS: owner-only read/update/delete; inserts via service role from server functions. GRANTs for `authenticated` + `service_role` (no `anon`). Index on `(user_id, read_at, created_at DESC)`. Unique partial index on `(user_id, tag)` where `tag is not null` so replayed Stripe events / cron reruns don't double-log.

### 2. Server: one helper, all existing call sites

Add `recordNotification(...)` in `src/lib/notifications.server.ts`. Then refactor `notifyUser` in `push.server.ts` to optionally persist before sending push (or add a sibling `notifyAndRecord` and switch the seven call sites to it — leaning toward the latter so callers stay explicit). Either way, every existing trigger gets an inbox row:

- new quote request → `quote-requests.functions.ts`
- new customer message (token portal) → `messages.functions.ts` (×2: message + accept/decline)
- portal client message + accept/decline → `portal.functions.ts` (×2)
- Stripe payment paid (deposit / full / balance) → `payments-webhook-shared.server.ts`
- daily service reminder cron → `api/public/hooks/service-reminders.ts`
- `sendTestPush` → also writes a `kind: "test"` row

Persistence wrapped in try/catch so a DB failure never blocks the underlying flow (same posture as push today).

### 3. Server functions (`src/lib/notifications.functions.ts`)

All `requireSupabaseAuth`:
- `listMyNotifications({ limit?, before? })` — paginated, newest first, returns `{ items, unreadCount }`
- `markNotificationRead({ id })`
- `markAllNotificationsRead()`
- `deleteNotification({ id })` (optional, low cost)

### 4. UI

- New route `src/routes/_authenticated/notifications.tsx` (inbox list):
  - Tabs: All / Unread
  - Each row: title, body, relative time (`x min ago`), kind icon, click → navigate to `url` and mark read
  - "Mark all as read" button
  - Empty state
- Bell icon in the app header with unread badge — opens `/notifications`. Lightweight realtime: subscribe to `postgres_changes` on `notifications` filtered by `user_id` so the badge updates live without polling. Falls back gracefully if realtime is off.
- Settings page: keep the existing push toggle exactly as-is; add a one-line note "You can also view notifications anytime in your inbox."

### 5. Backfill

None. Inbox starts populating from the moment the migration ships. Historic events don't get retro rows (we don't have the data).

## Out of scope

- No changes to push payload, VAPID, service worker, or the seven trigger sites' business logic — only an added record + same `notifyUser` call.
- No email digest of unread notifications.
- No per-kind notification preferences (mute payments, etc.) — easy to add later if you want.

## Questions before I build

1. **Header bell placement** — there's an app shell with a top bar; OK to add the bell next to the existing user menu, or do you want it somewhere specific (e.g. mobile bottom nav too)?
2. **Realtime updates for the badge** — fine to enable Realtime on the `notifications` table (negligible cost given low row volume), or prefer simple polling every 60s?
3. **Auto-delete old rows?** Keep forever, or auto-prune read items older than 90 days via a daily cron? I'd default to "keep forever" — small table, useful audit trail.