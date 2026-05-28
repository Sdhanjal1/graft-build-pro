## Plan: Accurate social glyphs in Quottr lime

Replace the four placeholder line-style SVGs in `src/components/MarketingShell.tsx` with solid, brand-accurate glyph SVGs, all rendered in `text-lime` (`fill="currentColor"`).

### Icons (24×24, in order)

1. **TikTok** — the official musical-note "d" glyph (single-path filled shape).
2. **Instagram** — rounded square camera body with inner circle lens and small top-right dot, drawn as filled shapes via `fill-rule="evenodd"` so the lime reads as the logo silhouette on the dark footer.
3. **Facebook** — the solid "f" mark in a filled rounded square.
4. **YouTube** — rounded-rectangle play badge with the triangle knocked out via `fill-rule="evenodd"`.

All four:

- `width="24" height="24"`, `viewBox="0 0 24 24"`, `fill="currentColor"`, no stroke.
- Wrapped in the existing `<a href="#" target="_blank" rel="noopener noreferrer" aria-label="Quottr on X">` anchors.
- Anchor classes change from `text-lime hover:scale-110` to `text-lime hover:text-lime/80 transition-colors` for the "subtle brighten" hover (lime-on-dark reads brighter when lightened slightly; scale removed per the "subtle" ask — happy to keep scale if you prefer).
- Order preserved: TikTok → Instagram → Facebook → YouTube.
- Placeholder `href="#"` kept, with the existing "update hrefs once accounts are live" comment.

### Files

- `src/components/MarketingShell.tsx` — swap the four `<svg>` blocks inside the "Follow Quottr" column; no other changes.

No new assets, no new dependencies — inline SVGs only so they inherit `currentColor` from Tailwind's `text-lime`.

keep a *very* subtle scale (like `hover:scale-105`) AND the brighten together. A tiny scale plus a brighten gives the icons a satisfying "alive" feel on hover without being over the top.