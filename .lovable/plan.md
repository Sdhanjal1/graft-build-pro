## Fix: keep the Overdue tile fresh on the Quotes dashboard

`markOverdueQuotes()` (in `src/lib/user-data.ts`) currently only runs on app bootstrap and on the Chaser screen. The Quotes dashboard's Overdue tile reads `q.status === "overdue"` directly, so if a quote tips past its `invoice_due_date` between sweeps, the tile can be stale.

### Change

In `src/routes/quotes.index.tsx`:

1. Import `markOverdueQuotes` from `@/lib/user-data`.
2. Inside `QuotesPage`, add a mount-time `useEffect` that fires the sweep:
   ```ts
   useEffect(() => {
     void markOverdueQuotes();
   }, []);
   ```
   `markOverdueQuotes` already calls `bumpVersion()` internally on any change, and the page subscribes via `useDataVersion()`, so tiles and the list re-render automatically once the sweep finishes. Fire-and-forget — no await, no loading state, no UI flicker.

### Out of scope

- No changes to `markOverdueQuotes` logic itself.
- No changes to the bootstrap or Chaser call sites.
- No changes to tile rendering or filtering.

### Verification

- Open the Quotes screen → `markOverdueQuotes()` runs once on mount.
- If a `completed` quote's `invoice_due_date` is in the past, its status flips to `overdue` and the Overdue tile count + total update without needing a reload or a visit to the Chaser.
