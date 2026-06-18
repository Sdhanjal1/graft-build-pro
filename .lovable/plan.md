# Redesign the Quotes Pipeline tile

The current tile is a dark ink slab with a lime number that overlaps the header. Since we just moved every page header to a calm paper-on-paper treatment, the ink slab now feels like a leftover — heavy, glossy, and visually disconnected from the rest of the screen.

## New direction: editorial paper card

Replace the ink slab with a flat paper card that reads as part of the same surface as the header — numbers lead, ink type, lime used only as a small accent.

**Composition**
- Container: `bg-paper` with `border border-ink/10`, `rounded-2xl`, no shadow (or a single hairline `border-b-2 border-ink` for weight). No more `-mt-6` overlap; sits naturally below the header with normal `mt-2` spacing.
- Top row: small uppercase eyebrow `PIPELINE` on the left (ink/55), `{n} quotes` on the right (ink/55, tabular). Same `text-[10px] tracking-[0.22em]` rhythm we already use.
- Hero number: Bebas, `text-ink` (not lime), `clamp(3.25rem, 13vw, 4.75rem)`, tight leading, tabular. The number is the focal point; color isn't doing the work.
- A thin lime underline accent (`h-1 w-12 bg-lime rounded-full`) sits under the number as the only chromatic moment.

**Awaiting / Overdue split (when present)**
- Divider becomes `border-t border-ink/10` instead of `border-paper/10`.
- Labels: ink/55 uppercase eyebrows.
- Values: Bebas `text-ink` at `1.75rem`. Overdue value stays `text-status-overdue` so the warning still pops against the calmer card.

**"to collect" link**
- Flat pill: `inline-flex h-8 px-3 rounded-full bg-ink text-paper text-[11px] font-bold uppercase tracking-[0.15em]`, chevron after. Sits flush-left under the split. No lime text-link.

## Files

- `src/routes/quotes.index.tsx` — replace the `rounded-[1.75rem] bg-ink text-paper …` block (lines ~120–167) with the paper version above. Remove the `-mt-6 relative z-20` overlap wrapper; use `px-4 mt-3`.

## Out of scope

- Header, bottom nav, secondary tile grid, quote row cards, Chaser brutalist card — all untouched.
- No changes to data, filters, or routing.

## Verification

Open `/quotes` at mobile width: the card reads as paper, the £ number is ink with a small lime underline, Awaiting/Overdue split is legible, and the "to collect" pill leads to `/chaser`.
