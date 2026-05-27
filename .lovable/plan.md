## Step 11 — Unmissable home-screen status

Today the `/app` header already shows "You are owed £X" plus three small stat pills (to send / awaiting / overdue) and the action-queue cards below. What's missing is the **win signal** — when a customer accepts a quote or a payment lands, nothing on the home screen celebrates or quantifies it. The goal of Step 11 is to make today's money status the first thing the trader sees, without redesigning the whole screen.

### Changes

1. **`src/lib/user-data.ts` — extend `stats()`**
   - Add `paidToday` (sum of `mockTransactions` dated today) and `paidTodayCount`.
   - Add `acceptedToday` (count of quotes whose `status` is `accepted` and `updated_at` is today) and `acceptedTodayAmount`.
   - Add `awaitingReplyCount` (quotes with `status === "sent"`) and `awaitingReplyAmount`. Today the page lumps `sent` and `accepted` into one "awaiting" pill — split them so "accepted but unpaid" reads as a win, not as a chase.

2. **`src/routes/app.tsx` — header block**
   - When `paidTodayCount > 0`, replace the small lime "You are owed" number with a **two-line hero**:
     - Line 1 (smaller, paper/70): `Paid today` · big lime `£X` · `(N payments)`
     - Line 2 (smaller): `You are owed £Y` linking to `/chaser`
   - When `paidTodayCount === 0` but `acceptedToday > 0`, show a `Won today: £X` line above "You are owed" using the same lime treatment.
   - Keep CountUp animation on the dominant figure.
   - Update the stat-pill row: replace the single `awaiting` pill with two pills — `accepted` (neutral lime tone, links to `/quotes?filter=accepted`) and `awaiting reply` (neutral paper tone, links to `/chaser`). Keep `to send` and `overdue` as-is.

3. **`src/routes/app.tsx` — action queue**
   - Split the existing "Awaiting payment" ActionCard into two cards: `Accepted — book in` (lime border, CTA "Schedule") and `Awaiting reply` (neutral border, CTA "Chase up"). Order: to-send → accepted → awaiting reply → overdue.

4. **Tile copy & sizing**
   - Bump the action-card title from `text-sm` to `text-base font-semibold` and the amount from `text-[11px]` to `text-xs` so the figures are legible at arm's length on a 390px viewport. No structural CSS changes elsewhere.

### Out of scope
- Push/email notifications for these events (Step 10 already done; Step 14 covers receipts).
- Realtime updates — page already refetches on focus via existing query setup, that's enough.
- Empty-state redesign — if there's no money news, header degrades to today's existing layout.
- Chaser-cadence changes (Step 13).

### Verification
- Seed: one quote marked paid today, one accepted today, one sent yesterday, one overdue.
  - Header reads `Paid today £X (1 payment)` in giant lime, then `You are owed £Y` underneath.
  - Pills: `1 to send`, `1 accepted`, `1 awaiting`, `1 overdue` — four distinct chips, accepted in lime, awaiting in neutral.
  - Action cards: four cards in the order to-send / accepted / awaiting / overdue, each with its CTA.
- Zero state (no quotes): header collapses to greeting + mic, no empty tiles.
- Only-paid state: pills row hidden, just `Paid today £X` hero.
- 390×844 viewport: every figure fits one line, no horizontal scroll.
