/**
 * Trade-specific guidance appended to the AI system prompt so generated
 * quotes reflect typical line items, regulatory hints, common brands and
 * labour-rate ranges for the tradesperson's actual trade.
 *
 * Returns "" when the trade is unknown so the generic prompt still stands.
 */
export function tradeGuidance(trade: string | null | undefined): string {
  if (!trade) return "";
  const t = trade.toLowerCase();

  if (t.includes("plumb") || t.includes("heating") || t.includes("gas")) {
    return `

TRADE-SPECIFIC GUIDANCE — PLUMBER / HEATING ENGINEER:
- For any boiler, gas appliance or gas pipework job, include a separate line for Gas Safe registration / building control notification (typically £25-£50).
- Common brands to reference where appropriate: Worcester Bosch, Vaillant, Ideal, Baxi, Drayton, Honeywell, Geberit, Grohe, Mira.
- Labour rate: £55-£75/hr.
- Boiler installs: consider adding magnetic system filter, power flush, new programmer/thermostat, and warranty registration as their own line items.
- Bathrooms: split out supply vs fit, silicone/sealant, waste pipework and isolation valves.
- Radiator work: TRVs, lockshield valves, balancing and bleeding usually warrant their own line.`;
  }

  if (t.includes("electric")) {
    return `

TRADE-SPECIFIC GUIDANCE — ELECTRICIAN:
- All notifiable work (consumer units, new circuits, bathroom/kitchen rewiring) must include a separate line for Part P building control notification via NICEIC / NAPIT / ELECSA (typically £30-£60).
- Issue a Minor Works Certificate or EICR as its own line item where required.
- Reference 18th Edition compliance and RCBO / dual-RCD where relevant.
- Common brands: Hager, Wylex, MK, Crabtree, BG, Click Scolmore.
- Labour rate: £55-£75/hr.
- Bathroom electrical work: mention IP-rated fittings and zone compliance.`;
  }

  if (t.includes("build") || t.includes("contractor")) {
    return `

TRADE-SPECIFIC GUIDANCE — BUILDER / GENERAL CONTRACTOR:
- Include separate lines for strip-out / muck-away / skip hire where the job involves demolition or large material movement.
- For extensions and structural work, add lines for building control fees and structural engineer's calculations.
- Sub-trades (electrician, plumber, plasterer) should usually be split into their own line items, not bundled into labour.
- Always include a "making good and decorating" line where walls/floors are disturbed.
- Labour rate: £45-£65/hr for own labour.`;
  }

  if (t.includes("carpenter") || t.includes("joiner")) {
    return `

TRADE-SPECIFIC GUIDANCE — CARPENTER / JOINER:
- Split first-fix (studwork, joists, noggins, door linings) from second-fix (architrave, skirting, doors, ironmongery) into separate line items where both apply.
- Specify timber type where relevant: softwood, hardwood, MDF, plywood, oak.
- Ironmongery (hinges, handles, latches) often warrants its own line.
- Labour rate: £40-£55/hr.`;
  }

  if (t.includes("roof")) {
    return `

TRADE-SPECIFIC GUIDANCE — ROOFER:
- Scaffolding or tower hire should almost always be a separate line item — never bundle into labour.
- Specify covering type: concrete tile, clay tile, natural slate, felt, GRP, EPDM, lead flashing.
- Include waste removal / skip hire as its own line where stripping is involved.
- Mention insurance-backed guarantee (IBG) where the job is large enough to warrant it.
- Labour rate: £45-£60/hr.`;
  }

  if (t.includes("decorat") || t.includes("paint")) {
    return `

TRADE-SPECIFIC GUIDANCE — DECORATOR:
- Always include a prep line (filling, sanding, caulking, masking, dust sheets) — typically 30-50% of the job time.
- Specify number of coats: one mist + two topcoats for new plaster, two coats over existing.
- Price materials by area covered (rough rule: 1L emulsion covers ~12m² per coat).
- Common brands: Dulux Trade, Crown Trade, Johnstone's Trade, Farrow & Ball, Little Greene.
- Labour rate: £30-£45/hr or day rate £180-£280.`;
  }

  if (t.includes("til")) {
    return `

TRADE-SPECIFIC GUIDANCE — TILER:
- Price tiling labour by m² (typical: £35-£55/m² for wall, £40-£65/m² for floor) or by day rate £200-£300.
- Always include separate lines for adhesive, grout, spacers, edge trims and silicone.
- For wet areas (showers, wet rooms) include a tanking / waterproofing membrane line.
- Mention substrate prep (priming, levelling compound) where relevant.`;
  }

  return "";
}
