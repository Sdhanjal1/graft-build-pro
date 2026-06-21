# Typography & Readability Audit

Goal: every piece of text — labels, captions, secondary metadata, amounts, status text — meets WCAG AA contrast and feels confident, never faint. No `text-foo/40`, no washed `text-muted-foreground` for important data, no thin weights on key numbers.

## Approach

Two-pass sweep:

1. **Token pass (global, one-shot)** — raise the baseline so every component benefits without touching each file.
2. **Component pass (targeted)** — fix specific high-traffic screens where opacity utilities or muted classes hide meaningful content (amounts, dates, names, statuses).

## 1. Token pass (src/styles.css)

Tighten the muted/border tokens so the default "secondary text" tier is already readable.

- `--muted-foreground`: bump from `oklch(0.42 0.008 80)` → `oklch(0.32 0.008 80)` so default `text-muted-foreground` on cream/white passes AA at small sizes.
- `--mute` (on dark surfaces in MarketingShell footer, BottomNav, banners): introduce a `--paper-muted` token at `oklch(0.945 0.014 85 / 0.78)` and replace ad-hoc `text-paper/50`/`/55`/`/60` usages.
- Add a `.text-meta` utility (weight 500, color `--muted-foreground`, tracking +0.01em) for captions/labels so we stop reaching for opacity.
- Add a `.num-strong` utility for monetary amounts: display font, `color: var(--ink)`, never opacity-dimmed.

## 2. Component pass

Files with the heaviest faint-text load (from grep): `quotes.$quoteId.tsx`, `quotes.new.tsx`, `settings.tsx`, `portal.$token.tsx`, `invoices.$quoteId.tsx`, `portal.c.$code.tsx`, `messages.tsx`, `app.tsx`, `clients.$clientId.tsx`, `chaser.tsx`, `MarketingShell.tsx`, `CookieBanner.tsx`, `BillingSection.tsx`, `SendQuoteDialog.tsx`, `MaterialListSheet.tsx`.

For each, apply the rules below. No layout or behavioural changes.

### Rules

- **Amounts / totals / line-item prices**: always full-ink, weight 600+ (or display font). Strip any `/70`, `/80`, `opacity-*` wrappers around money.
- **Dates, refs, "sent X ago"**: use `text-muted-foreground` (now darker) instead of `text-ink/60` or `/70`.
- **Captions on dark surfaces** (footer, BottomNav, banners, MarketingShell): replace `text-paper/40`–`/60` with `text-paper/80` minimum; uppercase eyebrows go to `/85`.
- **Inactive tabs / nav** (`messages.tsx` tab row, BottomNav): inactive label at `text-ink/75` (or `text-paper/75` on dark), not `/55`–`/60`.
- **Disabled buttons**: keep `disabled:opacity-50` (intentional affordance) — not in scope.
- **Status pills**: verify each pill's text token has AA contrast on its background; darken `--status-pending` if needed.
- **Read messages** (`messages.tsx` line 252, 260, 246): bump secondary preview text from `text-ink/75` + `text-muted-foreground` to a single readable tier; unread emphasis stays via weight, not by making read items faint.

### Out of scope

- Layout, spacing, animation.
- Renaming/refactoring components.
- Marketing copy.
- Dialog/Toggle shadcn `opacity-70` interaction affordances (those are hover states, not text legibility).

## Verification

After changes:
1. Playwright screenshot key screens at mobile width (375): `/`, `/messages`, `/quotes`, a quote detail, `/settings`, `/portal/<token>` (public preview), and the dark footer.
2. Visually confirm: amounts pop, dates/labels are legible without squinting, no element reads as "faded".
3. Spot-check contrast with a quick OKLCH-to-relative-luminance check on the new muted token vs `--paper` and `--card`.

## Technical notes

- `text-muted-foreground` is the shadcn-wired token; bumping `--muted-foreground` cascades to inputs, labels, captions across all shadcn components automatically.
- The grain overlay (`body::before`, opacity 0.03) slightly reduces effective contrast — accounted for by targeting AA with headroom (contrast ≥ 4.8 rather than 4.5).
- No new dependencies; pure CSS + className edits.
