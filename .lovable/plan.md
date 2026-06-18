## Scope

Refactor two screens to match the picked prototypes. Frontend/presentation only. No data, routing, or business-logic changes.

- `src/routes/quotes.index.tsx` → "Focal status card" direction
- `src/routes/chaser.tsx` → "Brutalist focal card" direction

Existing tokens in `src/styles.css` (ink/paper/lime, Bebas, DM Sans) are already aligned with the prototypes, so no new tokens — only verify the lime hex matches (`#D9FF00` quotes / `#D4FF00` chaser → snap both to the existing `--lime` token) and reuse it.

## Quotes list (`quotes.index.tsx`)

1. **Hero card** — keep ink card; inside it stack: `QUOTES` eyebrow, lime-pill status (`1 PENDING` / dynamic count), `+ NEW` lime pill on the right, then `PIPELINE` eyebrow with the £ total in lime Bebas (60–64px). Single source of truth for the total (already computed).
2. **Stat tiles** — two equal cream/white tiles below: `AWAITING SENT` and `ACCEPTED`, each with a Bebas 24px £ value. Replace current bordered tiles.
3. **Search** — plain rounded muted input (no border, soft fill), keeps existing controlled state.
4. **Section header** — `DRAFTS & SENT` left, `{n} TOTAL` right, both 10px black uppercase at 40% opacity.
5. **Row card** — white rounded-3xl card containing rows. Each row is the numbers-lead layout:
   - left: Bebas £ amount, fixed-width column
   - middle: customer name (bold) + job title (muted) + status chip top-right
   - right: lime circular chevron button (acts as row tap affordance / link to quote detail)
   Existing row data wiring stays; only the JSX layout changes.
6. Keep bottom nav untouched.

## Chaser (`chaser.tsx`)

1. **Header** — small ink uppercase `CHASER — REPLIES & PAYMENTS`, no big ink card.
2. **Focal "Next Chase" card** — white with `border-2 border-ink` and the brutalist offset shadow `shadow-[4px_4px_0_0_hsl(var(--ink))]`. Contains:
   - top row: `NEXT CHASE` eyebrow + status chip (`URGENT` red pill when >7 days overdue, `WAITING` neutral otherwise)
   - Bebas 80px £ amount
   - customer name • days-overdue line (red when overdue, ink/60 when waiting reply)
   - full-width lime `SEND REMINDER` button with matching offset shadow and active-press transform
3. **"Other outstanding" list** — section header + compact rows: white/50 bg, hairline ink/10 border, customer + invoice/age on the left, Bebas 24px £ + small status label on the right (`PENDING REPLY` blue / `UPCOMING` muted, using existing status palette).
4. **Empty state** — keep the existing "Nothing to chase" card but restyle to match (white, border, brutalist offset shadow) so empty and populated states feel of-a-piece.
5. Data: reuse whatever chaser query already returns; pick the first/most-overdue item for the focal card and render the rest in the list. No backend changes.

## Tokens / style notes

- Use `bg-ink text-paper` / `bg-paper text-ink` / `bg-lime text-ink` from `styles.css` — no hard-coded hexes in JSX.
- The brutalist offset shadow becomes a small utility class in `styles.css` (`.shadow-brutal` → `4px 4px 0 0 hsl(var(--ink))`) so both the focal card and the CTA share it.
- Bebas sizes used: 64px hero total, 80px chaser focal, 24px row totals, 20–24px stat tiles.
- Active state on the chaser CTA: `active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`.

## Out of scope

- Bottom nav, home screen, quote/invoice detail screens.
- Any data fetching, server functions, or DB changes.
- Notifications, real-time, animations beyond press-state and existing lime pulse.

## Verification

After edits: open `/quotes` and `/chaser` in Playwright at 390px, screenshot both, compare to the chosen prototypes, and confirm the existing seed quote ("John Smith — Boiler replacement — £2,185") still renders correctly and the chaser empty state still appears when there's nothing to chase.
