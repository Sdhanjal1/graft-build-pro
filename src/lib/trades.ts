/**
 * Single source of truth for trade-type personalisation.
 *
 * The persisted `profiles.trade_type` value is the human label below
 * (e.g. "Gas Engineer"). `resolveTrade()` accepts any legacy variant
 * ("Plumber / Heating Engineer", "plumber", null) and returns the
 * matching config, falling back to a neutral "Other" entry.
 */
import {
  Wrench, Zap, HardHat, Home, Hammer, PaintRoller, Flame, Grid3X3, MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

export type TradeId =
  | "Plumber"
  | "Gas Engineer"
  | "Electrician"
  | "Builder"
  | "Carpenter"
  | "Roofer"
  | "Decorator"
  | "Tiler"
  | "Other";

export type Certification = {
  /** Substring matched (case-insensitive) against line-item descriptions. */
  key: string;
  /** Short display label, e.g. "CP12", "EICR". */
  label: string;
  /** How long the cert is valid for (months). */
  validityMonths: number;
};

export type TradeConfig = {
  id: TradeId;
  /** Persisted value on `profiles.trade_type`. */
  label: string;
  icon: LucideIcon;
  /** Nouns used in UI copy. */
  noun: { job: string; jobPlural: string };
  /** Default recurring-service blurb shown to traders. */
  defaultServiceType: string | null;
  /** Interval in months for the recurring service. */
  defaultServiceIntervalMonths: number | null;
  /** Trade-specific compliance/certification line items. */
  certifications: Certification[];
  /** Quick-fill quote templates shown on /quotes/new. */
  quoteTemplates: { label: string; prompt: string }[];
  /** Example shown in the home-screen mic tooltip. */
  homeMicExample: string;
  /** Used in onboarding: "Let's set up your {setupLine}". */
  setupLine: string;
  /** Short phrase listing typical materials for this trade, e.g. "fittings, pipework, boiler parts". */
  materialPhrase: string;
};

const TRADES: TradeConfig[] = [
  {
    id: "Plumber",
    label: "Plumber",
    icon: Wrench,
    noun: { job: "job", jobPlural: "jobs" },
    defaultServiceType: null,
    defaultServiceIntervalMonths: null,
    certifications: [
      { key: "unvented", label: "G3 Unvented", validityMonths: 60 },
    ],
    quoteTemplates: [
      { label: "Bathroom suite", prompt: "Remove existing bathroom suite and install new — bath with shower over, basin and pedestal, close-coupled WC, chrome thermostatic shower valve, tile to half height around bath, all waste and supply pipework, silicone seal and make good." },
      { label: "Radiator install", prompt: "Supply and fit 2 new double-panel radiators in lounge and bedroom, including TRVs, lockshield valves and pipework alterations, balance system and bleed." },
      { label: "Leak repair", prompt: "Trace and repair leak under kitchen sink, replace flexi tails and isolation valves, test for further leaks, make good." },
      { label: "Cylinder swap", prompt: "Replace existing hot water cylinder with new 210L unvented unit, including G3 unvented commissioning, tundish, expansion vessel and discharge pipework." },
    ],
    homeMicExample: "Bathroom refit at 14 Elm Road, Roca suite and porcelain tiles, three days labour",
  },
  {
    id: "Gas Engineer",
    label: "Gas Engineer",
    icon: Flame,
    noun: { job: "service", jobPlural: "services" },
    defaultServiceType: "Annual gas safety + boiler service",
    defaultServiceIntervalMonths: 12,
    certifications: [
      { key: "cp12", label: "CP12 Landlord Cert", validityMonths: 12 },
      { key: "gas safety", label: "Gas Safety", validityMonths: 12 },
      { key: "boiler service", label: "Boiler Service", validityMonths: 12 },
    ],
    quoteTemplates: [
      { label: "Boiler swap", prompt: "Replace existing combi boiler with new Worcester Greenstar 30kW, fit magnetic system filter, power flush central heating system, fit new thermostat, test and commission, register warranty and notify Gas Safe." },
      { label: "Annual service", prompt: "Annual boiler service to Worcester Greenstar 30i — clean burner and heat exchanger, check flue, gas pressure and combustion, replace seals as needed, issue service record." },
      { label: "Landlord CP12", prompt: "Annual landlord gas safety inspection (CP12) covering boiler, hob and any other gas appliances at the property. Issue certificate by email same day." },
      { label: "System boiler", prompt: "Install new Vaillant ecoTEC system boiler with 8-zone wiring centre, cylinder coil reconnection, new flue run, magnetic filter and 10-year warranty registration." },
    ],
    homeMicExample: "Annual boiler service and CP12 for Mrs Jones at 12 Oak Road, £95",
  },
  {
    id: "Electrician",
    label: "Electrician",
    icon: Zap,
    noun: { job: "job", jobPlural: "jobs" },
    defaultServiceType: "EICR (Electrical Installation Condition Report)",
    defaultServiceIntervalMonths: 60,
    certifications: [
      { key: "eicr", label: "EICR", validityMonths: 60 },
      { key: "pat", label: "PAT Test", validityMonths: 12 },
      { key: "minor works", label: "Minor Works", validityMonths: 60 },
    ],
    quoteTemplates: [
      { label: "Consumer unit", prompt: "Replace existing consumer unit with new 18th edition compliant 12-way dual RCD board with SPD, full circuit testing, issue EICR and minor works certificate, notify building control via NICEIC." },
      { label: "EV charger", prompt: "Supply and install 7.4kW tethered EV charger to external wall, run new dedicated circuit from consumer unit including isolator and Type A RCBO, commission and register with DNO." },
      { label: "EICR", prompt: "Full EICR (Electrical Installation Condition Report) on a 3-bed semi — test all circuits, document findings, issue NICEIC-compliant report by email." },
      { label: "Downlights", prompt: "Supply and install 8 x fire-rated LED downlights to kitchen ceiling on new circuit with dimmer switch, make good plasterboard." },
    ],
    homeMicExample: "Replace consumer unit at 12 Oak Road, 18th-ed compliant board, £450",
  },
  {
    id: "Builder",
    label: "Builder",
    icon: HardHat,
    noun: { job: "job", jobPlural: "jobs" },
    defaultServiceType: null,
    defaultServiceIntervalMonths: null,
    certifications: [],
    quoteTemplates: [
      { label: "Single-storey extension", prompt: "Build single-storey rear extension 4m x 3m — strip foundations, blockwork cavity walls, flat roof with GRP covering, bifold doors, plastering and decorating to match." },
      { label: "Loft conversion", prompt: "Convert loft to bedroom with en-suite — steels, dormer to rear, Velux to front, staircase, insulation to current regs, plastering and second fix." },
      { label: "Garden wall", prompt: "Build 1.2m brick garden wall approx 8m long including concrete strip foundation, engineering brick below DPC, facing brick above with coping stones." },
    ],
    homeMicExample: "Garden wall, 8 metres, engineering brick and copings, £2,400",
  },
  {
    id: "Carpenter",
    label: "Carpenter",
    icon: Hammer,
    noun: { job: "job", jobPlural: "jobs" },
    defaultServiceType: null,
    defaultServiceIntervalMonths: null,
    certifications: [],
    quoteTemplates: [
      { label: "Fitted wardrobes", prompt: "Design and install fitted wardrobes to master bedroom — full height, sliding mirror doors, internal hanging rail, shelves and drawers in spray-finished MDF." },
      { label: "Kitchen install", prompt: "Install supplied kitchen — base and wall units, worktops, sink and tap, integrated appliances, end panels, plinths and cornice, scribe to wall." },
      { label: "Internal doors", prompt: "Hang 6 x oak internal doors including ironmongery, ease and adjust, fit linings where required." },
      { label: "Second fix", prompt: "Second fix to loft conversion — skirting, architrave, two doors hung with ironmongery, ease and adjust." },
    ],
    homeMicExample: "Hang two oak internal doors at 17 Ashfield Road, £220",
  },
  {
    id: "Roofer",
    label: "Roofer",
    icon: Home,
    noun: { job: "job", jobPlural: "jobs" },
    defaultServiceType: null,
    defaultServiceIntervalMonths: null,
    certifications: [
      { key: "flat roof", label: "GRP Guarantee", validityMonths: 240 },
    ],
    quoteTemplates: [
      { label: "Re-roof", prompt: "Strip existing concrete tile roof — replace battens and breathable membrane, refit existing tiles, re-bed ridge and hip tiles with dry-fix system, new lead flashings to chimney." },
      { label: "Flat roof", prompt: "Strip existing felt flat roof to garage 5m x 3m, replace any rotten decking, install new GRP fibreglass roof system with trims, 20-year guarantee." },
      { label: "Gutter clean", prompt: "Clean and clear all gutters and downpipes to front and rear of property, check fall and rejoint any leaking sections, dispose of waste." },
      { label: "Slipped tiles", prompt: "Replace 12 slipped tiles, ridge re-bedding and new lead flashing to chimney at 8 Park View." },
    ],
    homeMicExample: "Repair flashing around chimney at 8 Park View, £180",
  },
  {
    id: "Decorator",
    label: "Decorator",
    icon: PaintRoller,
    noun: { job: "job", jobPlural: "jobs" },
    defaultServiceType: null,
    defaultServiceIntervalMonths: null,
    certifications: [],
    quoteTemplates: [
      { label: "Whole house repaint", prompt: "Paint full interior of 3-bed house — walls and ceilings 2 coats emulsion, woodwork and doors 1 undercoat 2 topcoats satin, make good minor cracks and fill nail holes." },
      { label: "External paint", prompt: "Prepare and paint external render and fascias — wash down, fill cracks, masonry stabiliser, 2 coats Sandtex masonry paint, 2 coats Dulux Weathershield to woodwork." },
      { label: "Feature wall", prompt: "Prepare and hang feature wallpaper to lounge chimney breast, paint surrounding walls and ceiling 2 coats emulsion." },
    ],
    homeMicExample: "Paint front bedroom, two coats Dulux, £220",
  },
  {
    id: "Tiler",
    label: "Tiler",
    icon: Grid3X3,
    noun: { job: "job", jobPlural: "jobs" },
    defaultServiceType: null,
    defaultServiceIntervalMonths: null,
    certifications: [],
    quoteTemplates: [
      { label: "Bathroom tiling", prompt: "Supply and fit ceramic wall tiles to full height around bath and shower enclosure, floor tiles to bathroom 4m², including adhesive, grout and silicone seal." },
      { label: "Kitchen splashback", prompt: "Supply and fit metro tile splashback between worktop and wall units, including adhesive, grout and trim." },
      { label: "Outdoor patio", prompt: "Lift existing patio and lay 20m² of new porcelain paving on full mortar bed, pointing and cleaning down." },
    ],
    homeMicExample: "Bathroom tiling, 12m² wall and 4m² floor at 22 Hill Crescent",
  },
  {
    id: "Other",
    label: "Other",
    icon: MoreHorizontal,
    noun: { job: "job", jobPlural: "jobs" },
    defaultServiceType: null,
    defaultServiceIntervalMonths: null,
    certifications: [],
    quoteTemplates: [],
    homeMicExample: "Quote Mrs Jones for the job you just finished, £180",
  },
];

const TRADE_BY_LABEL: Record<string, TradeConfig> = Object.fromEntries(
  TRADES.map((t) => [t.label.toLowerCase(), t]),
);

/** Legacy / variant labels mapped to their canonical id. */
const LEGACY_ALIASES: Record<string, TradeId> = {
  "plumber / heating engineer": "Plumber",
  "heating engineer": "Gas Engineer",
  "gas": "Gas Engineer",
  "builder / general contractor": "Builder",
  "general contractor": "Builder",
  "carpenter / joiner": "Carpenter",
  "joiner": "Carpenter",
  "hvac": "Gas Engineer",
  "landscaper": "Builder",
  "bathroom & kitchen fitters": "Carpenter",
};

/** Always returns a TradeConfig — falls back to "Other". */
export function resolveTrade(value: string | null | undefined): TradeConfig {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return TRADES[TRADES.length - 1];
  const direct = TRADE_BY_LABEL[v];
  if (direct) return direct;
  const aliasId = LEGACY_ALIASES[v];
  if (aliasId) return TRADES.find((t) => t.id === aliasId) ?? TRADES[TRADES.length - 1];
  // Loose match: any label containing the trade name (e.g. "Plumber / xyz")
  const loose = TRADES.find((t) => v.includes(t.label.toLowerCase()) && t.id !== "Other");
  return loose ?? TRADES[TRADES.length - 1];
}

export function allTrades(): TradeConfig[] {
  return TRADES;
}

/** Detect certifications referenced inside a quote's line items. */
export function detectCertifications(
  trade: TradeConfig,
  text: string,
): Certification[] {
  if (!text || trade.certifications.length === 0) return [];
  const lc = text.toLowerCase();
  return trade.certifications.filter((c) => lc.includes(c.key.toLowerCase()));
}
