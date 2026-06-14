## Goal

Lift every inner-page header above the bar set by Home, without breaking layout on `/app`. One refactor in `AppShell.tsx`, one new sticky behaviour, and a sweep of the six route call-sites.

## 1. `src/components/AppShell.tsx` — rebuild `PageHeader`

Collapse the two variants into one and drive behaviour through props:

```tsx
<PageHeader
  title="Quotes"
  subtitle="3 pending · 2 overdue"
  back="/quotes"            // string | true | false
  crumbs={["Quotes"]}        // optional breadcrumb trail
  action={{ to:"/quotes/new", label:"+ New quote" }}  // optional primary chip
  urgent                     // optional — turns subtitle dot red
/>
```

Key changes:
- **Drop the `Quottr.` wordmark from this component entirely.** The Home screen already paints its own brand bar inside `/app`; no other route needs it.
- Default size = current `compact` (Bebas 1.9rem, 1-line subtitle).
- Back chip stays a `ChevronLeft` for top-level routes, becomes a `crumbs.join(" / ")` text link for detail pages.
- Subtitle gains a leading `<span>` dot — neutral `bg-paper/30` by default, `bg-status-overdue` when `urgent`.
- Right-slot is now an explicit `action` prop that renders a standard pill (`bg-lime text-ink rounded-full px-3 py-1.5 text-[11px] uppercase tracking-wide font-bold active:scale-95`) — components can still pass `right` for custom nodes (Clients already does).

## 2. Sticky condensed bar on scroll

Inside `PageHeader`:
- Wrap the existing header in a `position: sticky; top: 0; z-10` container.
- Use an `IntersectionObserver` on a 1px sentinel placed just below the hero. When the sentinel leaves the viewport, swap to a 44px condensed strip (`back + title` only, `backdrop-blur-md bg-surface/85 supports-[backdrop-filter]:bg-surface/70`).
- Transition `height`, `font-size`, `padding` over 180ms.
- Reduce-motion: skip the height tween, just swap classes.

## 3. Route call-site sweep

| Route | Header call after refactor |
|---|---|
| `/app` (Home) | unchanged — uses its own custom header, no `PageHeader` |
| `/quotes` | `title="Quotes" subtitle={subtitle} urgent={overdueTile.count>0} action={{to:"/quotes/new", label:"+ New"}}` |
| `/clients` | keep current `right={newCustomerPill}` (custom node) |
| `/messages` | add `action={{ label:"Filter", onClick: openFilter }}` (stub handler if no existing filter — opens a no-op dialog placeholder is out of scope; ship the chip without the dialog) |
| `/chaser` | `urgent={hasOverdue}` |
| `/settings` | unchanged props (no action chip) |
| `/quotes/$id` | `crumbs={["Quotes", quote.ref]} back="/quotes"` |
| `/invoices/$id` | `crumbs={["Quotes", quote.ref, "Invoice"]} back={\`/quotes/${quote.id}\`}` |
| `/clients/$id` | `crumbs={["Customers", client.name]} back="/clients"` |
| `/clients/new`, `/quotes/new` | keep as-is (back chip + plain title) |

For `/messages` I'll leave the Filter chip's `onClick` as a `toast.info("Filters coming soon")` stub — adding the actual filter UI is a separate request.

## 4. Lime audit on inner headers

Search the codebase for stray `text-lime` / `bg-lime` inside any `PageHeader` consumer and remove. Brand-lime stays Home-only; inner pages re-introduce lime through their *own* hero strip (e.g. Quotes pipeline card), which keeps the accent meaningful.

## 5. Verify

- `bunx tsc --noEmit`
- Mobile preview at 390×844: confirm each route's first paint shows the screen title (not the wordmark), the back chip lands where expected, and the sticky bar engages once the hero scrolls out.
- Spot-check `/quotes/$id` and `/invoices/$id` breadcrumb wraps cleanly when `quote.ref` is long (truncate after 18 chars).

## Out of scope

- Building a real filter dialog for Inbox.
- Restyling Home's bespoke header.
- Changing the bottom-nav, sheets, or any non-header surface.
