## Step 6 — Trade-specific AI prompt tuning

Make AI-generated quotes more accurate by appending per-trade guidance (typical line items, brand/regulatory hints, labour-rate range) to the system prompt based on `trade_type`. Today both `ai-quote.functions.ts` and `ai-capture-quote.functions.ts` use one generic `SYSTEM_PROMPT`; trade is passed in the user prompt but never used to steer the model.

### Changes

**1. New helper `src/lib/ai-trade-guidance.ts`** (client-safe, no server-only code — just a const map + lookup):
- Export `tradeGuidance(trade: string): string` that returns a block to append to the system prompt.
- Normalises the input (lowercases, matches by substring) so "Plumber / Heating Engineer", "Plumber", "plumber" all hit the same branch.
- Covers the 7 trades in `TRADE_TYPES`:
  - **Plumber / Heating Engineer** — Gas Safe registration line item when boiler/gas work; common brands (Worcester Bosch, Vaillant, Ideal, Baxi, Drayton, Honeywell, Geberit); typical labour £55–£75/hr; mention power flush / magnetic filter / TRVs where relevant; building control notify via Gas Safe.
  - **Electrician** — NICEIC/NAPIT notification; EICR/minor works certificate as separate line; 18th edition compliance; common brands (Hager, Wylex, MK, Crabtree, BG); labour £55–£75/hr; Part P building control notification.
  - **Builder / General Contractor** — strip-out, muck-away/skip hire, building control fees, structural calcs, plastering and making good; labour £45–£65/hr; sub-trades split (electrician, plumber) as own lines.
  - **Carpenter / Joiner** — first-fix vs second-fix split; materials (softwood/hardwood/MDF/ply); ironmongery; labour £40–£55/hr.
  - **Roofer** — scaffolding hire as own line; tile/slate/felt/lead flashing; waste removal; labour £45–£60/hr; mention insurance-backed guarantees where relevant.
  - **Decorator** — prep (filling, sanding, masking), undercoat + topcoats, materials by m²; brands (Dulux Trade, Crown Trade, Farrow & Ball); labour £30–£45/hr.
  - **Tiler** — m² pricing for tiling; adhesive + grout + spacers + trims; tanking for wet areas; labour £40–£55/hr or per m².
- Default branch (unknown trade) returns empty string so the generic prompt stands.

**2. Wire it into both AI handlers:**
- `src/lib/ai-quote.functions.ts` line 72: change `SYSTEM_PROMPT + patternsForPrompt(patterns)` → `SYSTEM_PROMPT + tradeGuidance(data.trade) + patternsForPrompt(patterns)`.
- `src/lib/ai-capture-quote.functions.ts` line 54: same change, using whichever variable holds the trade in that file (verify during implementation; if it doesn't currently receive `trade`, thread it through from the `InputSchema` — `ai-capture-quote.functions.ts` already takes the same shape, so a 1-line addition).

### What stays the same
- No DB migration. No new env vars. No API/payload changes for callers.
- Generic `SYSTEM_PROMPT` keeps the universal rules (pricing rules, source/category enums, JSON shape). Per-trade guidance is purely additive.
- Pricing patterns (Step 7's territory) untouched.

### Verification
- Generate a quote on the preview as a Plumber and as an Electrician with the same generic description ("install new light fitting in bathroom") — Electrician should add Part P/EICR mention; Plumber should add Gas Safe / IP-rated zone wording.
- Check the dev console / server-fn logs for any schema errors (the appended text doesn't change the JSON output shape so Zod should still pass).
