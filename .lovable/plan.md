# Audit result — inline status pills still in app

I grepped for inline status colouring (`STATUS_CHIP/DOT/LABEL`, `bg-status-*`, local `STATUS_STYLE` maps) across `src/`. Most hits are **not** status pills — they're destructive buttons, error text, focus rings, success confirmation banners, and line-item source badges. Those stay.

The hits that **are** quote/payment status pills (small uppercase label describing where a quote or invoice sits) and should route through `StatusBadge`:

## Pills to replace


| #   | File                               | Line            | What it is today                                                                                                |
| --- | ---------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | `src/routes/quotes.index.tsx`      | 488–490         | Quote row chip built from `STATUS_CHIP` + `STATUS_DOT` + `STATUS_LABEL`                                         |
| 2   | `src/routes/portal.c.$code.tsx`    | 94–110, 406–412 | Local `STATUS_LABEL` + `STATUS_STYLE` map, rendered per quote in the customer portal list                       |
| 3   | `src/routes/chaser.tsx`            | 116–118         | `bg-status-sent/15 text-status-sent` "Sent N days ago" chip (acts as the sent-status label on each chaser card) |
| 4   | `src/routes/invoices.$quoteId.tsx` | 297–299         | Full-width "Paid" confirmation pill (`bg-status-paid/15 text-status-paid`)                                      |


## Plan

1. `**quotes.index.tsx**` — swap the inline `<span>` (lines 488–490) for `<StatusBadge status={quote.status} />`. Remove the `STATUS_CHIP`, `STATUS_DOT`, `STATUS_LABEL` imports if no other call site uses them in this file (the secondary tiles still use `TILE_DOT` / `GROUP_LABEL`, which are local — unaffected).
2. `**portal.c.$code.tsx**` — delete the local `STATUS_LABEL` and `STATUS_STYLE` maps. Replace the rendered chip (lines 406–412) with `<StatusBadge status={q.status} />`. Date chip next to it stays as-is (it's a date, not a status).
3. `**chaser.tsx**` — the "Sent N days ago" chip is hybrid (status + freshness). Keep the relative-time wording but render it through `StatusBadge` by passing `status="sent"` with a custom `label` prop. → requires a small `StatusBadge` extension: optional `label?: string` to override the default label while keeping palette/dot. If you'd rather not extend the component, alternative is to leave this one as a freshness chip (it's arguably a "time since" badge, not a status pill).
4. `**invoices.$quoteId.tsx**` — this is a full-width banner, not a chip. Two options:
  - **a)** Replace inline classes with `<StatusBadge status="paid" />` centered in its own row (loses the full-width banner look).
  - **b)** Leave as a banner since `StatusBadge` is for inline pills. My recommendation: **leave (b)** and only retoken the colours so it reads from the same source. Confirm which you prefer.

## Untouched (intentional)

- `src/lib/status-styles.ts` — kept as a token source for the secondary tile dots (`TILE_DOT` in `quotes.index.tsx`) and any future consumers. Can be deleted later if all usages migrate.
- All `text-status-overdue` / `bg-status-overdue` usage in error messages, destructive buttons, focus rings, "delete account" UI (`settings.tsx`, `auth.tsx`, `reset-password.tsx`, `request.$proId.tsx`, `quotes.new.tsx`) — these are semantic destructive/error colours, **not** status pills.
- `portal.$token.tsx` accepted/deposit-paid confirmation banners (lines 355, 479, 599, 619, 670, 689) — these are large state cards, not chips. Out of scope unless you want them retokened.
- `clients.$clientId.tsx` already uses `<StatusBadge />` (line 234). `quotes.$quoteId.tsx` already uses it for the deposit header (line 824).
- `quotes.$quoteId.tsx` line 2048 "Estimate" pill — labels a line-item type, not a quote status.

## Questions before I build

1. **Chaser chip (#3)** — extend `StatusBadge` with an optional `label` prop, or leave that chip as-is?
2. **Invoice "Paid" banner (#4)** — replace with chip, or leave as banner?

1. StatusBadge label extension: add label?: string that overrides the default

   text while keeping the status's palette + dot. Confirm the chaser's

   "Sent N days ago" label fits the pill at mobile width (truncate or cap if not).

2. Invoice banner (#4): go with option (b) — keep the banner, retoken to the

   --paid trio only. Don't force a block variant into StatusBadge.

3. portal.$token.tsx state cards (lines 355, 479, 599, 619, 670, 689) — you've

   scoped these out as "large state cards, not chips." Agreed they're not pills,

   BUT they must still obey the money-confirmed=green rule. Confirm none of these

   cards use lime to signal paid/deposit-received. Retoken any that do to --paid.

   This is the one out-of-scope item I don't want skipped — it's the exact rule

   the whole change exists to enforce, and it lives in these cards.

4. status-styles.ts retoken: when realigning its colour classes to the new token

   names, confirm the secondary TILE_DOT consumers in quotes.index.tsx still

   render correctly — don't let the tile dots break while migrating the pills.

5. After migration, grep once more for bg-status-* / text-status-* to confirm

   no quote/payment STATUS pill was missed — separate from the destructive/error

   usages you've correctly excluded.

&nbsp;