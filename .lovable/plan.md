## Brand tokens + unified StatusBadge

Tokens-and-one-component change. No layout, logic, or payment flows touched.

### Important framework note

This project is on **Tailwind v4** (CSS-first config in `src/styles.css` via `@theme inline`; there is no `tailwind.config.js` and creating one is a no-op). I'll honour the spirit of Step 1 by registering the new tokens in `@theme inline` so utilities like `bg-paid`, `text-due-text`, `bg-lime`, `border-lime`, `font-display`, `font-body` resolve exactly as you'd expect — same DX, correct stack.

Existing `:root` currently defines `--lime`, `--ink`, `--paper` in `oklch()`. I'll replace those three values with the hex you specified and add the new scales alongside, so any token already referenced by shadcn (`--primary: var(--ink)`, `--accent: var(--lime)`, etc.) keeps working with the new hex values.

---

### Step 1 — Tokens in `src/styles.css`

Under `:root`, add the full hex palette you listed:

- Brand: `--lime`, `--ink`, `--paper` (replace existing oklch values with your hex)
- Scales: `--lime-50…900`, `--ink-50…900`
- Surfaces: `--surface-canvas`, `--surface-card`, `--surface-sunken`
- Status pairs: `--paid` / `--paid-bg` / `--paid-text`, `--due` / `--due-bg` / `--due-text`, `--failed` / `--failed-bg` / `--failed-text`, `--sent` / `--sent-bg` / `--sent-text`
- Borders: `--border`, `--border-hover`, `--border-lime`
- Fonts: `--font-display: 'Bebas Neue'`, `--font-body: 'DM Sans'`
- Radii: `--r-md`, `--r-lg`, `--r-pill`

Existing shadcn tokens (`--background`, `--card`, `--primary`, `--accent`, etc.) keep their current mappings — they already reference `--paper`/`--ink`/`--lime`, so they pick up the new hex automatically. No component restyle.

In the existing `@theme inline` block, map the new tokens so Tailwind utilities resolve:

```css
--color-lime-50: var(--lime-50);  /* …through 900 */
--color-ink-50:  var(--ink-50);   /* …through 900 */
--color-surface-canvas: var(--surface-canvas);
--color-surface-card:   var(--surface-card);
--color-surface-sunken: var(--surface-sunken);
--color-paid: var(--paid);
--color-paid-bg: var(--paid-bg);
--color-paid-text: var(--paid-text);
/* same shape for due / failed / sent */
--color-border-lime: var(--border-lime);
--radius-pill: var(--r-pill);
```

`--font-display` and `--font-sans` are already declared in `@theme inline`; I'll keep `font-sans` pointing at DM Sans and add `--font-body: var(--font-body)` so `font-body` also resolves.

Bebas Neue + DM Sans need to be loaded via a `<link>` in `src/routes/__root.tsx` (Tailwind v4 / Lightning CSS will not resolve `@import` of a remote font URL from `styles.css`). I'll check whether they're already loaded and only add the `<link>` if missing.

### Step 2 — Apply the three rules

Restricted to brand surfaces; payment/business logic untouched.

1. **Money-confirmed = green, not lime.** Audit `src/components/StatusBadge.tsx`, `src/lib/status-styles.ts`, `src/routes/quotes.index.tsx`, `src/routes/quotes.$quoteId.tsx`, `src/routes/portal.$token.tsx`, `src/routes/invoices.$quoteId.tsx`, `src/components/CustomerPortalPanel.tsx` for any `bg-lime`/`text-lime`/lime dot used to signal "paid" / "deposit received" / success ticks, and swap those specific occurrences to the `--paid` token trio. Lime remains for primary CTA only (`.btn-lime`, single hero number — `.money-hero` keeps its lime accent as a hero figure, not a money-confirmed signal).
2. **Text on lime = `--ink`.** Sweep for `bg-lime` paired with `text-white`/`text-paper`/`text-background` and switch to `text-ink`. (Quick `rg "bg-lime[^\"]*text-(white|paper|background)"` across `src`.)
3. **Bebas Neue scope.** Bebas is already wired via `font-display` and the `h1–h4` base rule. Keep that. Audit `.num` (ledger £ amounts) — it currently inherits `var(--font-display)`, which violates rule 3 — switch `.num` to `var(--font-body)` with tabular-nums so amounts read as DM Sans. `.money-hero` (single hero figure on dashboard) stays display.

No other typography or colour changes.

### Step 3 — Unified `StatusBadge`

Rewrite `src/components/StatusBadge.tsx` as the single source of truth:

```ts
type Status =
  | "draft" | "sent" | "accepted"
  | "deposit-paid" | "balance-due"
  | "paid" | "failed" | "declined" | "overdue";

<StatusBadge status={status} amount={amount?} />
```

- Pill: `inline-flex items-center gap-1.5 rounded-[var(--r-md)] px-2.5 py-1 text-xs font-semibold`
- Dot (or `Check` for `paid`) in the status colour
- Label + optional formatted `amount` in the `*-text` token
- Token map:
  - `draft` → text `ink-400` on `ink-50`
  - `sent` → `--sent-text` on `--sent-bg`, dot `--sent`, label "Sent"
  - `accepted` → same palette as sent, label "Accepted"
  - `deposit-paid` → `--paid-text` on `--paid-bg`, dot `--paid`, label "Deposit paid"
  - `balance-due` → `--due-text` on `--due-bg`, dot `--due`, label "Balance due"
  - `overdue` → `--due` family, label "Overdue"
  - `paid` → `--paid-text` on `--paid-bg`, **tick** in `--paid`, label "Paid"
  - `failed` → `--failed-text` on `--failed-bg`, label "Payment failed"
  - `declined` → `--failed` family, label "Declined"

To keep call sites working without churn, add an internal mapper from the existing `QuoteStatus` (`pending|sent|accepted|declined|completed|paid|overdue` + `"invoiced"`) to the new prop set, so `<StatusBadge status="paid" />` etc. compile unchanged. The existing `StatusBadge` callers in `quotes.index.tsx`, `quotes.$quoteId.tsx`, `clients.$clientId.tsx` keep their current props.

Replace inline status pills in:

- `src/routes/portal.$token.tsx` — any ad-hoc green/amber/blue pills for sent/accepted/deposit-paid/paid → `<StatusBadge>`
- `src/components/CustomerPortalPanel.tsx` — same
- `src/routes/invoices.$quoteId.tsx` — paid/balance-due chips → `<StatusBadge>`

`src/lib/status-styles.ts` stays (still used by `StatusBadge`'s mapper for legacy `QuoteStatus`), but its colour classes get realigned to the new token names in the same pass so direct consumers stay consistent.

### Out of scope

Dark mode, payment logic, layout, copy outside the badge labels above.

### Files touched

- `src/styles.css` — tokens + `@theme inline` mapping + `.num` font swap
- `src/routes/__root.tsx` — add Bebas/DM Sans `<link>` only if not already present
- `src/components/StatusBadge.tsx` — rewritten with new prop set + legacy mapper
- `src/lib/status-styles.ts` — token class names realigned
- `src/routes/portal.$token.tsx`, `src/components/CustomerPortalPanel.tsx`, `src/routes/invoices.$quoteId.tsx`, `src/routes/quotes.index.tsx`, `src/routes/quotes.$quoteId.tsx` — swap ad-hoc status pills + any lime "paid" indicators / `text-white`-on-lime to the new tokens

### Test

- Quotes list, quote detail, portal, invoice page: every status pill renders via `<StatusBadge>` with the correct token pair.
- Any "deposit received" / "paid" tick is green (`--paid`), not lime.
- No `bg-lime` paired with white/paper text remains.
- £ amounts render in DM Sans; only the wordmark and `.money-hero` figure render in Bebas.

ADDITIONAL NOTES — confirm/handle these before building:

1. oklch → hex swap: After replacing --lime/--ink/--paper, confirm the app

   still renders and that no shadcn component relied on oklch-format math for

   those vars (some v4 shadcn setups compute hover/ring shades from oklch). If

   anything breaks, keep the var name but provide the hex in a format that

   component expects.

2. --accent = --lime is a contrast trap. The Step 2 sweep only catches literal

   bg-lime + text-white/paper. It will NOT catch shadcn components that put text

   on an --accent-derived fill (dropdown highlights, selected/hover states,

   command menu). Audit every consumer of --accent separately and apply

   text-on-lime = --ink there too. Flag any you find.

3. StatusBadge legacy mapper must cover the FULL QuoteStatus union:

   pending | sent | accepted | declined | completed | paid | overdue | invoiced.

   The plan lists the new prop set but doesn't map "completed" or "pending".

   Map: pending → draft, completed → paid (or its own "Completed" label if you

   prefer), invoiced → balance-due or paid per current behaviour. Don't let any

   legacy status fall through unmapped.

4. Add a DEFAULT fallback in StatusBadge for unknown/unmapped status → render

   the neutral "draft" style, never an unstyled or broken pill.

5. Don't let the .num font swap hit non-money numbers. If .num is used anywhere

   for non-currency values (counts, dates, refs), confirm switching it to

   --font-body is still correct there, or scope the swap to the ledger/amount

   context only.

6. After the pill replacements, verify the portal deposit-paid state still

   shows the deposit story ONCE — replacing ad-hoc pills with <StatusBadge>

   must not reintroduce a duplicate "paid"/"deposit" indicator alongside the

   existing card/strip/bar logic.

7. tabular-nums: when switching .num to DM Sans, confirm DM Sans tabular figures

   are actually loaded/available; if the weight loaded doesn't include tabular

   variants, amounts may shift width. Acceptable, but verify alignment in the

   ledger doesn't jump.

&nbsp;