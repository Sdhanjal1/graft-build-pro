## Problem

In this codebase the only thing that flips a quote to `completed` is the **Job done** action on the quote detail page (`markJobComplete`). Related auto-flows that move a quote's state without the user touching the screen they're looking at:

- Stripe webhook → `accepted` (deposit) / `paid` (full or balance)
- `markOverdueQuotes()` → `completed` → `overdue` once the invoice due date passes
- "Job done" pressed in one tab while the quotes list / chaser / customer page is open in another

Data lives in a module-level `mockQuotes` array hydrated once via `hydrateUserData()`. `useDataVersion()` only re-renders on **local** mutations (`bumpVersion()`). So today:

| Screen | Auto-updates on server status change? |
| --- | --- |
| `quotes.$quoteId.tsx` | ✅ has per-quote realtime channel |
| `quotes.index.tsx` (list, tiles, sections) | ❌ no realtime |
| `chaser.tsx` (Waiting on reply / Waiting to be paid / queue) | ❌ no realtime |
| `clients.$clientId.tsx` (job history) | ❌ no realtime |
| Dashboard tiles (via `mockQuotes` totals) | ❌ no realtime |

Realtime is already enabled on `public.quotes` — just need to subscribe.

## Plan

### 1. New shared hook `src/hooks/useQuotesRealtime.ts`

- Subscribes once per mount to `postgres_changes` on `public.quotes`, scoped with `filter: user_id=eq.${userId}` for `INSERT | UPDATE | DELETE`.
- On UPDATE: find the row in `mockQuotes` by id, patch the changed fields (`status`, `completed_at`, `invoiced_at`, `paid_via`, `due_date`, `invoice_due_date`, `total`, `updated_at`), then `bumpVersion()`.
- On INSERT: push a `rowToQuote()` mapped record, `bumpVersion()`.
- On DELETE: splice it out, `bumpVersion()`.
- After any UPDATE that left the row `completed`, re-run `markOverdueQuotes()` (cheap, idempotent — it just flips locally if the invoice due date passed).
- After any UPDATE that left the row `completed` or moved it to `paid`, call `ensureChasesFor(quote)` / `cancelChasesFor(quote.id)` to keep the chase queue in sync without waiting for the chaser screen to mount.
- Returns nothing; teardown removes the channel on unmount.

To avoid leaking `rowToQuote` / `mockQuotes` mutation logic out of `user-data.ts`, expose two small helpers there:

```ts
export function applyRealtimeQuoteRow(row: DbQuote): void  // upsert + bumpVersion
export function removeRealtimeQuoteRow(id: string): void   // splice + bumpVersion
```

The hook just calls these.

### 2. Wire the hook into the app shell

Add `useQuotesRealtime()` to `src/components/AppShell.tsx` so every authenticated screen (quotes list, chaser, customer detail, dashboard, quote detail) gets one shared subscription per session. This is cheaper than per-page channels and means future screens inherit the behavior for free.

Keep the existing per-quote channel in `quotes.$quoteId.tsx` (it powers the targeted toasts "Customer accepted — nice one." / "Customer declined") — they are now redundant for the data sync but still own the UX side-effects.

### 3. Make sure consumer screens re-render

`quotes.index.tsx` and `chaser.tsx` derive everything from `mockQuotes` on each render. They already need `useDataVersion()` to re-render on bumps:

- `quotes.index.tsx` already calls `useDataVersion()` — verified.
- `chaser.tsx` does **not**; add `useDataVersion()` at the top of `ChaserPage` so realtime patches actually flow into the visible lists/totals.
- `clients.$clientId.tsx` job history — add `useDataVersion()` if missing.

### 4. Auto-escalate overdue on the chaser too

`markOverdueQuotes()` already runs in the chaser `useEffect`. Leave as-is; the new hook also re-fires it whenever a quote lands in `completed`, so a quote that gets marked complete in another tab will surface in "Waiting to be paid" instantly.

### 5. No webhook / payments / database changes

- Webhook still writes `accepted` / `paid` exactly as today.
- `markJobComplete` still writes `completed` + `completed_at` exactly as today.
- No new tables, no new migrations.

## Files touched

- `src/lib/user-data.ts` — add `applyRealtimeQuoteRow` / `removeRealtimeQuoteRow` exports.
- `src/hooks/useQuotesRealtime.ts` — new.
- `src/components/AppShell.tsx` — call the hook.
- `src/routes/chaser.tsx` — `useDataVersion()`.
- `src/routes/clients.$clientId.tsx` — `useDataVersion()` if missing.

## Verification

- Mark a quote complete in one tab → the quotes list, chaser ("Waiting to be paid"), customer detail job history and dashboard tiles update without a refresh.
- Stripe webhook flips a sent quote to `accepted` → "Waiting on a reply" drops it, "Booked" picks it up live.
- Stripe webhook flips an accepted quote to `paid` → it disappears from "Waiting to be paid" and the totals tick down.
- Invoice due date passes → next page mount escalates `completed` → `overdue` and the realtime UPDATE pushes it into the Overdue section everywhere.
