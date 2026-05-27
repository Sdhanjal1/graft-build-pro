# Tailor the app to trade type

Right now "trade type" is set on onboarding but used inconsistently. Three separate trade lists exist (`onboarding.tsx` `TRADES`, `user-data.ts` `TRADE_TYPES`, marketing `trades-data.ts`), the labels don't match, so for example the QUOTE_TEMPLATES keyed on `"Plumber / Heating Engineer"` never fire for an onboarding user saved as `"Plumber"`. This plan fixes that and turns trade into a real first-class personalisation key.

## 1. One canonical trade registry

Create `src/lib/trades.ts` as the single source of truth. One row per trade with everything the UI needs:

```ts
type TradeId = "plumber" | "gas" | "electrician" | "builder"
             | "carpenter" | "roofer" | "decorator" | "tiler"
             | "bathroom_kitchen" | "landscaper" | "hvac" | "other";

type TradeConfig = {
  id: TradeId;
  label: string;              // "Gas Engineer"
  icon: LucideIcon;
  noun: { job: string; customer: string }; // "service" vs "job", "client" vs "customer"
  defaultServiceType: string | null;        // "Annual gas safety + boiler service"
  defaultServiceIntervalMonths: number | null; // 12, 60, etc.
  certifications: { key: string; label: string; validityMonths: number }[];
  // e.g. gas → CP12 (12mo); electrician → EICR (60mo); PAT (12mo)
  quoteTemplates: { label: string; prompt: string }[];
  homeMicExample: string;     // for app.tsx mic placeholder
  emptyStateCopy: { quotes: string; clients: string; jobs: string };
  callToActions: { newQuote: string; newJob: string };
};
```

Migrate existing content into it: onboarding TRADES, settings TRADE_TYPES, QUOTE_TEMPLATES, `exampleForTrade`, marketing trades-data prompts. Persisted value on `profiles.trade_type` becomes the `TradeId` slug (not the label) — write a tiny migration helper that maps any legacy label to a slug on next profile read.

Expose a `useTrade()` hook that returns the resolved `TradeConfig` for the current user (falling back to `"other"` with generic copy). All trade-aware UI calls this hook.

## 2. Trade-aware UI surfaces

Wire `useTrade()` (or its config) into every screen that should feel native:

- **Onboarding step 2** — render from the registry, save the slug.
- **Settings → Trade type** — same registry, same slug.
- **Home (`/app`)** — mic placeholder, "Try: …" example, empty-state body, queue-card icon all come from the config.
- **New quote (`/quotes/new`)** — quick-fill templates from `quoteTemplates`; job-title placeholder uses trade noun.
- **Site capture** — example prompts and "Add item" placeholder per trade.
- **Customer detail (the screen we just built)** —
  - Summary card: "{n} {trade.noun.job}s completed · Last {trade.noun.job} …".
  - New "Service plan" card: if `defaultServiceType` exists and `client.service_due_date` is set, show next-due countdown with trade-specific label ("Next CP12 due in 3 weeks"). If unset, show a one-tap "Set up reminder" that pre-fills with `defaultServiceType` + `today + defaultServiceIntervalMonths`.
  - Job history rows: badge any line items that match a `certifications[].key` with a coloured chip ("CP12 · valid until 14 Mar 2027").
- **Chaser / overdue copy** — keep generic.
- **Customer portal (`/portal.c.$code`)** — service-due banner uses trade-specific noun ("Your annual gas safety is due in 14 days") instead of the current generic "annual service".

## 3. Service reminders driven by config

- When a job is marked completed, if its line items contain a cert that's in `trade.certifications`, auto-suggest writing `service_due_date = completed_at + cert.validityMonths` for that client. Trader confirms in a one-tap toast — no silent writes.
- `service-reminders.ts` cron already drives the notification; it just gets better defaults via this flow.

## 4. Migration & backward compatibility

- One-time client mapping in `hydrateUserData`: if `profile.trade_type` is a legacy label ("Plumber / Heating Engineer", "Plumber"), map to slug ("plumber") and persist back to the row.
- Keep `TRADE_TYPES` export as a thin wrapper over the registry so any external callers don't break during refactor, then remove in a follow-up.

## 5. Out of scope

- New trades beyond the 12 listed above (easy to add later by extending the registry).
- Pricing intelligence per trade (separate workstream — `user_pricing_patterns` already exists).
- Marketing site `trades-data.ts` rewrite — leave as-is for SEO; only de-duplicate the in-app catalogue.

## 6. Verification

- Onboarding as a Gas Engineer → home mic shows boiler example → new quote shows gas templates → completing a "CP12" line item suggests a 12-month reminder → customer detail surfaces "Next CP12 due …" with a chip on the past job.
- Existing accounts on legacy labels still see correct templates after the auto-migration on next load.

## Technical notes

- Files touched: `src/lib/trades.ts` (new), `src/lib/user-data.ts` (slug + migration + remove duplicate lists), `src/routes/onboarding.tsx`, `src/routes/settings.tsx`, `src/routes/app.tsx`, `src/routes/quotes.new.tsx`, `src/routes/clients.$clientId.tsx`, `src/components/CustomerPortalPanel.tsx`, `src/routes/portal.c.$code.tsx`, `src/routes/site-capture.*`.
- No DB schema changes — `profiles.trade_type` already a `text` column; we just standardise the values written into it.
- No new server functions; everything is presentation + a one-shot client-side migration on load.
