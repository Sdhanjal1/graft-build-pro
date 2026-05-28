/**
 * Trade-specific guidance appended to the AI system prompt so generated
 * quotes reflect typical line items, regulatory hints, common brands and
 * labour-rate ranges for the tradesperson's actual trade.
 *
 * Returns "" when the trade is unknown so the generic prompt still stands.
 *
 * IMPORTANT: When a new trade is added to the dropdown in `src/lib/trades.ts`,
 * add a matching guidance block below. The match is done with `t.includes(...)`
 * against the lower-cased trade label — pick a substring that's unique to that
 * trade (e.g. "plaster" for Plasterer, "land" for Landscaper). The "Other"
 * option intentionally falls through to the empty fallback since we can't
 * predict what the trader does.
 */
export function tradeGuidance(trade: string | null | undefined): string {
  if (!trade) return "";
  const t = trade.toLowerCase();

  // Matches: Plumber, Gas Engineer, Heating Engineer
  if (t.includes("plumb") || t.includes("heating") || t.includes("gas")) {
    return `

TRADE-SPECIFIC GUIDANCE — PLUMBER / GAS / HEATING ENGINEER:
- For any boiler, gas appliance or gas pipework job, include a separate line for Gas Safe registration / building control notification (typically £25-£50).
- For landlord work, include CP12 Gas Safety Record as its own line (£60-£120 depending on appliance count).
- Unvented cylinder work requires G3 commissioning — list separately.
- Common brands to reference where appropriate: Worcester Bosch, Vaillant, Ideal, Baxi, Glow-worm, Drayton, Honeywell, Hive, Nest, Geberit, Grohe, Mira, Triton, Megaflo.
- Labour rate: £55-£75/hr; day rate £350-£500.
- Boiler installs: consider adding magnetic system filter (Adey MagnaClean / Fernox TF1), power flush, new programmer/thermostat, condensate pipework, flue extensions and warranty registration as their own line items.
- Bathrooms: split out supply vs fit, silicone/sealant, waste pipework, isolation valves and removal/disposal of old suite.
- Radiator work: TRVs, lockshield valves, balancing and bleeding usually warrant their own line.`;
  }

  // Matches: Electrician
  if (t.includes("electric")) {
    return `

TRADE-SPECIFIC GUIDANCE — ELECTRICIAN:
- All notifiable work (consumer units, new circuits, bathroom/kitchen rewiring) must include a separate line for Part P building control notification via NICEIC / NAPIT / ELECSA (typically £30-£60).
- Issue a Minor Works Certificate, Electrical Installation Certificate (EIC) or EICR as its own line item where required.
- Reference 18th Edition compliance and RCBO / dual-RCD where relevant; mention SPD (surge protection) on new consumer units.
- Common brands: Hager, Wylex, MK, Crabtree, BG, Click Scolmore, Schneider, Aico (smoke alarms), Collingwood / Aurora (downlights).
- Labour rate: £55-£75/hr; day rate £300-£450.
- Bathroom electrical work: mention IP-rated fittings and zone 1/2 compliance.
- EV chargers: include DNO notification and OZEV-approved unit where the customer wants the grant.`;
  }

  // Matches: Builder, General Contractor
  if (t.includes("build") || t.includes("contractor")) {
    return `

TRADE-SPECIFIC GUIDANCE — BUILDER / GENERAL CONTRACTOR:
- Include separate lines for strip-out / muck-away / skip hire where the job involves demolition or large material movement.
- For extensions and structural work, add lines for building control fees, structural engineer's calculations and party wall agreements where applicable.
- Sub-trades (electrician, plumber, plasterer, roofer) should usually be split into their own line items, not bundled into labour.
- Always include a "making good and decorating" line where walls/floors are disturbed.
- Foundations, blockwork, lintels, DPC, insulation (PIR/Kingspan/Celotex) and steels are normally separate material lines.
- Labour rate: £45-£65/hr for own labour; day rate £250-£400.`;
  }

  // Matches: Carpenter, Joiner
  if (t.includes("carpenter") || t.includes("joiner")) {
    return `

TRADE-SPECIFIC GUIDANCE — CARPENTER / JOINER:
- Split first-fix (studwork, joists, noggins, door linings, floor decking) from second-fix (architrave, skirting, doors, ironmongery) into separate line items where both apply.
- Specify timber type where relevant: softwood (CLS, C16/C24), hardwood, MDF, plywood (WBP/marine), oak.
- Ironmongery (hinges, handles, latches, door closers) often warrants its own line; reference brands like Carlisle Brass, Frelan, Eurospec.
- Fitted furniture / kitchens: split carcasses, worktops (laminate / solid wood / quartz), handles and appliance install.
- Labour rate: £40-£55/hr; day rate £220-£320.`;
  }

  // Matches: Roofer
  if (t.includes("roof")) {
    return `

TRADE-SPECIFIC GUIDANCE — ROOFER:
- Scaffolding or tower hire should almost always be a separate line item — never bundle into labour. Typical scaffold hire £600-£1,200 for a semi.
- Specify covering type: concrete tile (Marley, Redland), clay tile (Sandtoft, Dreadnought), natural slate (Welsh, Spanish), felt, GRP, EPDM (Firestone), lead flashing (Code 4/5).
- Include underfelt/membrane, battens, ridge tiles (dry-fix vs mortar) and breathable membrane as separate lines on re-roofs.
- Include waste removal / skip hire as its own line where stripping is involved.
- Mention insurance-backed guarantee (IBG) where the job is large enough to warrant it.
- Labour rate: £45-£60/hr; day rate £250-£350 per roofer.`;
  }

  // Matches: Decorator, Painter
  if (t.includes("decorat") || t.includes("paint")) {
    return `

TRADE-SPECIFIC GUIDANCE — DECORATOR / PAINTER:
- Always include a detailed prep line (filling, sanding, caulking, masking, dust sheets, moving/covering furniture, protecting floors with hardboard or correx) — typically 30-50% of the job time and the line customers most often query if it's missing.
- Specify number of coats clearly: one mist coat + two topcoats on new plaster; two full coats over existing emulsion; primer + undercoat + two topcoats on bare/knotted wood.
- Price materials by area covered. Rough coverage rules: emulsion ~12m²/L per coat, trade eggshell ~14m²/L, gloss ~16m²/L. Add 10-15% waste.
- Common brands to reference: Dulux Trade, Crown Trade, Johnstone's Trade, Leyland, Farrow & Ball, Little Greene, Zinsser (primers/stain-block), Tikkurila.
- Wallpaper: split out stripping, lining paper and hanging as separate lines; specify single/double roll.
- Exterior work: include scaffold/tower hire, masonry paint (Sandtex, Weathershield), weather contingency.
- Labour rate: £30-£45/hr; day rate £180-£280.`;
  }

  // Matches: Tiler
  if (t.includes("til")) {
    return `

TRADE-SPECIFIC GUIDANCE — TILER:
- Price tiling labour by m² (typical: £35-£55/m² for wall, £40-£65/m² for floor, £70-£100/m² for mosaic or large-format) or by day rate £200-£300.
- Substrate prep is a separate line: priming (BAL Prime APD, Mapei Eco Prim), levelling compound (self-levelling), plywood overlay or backer board (Hardiebacker, Marmox) where needed.
- For wet areas (showers, wet rooms, bathroom floors) always include a tanking / waterproofing membrane line — reference brands like Mapei Mapegum WPS, BAL Tank-it, Schlüter Kerdi.
- List adhesive separately and specify type: rapid-set vs slow-set, S1/S2 flexible for floors and natural stone (BAL, Mapei, Weber).
- Grout: specify cement-based vs epoxy (Mapei Kerapoxy / Ardex WA) for wet areas, and colour. Include silicone sealant for internal corners and tile-to-bath joints (never grout these).
- Trims: aluminium / chrome / matt black edge trims (Schlüter, Genesis) as their own line.
- Always include 10-15% waste on tile quantities, more for diagonal / herringbone / large-format layouts.
- For underfloor heating: list decoupling matting (Schlüter Ditra) and screed compatibility separately.`;
  }

  return "";
}
