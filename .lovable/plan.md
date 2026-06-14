# Quotes page → sales pipeline only

Edit `src/routes/quotes.index.tsx` so the hero + tiles surface only sales-stage work (drafts, sent, booked). Money owed (awaiting payment + overdue) collapses to a single "£X to collect →" link into the Chaser. The list below is untouched — every quote (invoiced, overdue, paid) remains findable via the existing section chips and groups.

## Changes (all in `src/routes/quotes.index.tsx`)

1. **Pipeline math** (~lines 79–80): sum only `pending` + `accepted` tiles for `pipelineTotal` / `pipelineCount`.

2. **Secondary tiles** (~line 84): filter to `pending` + `accepted` only; change the tiles grid from `grid-cols-3` to `grid-cols-2` (~line 185).

3. **Hero money sub-lines** (~lines 134–149): replace the awaiting/overdue dot list with a single `<Link to="/chaser">` showing `formatGBP(awaitingTile.total + overdueTile.total)` + "to collect" + `ArrowRight` icon. Only render when `awaitingTile.count + overdueTile.count > 0`.

4. **Delete the Overdue dominant tile** (~lines 153–182) entirely. Overdue still appears in the list's Overdue section.

5. **Subtitle** (~lines 88–90): drop awaiting/overdue parts. Keep pending; add booked count.

6. **PageHeader** (~line 112): remove `urgent={overdueTile.count > 0}` — urgency belongs to the Chaser.

7. **Imports**: add `ArrowRight` to the existing `lucide-react` import. `Link` is already imported.

## Acceptance

- Hero "Pipeline" total = drafts + sent + booked only.
- Two secondary tiles: Drafts & sent, Booked.
- No Awaiting-payment or Overdue tiles in the summary.
- Single "£X to collect →" link into `/chaser` when money is owed.
- List below unchanged — Awaiting/Overdue/Paid sections + chips still present, every quote findable.

## Out of scope

No changes to `/chaser`, the data layer, the list rendering, the SwipeRow chase action, or the quick-actions sheet.
