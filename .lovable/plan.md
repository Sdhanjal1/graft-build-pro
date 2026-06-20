## Goal

Make each `/trades/$tradeSlug` page genuinely distinct (content + SEO) without splitting into 8 separate route files, and fix the stale-chunk service-worker issue that makes trade-card clicks silently fail.

## 1. Fix stale-chunk navigation bug

The current `public/sw.js` does network-first navigation caching that holds onto stale HTML referencing dead JS chunk hashes after a deploy. When a user clicks a trade card, TanStack tries to lazy-load a chunk that no longer exists → `Failed to fetch dynamically imported module` → navigation aborts → page appears to "revert."

Two changes:

- `**public/sw.js**`: Stop caching navigations. Keep the push/notification logic, drop the `fetch` handler entirely (or restrict it to same-origin static assets only). Bump the cache prefix so existing clients evict on next activate. Simple and safe — the app doesn't need offline navigation; it needs reliable fresh HTML.
- `**src/router.tsx**`: Add a global error handler for dynamic-import failures that triggers `window.location.reload()` once (with a sessionStorage guard to avoid loops). Belt-and-braces for users whose SW hasn't updated yet.

## 2. Expand `src/lib/trades-data.ts` with per-trade distinct content

Extend the `Trade` type and add real, hand-written content per trade:

```ts
type Trade = {
  slug: string;
  name: string;
  shortBody: string;     // existing — for /trades grid
  headline: string;      // existing
  intro: string;         // existing
  bullets: {...}[];      // existing
  prompts: string[];     // existing

  // NEW
  seoTitle: string;           // distinct, keyword-rich
  seoDescription: string;     // distinct, ~150 chars
  jobTypes: string[];         // 5-8 real job types this trade Googles
  exampleQuote: {             // realistic itemised quote for THIS trade
    customer: string;
    jobSummary: string;
    lines: { description: string; qty: number; unitPrice: number }[];
    deposit: number;
    total: number;
  };
  faqs: { q: string; a: string }[];  // 3-4 trade-specific
  testimonial: {              // per-trade slot; use placeholder attribution
    quote: string;
    name: string;
    business: string;
    location: string;
  };
};
```

Per-trade specifics (hand-written, not templated):

- **Plumbers** — boiler swaps, bathroom refits, leak repairs, unvented cylinders, power flushes. FAQs: "Does Quottr know plumbing prices?", "Can I add my Gas Safe number?" (cross-link), "Does it handle deposits before I order parts?", "What about WaterSafe / WRAS jobs?". Example quote: combi swap with flush + filter.
- **Gas engineers** — boiler installs, annual services, CP12s, commercial cookers, warranty registrations. FAQs: "Does Quottr include Gas Safe details on quotes?", "Can it produce CP12s?" (honest answer — no, but pairs with), "Does it handle warranty-required install bundles?". Example: Vaillant install with 10yr warranty bundle.
- **Electricians** — consumer unit upgrades, EICRs, full/partial rewires, EV charger installs, LED retrofits. FAQs: "Does Quottr know electrical pricing?", "Can it handle EICR remedials?", "Does it carry my NICEIC/NAPIT cert details?", "EV charger grant paperwork?". Example: 18th edition CU upgrade with surge.
- **Joiners & carpenters** — kitchen installs, second fix, bespoke joinery, doors/architrave, fitted wardrobes. FAQs: "Materials vs labour split?", "Can I quote bespoke without itemising every screw?", "Deposit before I cut timber?". Example: Howdens kitchen fit.
- **Builders** — extensions, loft conversions, knock-throughs, garage conversions, groundworks. FAQs: "Stage payments?", "Big quotes feel scary — can I break it down?", "Variations mid-build?". Example: single-storey rear extension stages.
- **Roofers** — tile repairs, full re-roofs, fascias/soffits/gutters, lead flashings, chimney repairs. FAQs: "Scaffold included?", "Insurance work?", "Deposit before tile order?". Example: full re-roof itemised.
- **Tilers** — bathroom tiling, kitchen splashbacks, wet rooms, patios, underfloor heating overlays. FAQs: "Priced per m²?", "Adhesive/grout/trims itemised?", "Awkward cuts?". Example: full bathroom tiling.
- **Decorators** — interior rooms, exterior masonry, commercial repaints, wallpapering, woodwork. FAQs: "Prep priced separately?", "Trade paint vs retail?", "Day rate vs fixed?". Example: full house repaint room-by-room.

SEO titles follow the pattern but each one is hand-written:

- `Quoting App for Plumbers | Speak It, Send It, Get Paid — Quottr`
- `Quoting App for Gas Engineers | Boiler Quotes in Minutes — Quottr`
- `Quoting App for Electricians | EICR, CU & Rewire Quotes — Quottr`
- etc. — each surfaces the trade's top keywords, not just `${name}`.

## 3. Update `src/routes/trades.$tradeSlug.tsx` template

Same single file (no route split), but render the new sections so each page is structurally richer and genuinely different in content:

1. Hero (existing) — unchanged structure
2. **"What we quote for" chips** (NEW) — renders `jobTypes` as keyword-rich pills. Real Google vocabulary; biggest SEO win per byte.
3. How Quottr helps (existing 3-bullet grid)
4. **Example quote card** (NEW) — renders `exampleQuote` as a styled mock quote (header, line items, deposit, total). Visually distinct per trade because the line items are completely different.
5. Voice prompts (existing)
6. **Testimonial** (NEW) — per-trade quote card. If we don't have real testimonials yet, use clearly-labelled placeholder names ("Dave M., Plumber, Leeds") or leave the slot empty for trades without one — flag this for the user.
7. **FAQ** (NEW) — semantic `<details>`/`<summary>` accordion, 3-4 Q&As. Also emits **FAQPage JSON-LD** in `head().scripts` so Google can show rich FAQ results — biggest SERP win.
8. Final CTA — fix the tired "Stop quoting in the evenings" line to brand-aligned **"Speak it. Send it. Get paid."**
9. Other trades (existing)

Update `head()` to use `seoTitle` / `seoDescription` instead of templated `${headline}, Quottr` / `intro`. Add FAQPage JSON-LD built from `trade.faqs`.

## 4. Out of scope

- Splitting into 8 hand-written route files (deferred until we see traffic data).
- Real testimonials — placeholder attributions until the user supplies real ones.
- Per-trade hero images (would need 8 generated images; flag as a follow-up if wanted).

## Technical notes

- All new fields go in `src/lib/trades-data.ts` — one file, all 8 trades, easy to maintain.
- FAQ accordion uses native `<details>`/`<summary>` to keep it crawlable without JS.
- FAQPage JSON-LD injected via `head().scripts` per TanStack head pattern.
- Service-worker change requires the browser to activate the new SW once before stale clients are healed; the `window.location.reload()` fallback in the router covers the first load.
- No changes to routing, auth, or the `/trades` listing page (it already reads `shortBody` which we're keeping).

## Files touched

- `public/sw.js` — remove navigation caching, bump cache prefix
- `src/router.tsx` — dynamic-import error reload fallback
- `src/lib/trades-data.ts` — extend `Trade` type, hand-write per-trade content for all 8
- `src/routes/trades.$tradeSlug.tsx` — new sections (job types, example quote, testimonial, FAQ), distinct SEO meta, FAQPage JSON-LD, fix CTA copy

**The note back:**

> Approved — strong plan. Three things:
>
> 1. Keep all FAQ answers truthful about what the app actually does — honest "no" where it can't do something (e.g. CP12s). Never overclaim.
> 2. Use realistic 2026 UK trade pricing in the example quotes — they'll be seen by tradespeople who know the real costs. I'll get the plumbing/gas ones sanity-checked.
> 3. Don't use placeholder/fake testimonials — fabricated testimonials are an ASA/consumer-law risk. Build the testimonial slot but leave it empty or hidden until I supply real ones. Don't ship invented names.  
> Everything else: apply as planned, including the JSON-LD FAQ schema and the service-worker fix.