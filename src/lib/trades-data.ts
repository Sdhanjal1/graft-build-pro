export type QuoteLine = {
  description: string;
  qty: number;
  unitPrice: number;
};

export type ExampleQuote = {
  customer: string;
  jobSummary: string;
  lines: QuoteLine[];
  deposit: number;
};

export type Faq = { q: string; a: string };

export type Trade = {
  slug: string;
  name: string;
  shortBody: string;
  headline: string;
  intro: string;
  bullets: { title: string; body: string }[];
  prompts: string[];
  seoTitle: string;
  seoDescription: string;
  jobTypes: string[];
  exampleQuote: ExampleQuote;
  faqs: Faq[];
};

export function quoteTotal(q: ExampleQuote): number {
  return q.lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
}

export const trades: Trade[] = [
  {
    slug: "plumbers",
    name: "Plumbers",
    shortBody: "Combi swaps, leaks, bathroom refits. Quote on the doorstep, send before you're back in the van.",
    headline: "Quoting app for plumbers.",
    intro: "From a dripping tap to a full bathroom refit, talk through the job and Quottr sends a priced, branded quote before you leave the customer's drive.",
    seoTitle: "Quoting App for Plumbers | Speak It, Send It, Get Paid — Quottr",
    seoDescription: "Voice-quote boiler swaps, bathroom refits and leak repairs in minutes. Take deposits on the doorstep. UK plumber's quoting app, free 14-day trial.",
    jobTypes: [
      "Combi boiler swaps",
      "Bathroom refits",
      "Leak repairs",
      "Unvented cylinders",
      "Power flushes",
      "Tap & valve replacements",
      "Wet rooms",
      "Outside taps",
    ],
    bullets: [
      { title: "Speak the job, send the quote", body: "Talk through the work, suite, tiles, isolations, second fix, and Quottr writes it up as clear itemised lines you can tweak before it goes out." },
      { title: "Take a deposit up front", body: "Customer opens the quote on WhatsApp, approves, and pays the deposit by card or Apple Pay. You're funded before you order the parts." },
      { title: "Chase-free payments", body: "Quottr chases the unpaid invoices for you, so you're not the one sending awkward reminders after a long day." },
    ],
    prompts: [
      "Quote Mrs Jones for a new Worcester 30i combi swap, vertical flue, system flush and a magnetic filter.",
      "Quote 17 Elm Road for a full bathroom refit, Roca suite, porcelain tiles to ceiling, three days labour.",
      "Quote the Smiths for a 210 litre unvented cylinder replacement with G3 commissioning.",
    ],
    exampleQuote: {
      customer: "Mrs Jones, 14 Beech Avenue",
      jobSummary: "Worcester Bosch 30i combi swap, like-for-like",
      lines: [
        { description: "Worcester Bosch Greenstar 30i combi boiler", qty: 1, unitPrice: 1295 },
        { description: "Vertical flue kit", qty: 1, unitPrice: 95 },
        { description: "Adey MagnaClean Pro2 filter", qty: 1, unitPrice: 145 },
        { description: "Chemical system flush (Sentinel X800 + X100)", qty: 1, unitPrice: 180 },
        { description: "Labour, 1 day (remove, fit, commission, register warranty)", qty: 1, unitPrice: 650 },
      ],
      deposit: 600,
    },
    faqs: [
      { q: "Does Quottr know plumbing prices?", a: "Quottr learns your prices as you quote. Tell it your rate for a combi swap once, and next time it suggests the same line. You stay in control — every line is editable before the quote goes out." },
      { q: "Can I put my Gas Safe number on the quote?", a: "Yes. Add your Gas Safe registration, business name and logo to your profile once and they appear on every quote and invoice automatically." },
      { q: "Can I take a deposit before I order parts?", a: "Yes. The customer approves the quote on WhatsApp and pays a deposit by card or Apple Pay. You're funded before the merchants' van turns up." },
      { q: "What if the customer doesn't pay the final invoice?", a: "Quottr chases unpaid invoices for you — automatic, polite reminders by email and WhatsApp — so you don't have to send them yourself after a long day." },
    ],
  },
  {
    slug: "gas-engineers",
    name: "Gas engineers",
    shortBody: "Boiler installs, services, landlord CP12s. Quote, certify, get paid, all from your phone.",
    headline: "Quoting app for gas engineers.",
    intro: "Boiler installs, services and landlord CP12s, voice-note the job and Quottr turns it into a priced, branded quote in seconds.",
    seoTitle: "Quoting App for Gas Engineers | Boiler Install Quotes in Minutes — Quottr",
    seoDescription: "Voice-quote boiler installs, services and landlord work in seconds. Your Gas Safe number on every quote. Take card deposits. Free 14-day trial.",
    jobTypes: [
      "Combi boiler installs",
      "System boiler installs",
      "Annual boiler services",
      "Landlord gas safety checks",
      "Power flushes",
      "Gas cooker installs",
      "Warranty install bundles",
      "Smart thermostat fitting",
    ],
    bullets: [
      { title: "Your Gas Safe number on every quote", body: "Quotes and invoices carry your business branding and Gas Safe registration, so you look the part before you've even started." },
      { title: "Itemised installs in seconds", body: "Say the boiler, the flush, the filter and the warranty, and Quottr lays it out as priced lines you can adjust and send." },
      { title: "Paid on the day", body: "Customer approves on WhatsApp and pays by card or Apple Pay. Quottr chases anything unpaid so you don't have to." },
    ],
    prompts: [
      "Quote the Patels for a Vaillant ecoTEC Plus 832, magnetic filter, power flush and 10 year warranty.",
      "Quote 14 Acacia Avenue for an annual boiler service plus a landlord CP12.",
      "Quote Plot 6 for a system boiler install with an 8 zone wiring centre.",
    ],
    exampleQuote: {
      customer: "Mr & Mrs Patel, 22 Oak Lane",
      jobSummary: "Vaillant ecoTEC Plus 832 install with 10-year warranty bundle",
      lines: [
        { description: "Vaillant ecoTEC Plus 832 combi boiler", qty: 1, unitPrice: 1450 },
        { description: "Horizontal flue kit + extension", qty: 1, unitPrice: 145 },
        { description: "Adey MagnaClean Professional 3 Sense", qty: 1, unitPrice: 195 },
        { description: "Full power flush (up to 10 rads)", qty: 1, unitPrice: 450 },
        { description: "Vaillant smart wireless thermostat", qty: 1, unitPrice: 220 },
        { description: "Labour, 1.5 days (install, commission, warranty registration)", qty: 1, unitPrice: 850 },
      ],
      deposit: 750,
    },
    faqs: [
      { q: "Does Quottr include my Gas Safe number on quotes?", a: "Yes. Your Gas Safe registration sits on every quote and invoice next to your logo, so customers see you're legit before they read the price." },
      { q: "Can Quottr produce CP12 certificates?", a: "No, CP12 generation needs a Gas Safe-registered certificate provider. Quottr quotes and invoices the CP12 visit and takes the payment — you produce the cert in your usual app." },
      { q: "Can I bundle warranty-required extras into one quote?", a: "Yes. Voice-note the boiler, flush, filter and thermostat and Quottr lists them as separate priced lines, so the customer sees exactly why a 10-year warranty install costs what it does." },
      { q: "Do I have to retype prices for every install?", a: "No. Quottr remembers your usual prices for boilers, filters and flushes. You can tweak any line before sending." },
    ],
  },
  {
    slug: "electricians",
    name: "Electricians",
    shortBody: "Consumer units, EICRs, rewires. Voice-note the scope, send a tidy quote in seconds.",
    headline: "Quoting app for electricians.",
    intro: "EICRs, consumer units and full rewires, talk through the scope and Quottr produces a fully itemised, branded quote in seconds.",
    seoTitle: "Quoting App for Electricians | EICR, CU Upgrade & Rewire Quotes — Quottr",
    seoDescription: "Voice-quote EICRs, consumer unit upgrades and rewires in seconds. NICEIC / NAPIT details on every quote. Take card deposits. Free 14-day trial.",
    jobTypes: [
      "EICR inspections",
      "Consumer unit upgrades",
      "Full & partial rewires",
      "EV charger installs",
      "LED downlight retrofits",
      "Additional sockets & circuits",
      "Fault finding",
      "Commercial small works",
    ],
    bullets: [
      { title: "Itemised, branded quotes", body: "Talk through the circuits, boards and accessories, and Quottr writes a clean itemised quote carrying your NICEIC or NAPIT details." },
      { title: "Send it before you leave site", body: "Quote goes out on WhatsApp, customer approves and pays a deposit by card or Apple Pay, all before you've packed the van." },
      { title: "Books already sorted", body: "Export your paid invoices straight into Xero, QuickBooks, FreeAgent or Sage, with the right VAT codes in place." },
    ],
    prompts: [
      "Quote 22 Hill Crescent for a full EICR on a three bed semi.",
      "Quote Mrs Akhtar for an 18th edition Hager consumer unit upgrade with surge protection.",
      "Quote the cafe on the High Street for 12 LED downlights, four double sockets and an extractor isolation.",
    ],
    exampleQuote: {
      customer: "Mrs Akhtar, 9 Hill Crescent",
      jobSummary: "18th edition consumer unit upgrade with SPD, 3-bed semi",
      lines: [
        { description: "Hager 18th edition consumer unit, 10-way dual RCD", qty: 1, unitPrice: 165 },
        { description: "Type 2 surge protection device (SPD)", qty: 1, unitPrice: 85 },
        { description: "Main earth bonding upgrade (gas & water)", qty: 1, unitPrice: 95 },
        { description: "Pre-works EICR & remedials", qty: 1, unitPrice: 220 },
        { description: "EIC certificate & notification to building control", qty: 1, unitPrice: 65 },
        { description: "Labour, 1 day (isolate, swap, test, certify)", qty: 1, unitPrice: 520 },
      ],
      deposit: 300,
    },
    faqs: [
      { q: "Does Quottr know electrical pricing?", a: "Quottr learns your prices as you quote. Set your rate for an EICR, a CU upgrade or an EV charger once and it suggests the same line next time — fully editable before sending." },
      { q: "Can I add my NICEIC or NAPIT details to every quote?", a: "Yes. Add your certification body and registration number to your profile once and they sit on every quote and invoice next to your logo." },
      { q: "Can I quote EICR remedials separately?", a: "Yes. Voice-note each remedial item with its C-code priority and Quottr lays them out as separate lines the customer can approve as one." },
      { q: "Does it handle EV charger installs with the OZEV / grant paperwork?", a: "Quottr produces the quote and invoice. The OZEV grant claim itself is still filed in your installer portal — we just make sure the customer-facing paperwork is sharp." },
    ],
  },
  {
    slug: "joiners-carpenters",
    name: "Joiners & carpenters",
    shortBody: "Kitchens, second fix, bespoke joinery. Talk the job, send a complete quote from the van.",
    headline: "Quoting app for joiners and carpenters.",
    intro: "Kitchens, second fix and bespoke joinery, talk through the job and send a complete, itemised quote from the van.",
    seoTitle: "Quoting App for Joiners & Carpenters | Kitchen & Second Fix Quotes — Quottr",
    seoDescription: "Voice-quote kitchen installs, second fix and bespoke joinery in minutes. Materials and labour split out. Take card deposits. Free 14-day trial.",
    jobTypes: [
      "Kitchen installs",
      "Second fix carpentry",
      "Bespoke joinery",
      "Internal doors & architrave",
      "Fitted wardrobes",
      "Skirting & mouldings",
      "Loft conversions (second fix)",
      "Stud walls & timber framing",
    ],
    bullets: [
      { title: "Materials and labour, broken out", body: "Voice-note the spec, units, worktops, doors, ironmongery, and Quottr separates materials from labour so the customer sees the value." },
      { title: "Deposit up front", body: "Bespoke work ties up your cash. Customer pays a deposit on approval by card or Apple Pay, so you're not funding it yourself." },
      { title: "Branded and professional", body: "Every quote carries your business name and logo, the kind of detail that wins the job over a day rate texted at midnight." },
    ],
    prompts: [
      "Quote the Hughes for a full kitchen install, Howdens shaker units, quartz tops, four day fit.",
      "Quote 31 Ashfield Road for second fix on a loft conversion, two doors, skirting and architrave throughout.",
      "Quote Plot 9 for a bespoke understairs storage unit in oak veneer.",
    ],
    exampleQuote: {
      customer: "The Hughes, 5 Linden Close",
      jobSummary: "Howdens shaker kitchen install, 14 units + quartz tops",
      lines: [
        { description: "Kitchen carcasses & doors (customer supplied) — fit only", qty: 14, unitPrice: 65 },
        { description: "Quartz worktop template, supply & fit", qty: 1, unitPrice: 1850 },
        { description: "Appliance install (oven, hob, extractor, dishwasher, F/F)", qty: 5, unitPrice: 75 },
        { description: "Plinths, cornice, pelmet & end panels", qty: 1, unitPrice: 320 },
        { description: "Labour, 4 days (2 fitters)", qty: 1, unitPrice: 1900 },
        { description: "Skip & waste removal", qty: 1, unitPrice: 220 },
      ],
      deposit: 1500,
    },
    faqs: [
      { q: "Can I split materials from labour on the quote?", a: "Yes — Quottr lists materials and labour as separate lines by default, so the customer sees the value in your fit, not just one lump sum." },
      { q: "How do I quote bespoke work without itemising every screw?", a: "Voice-note the spec at the level you'd describe it to a mate — Quottr writes it up as one or two clear lines (carcassing, doors, ironmongery, finish) you can adjust before sending." },
      { q: "Can I take a deposit before I cut any timber?", a: "Yes. Customer approves the quote and pays a deposit by card or Apple Pay, so your timber order isn't funded out of your own pocket." },
      { q: "Does it handle customer-supplied units (Howdens, Wickes, B&Q)?", a: "Yes — quote 'supply & fit' or 'fit only' as separate line types. The customer sees clearly what you're providing and what they are." },
    ],
  },
  {
    slug: "builders",
    name: "Builders",
    shortBody: "Extensions, loft conversions, knock-throughs. Big jobs quoted clearly, deposits taken up front.",
    headline: "Quoting app for builders.",
    intro: "Extensions, loft conversions and structural work, talk through the build and Quottr turns it into a clear, itemised quote your customer can actually follow.",
    seoTitle: "Quoting App for Builders | Extension & Loft Conversion Quotes — Quottr",
    seoDescription: "Voice-quote extensions, loft conversions and knock-throughs. Big jobs broken into clear stages on the quote. Deposit on approval. Free 14-day trial.",
    jobTypes: [
      "Single & double-storey extensions",
      "Loft conversions",
      "Knock-throughs (RSJs)",
      "Garage conversions",
      "Groundworks & foundations",
      "Renovations & refurbs",
      "Garden rooms & outbuildings",
      "Structural alterations",
    ],
    bullets: [
      { title: "Big jobs, broken down", body: "Voice-note the build, groundworks, blockwork, roof, second fix, and Quottr itemises each stage so the price doesn't land as one scary number." },
      { title: "Deposit before you order materials", body: "Customer approves on WhatsApp and pays a deposit by card or Apple Pay, so the first material order isn't out of your own pocket." },
      { title: "Chase-free balances", body: "Quottr chases the unpaid invoices for you, so the final balance doesn't drift for weeks after you've finished." },
    ],
    prompts: [
      "Quote 5 Mill Lane for a single storey rear extension, four by three metres, blockwork cavity walls and a GRP flat roof.",
      "Quote the Hartleys for a loft conversion to a bedroom and en-suite with a rear dormer.",
      "Quote 12 Vicarage Road for a structural knock-through between the kitchen and dining room, steel to engineer's spec.",
    ],
    exampleQuote: {
      customer: "5 Mill Lane",
      jobSummary: "Single-storey rear extension, 4m × 3m, blockwork cavity walls, GRP flat roof",
      lines: [
        { description: "Stage 1 — Groundworks, foundations & oversite", qty: 1, unitPrice: 8500 },
        { description: "Stage 2 — Blockwork cavity walls to wallplate", qty: 1, unitPrice: 11200 },
        { description: "Stage 3 — Joists, GRP flat roof & rainwater goods", qty: 1, unitPrice: 6800 },
        { description: "Stage 4 — Windows, bi-fold doors & external rendering", qty: 1, unitPrice: 7200 },
        { description: "Stage 5 — First & second fix (plastering, flooring, decoration)", qty: 1, unitPrice: 9400 },
        { description: "Building control inspections & sign-off", qty: 1, unitPrice: 850 },
      ],
      deposit: 4000,
    },
    faqs: [
      { q: "Can I take stage payments on a big build?", a: "Yes. Break the build into stages on the quote (groundworks, walls, roof, second fix) and Quottr invoices each stage as you reach it — customer pays by card or bank transfer." },
      { q: "Won't a £40k quote scare the customer if they see one number?", a: "That's why Quottr itemises by stage. The customer sees what each phase costs and what they're getting — far easier to approve than a single lump sum." },
      { q: "How do I handle variations mid-build?", a: "Send a variation quote in seconds, customer approves on WhatsApp before the work starts. No more 'I never agreed to that' arguments at the end." },
      { q: "Does it handle subcontractor costs?", a: "Yes — quote your subbies (sparks, plumbers, plasterers) as separate lines or roll them into a stage. Either way the cost is on the quote, not coming out of your margin." },
    ],
  },
  {
    slug: "roofers",
    name: "Roofers",
    shortBody: "Tile repairs, full re-roofs, gutters. Talk the scope, send the quote before you climb down.",
    headline: "Quoting app for roofers.",
    intro: "Tile slips, full re-roofs, fascias and gutters, talk through the scope and send a priced, itemised quote before you're off the ladder.",
    seoTitle: "Quoting App for Roofers | Re-Roof, Repair & Gutter Quotes — Quottr",
    seoDescription: "Voice-quote tile repairs, full re-roofs, fascias and gutters in minutes. Scaffold and waste broken out. Take card deposits. Free 14-day trial.",
    jobTypes: [
      "Tile & slate repairs",
      "Full re-roofs",
      "Fascias, soffits & guttering",
      "Lead flashings",
      "Chimney repairs & repointing",
      "Flat roof replacements (GRP / EPDM)",
      "Velux installs",
      "Storm damage repairs",
    ],
    bullets: [
      { title: "Nothing left off the quote", body: "Voice-note the job and Quottr lays out tiles, battens, flashings and labour as separate lines, so scaffold and waste don't get forgotten." },
      { title: "Deposit covers your materials", body: "Customer approves on WhatsApp and pays a deposit by card or Apple Pay before the tile order goes in." },
      { title: "Branded quotes that win trust", body: "Every quote goes out under your business name and logo, a cut above a number scribbled on the back of a card." },
    ],
    prompts: [
      "Quote 8 Park View for replacing 12 slipped tiles, ridge re-bedding and a new lead flashing to the chimney.",
      "Quote the bungalow on Mill Lane for a full re-roof, concrete interlocking tiles, new felt and battens, 80 square metres.",
      "Quote Mrs Reilly for full UPVC fascias, soffits and gutters on a three bed semi.",
    ],
    exampleQuote: {
      customer: "Bungalow, Mill Lane",
      jobSummary: "Full re-roof, 80m², concrete interlocking tiles + new felt & battens",
      lines: [
        { description: "Strip existing roof, sort & set aside reusable tiles", qty: 1, unitPrice: 950 },
        { description: "Marley Modern concrete interlocking tiles", qty: 80, unitPrice: 22 },
        { description: "Klober Permo Air breathable felt & 25×50 battens", qty: 80, unitPrice: 9 },
        { description: "New lead flashings to chimney & abutments", qty: 1, unitPrice: 480 },
        { description: "Dry ridge & dry verge system", qty: 1, unitPrice: 520 },
        { description: "Scaffold hire, 2 weeks", qty: 1, unitPrice: 880 },
        { description: "Skip & waste removal", qty: 1, unitPrice: 320 },
        { description: "Labour, 4 days (2 roofers)", qty: 1, unitPrice: 2400 },
      ],
      deposit: 1500,
    },
    faqs: [
      { q: "Is scaffold included on the quote?", a: "Yes — scaffold is its own line. Customers see exactly what the hire costs and how long it's up for, so there's no awkward extras after the fact." },
      { q: "Can I quote insurance work?", a: "Yes. Itemise the job in the detail an insurer expects (strip, supply, labour, scaffold, waste) and the quote PDF is ready to send to the loss adjuster." },
      { q: "Can I take a deposit before I order tiles?", a: "Yes. Customer approves on WhatsApp and pays a deposit by card or Apple Pay before your tile and felt order leaves the merchant." },
      { q: "What if the job changes once we open up the roof?", a: "Send a quick variation quote from the roof. Customer approves on their phone before you carry on — no nasty surprises at the end." },
    ],
  },
  {
    slug: "tilers",
    name: "Tilers",
    shortBody: "Bathrooms, splashbacks, wet rooms, patios. Voice-note the room, send a priced quote in minutes.",
    headline: "Quoting app for tilers.",
    intro: "Bathrooms, kitchen splashbacks, wet rooms and patios, talk through the room and Quottr sends a priced, itemised quote in minutes.",
    seoTitle: "Quoting App for Tilers | Bathroom, Wet Room & Splashback Quotes — Quottr",
    seoDescription: "Voice-quote bathroom tiling, splashbacks and wet rooms per m². Adhesive, grout and trims itemised. Take card deposits. Free 14-day trial.",
    jobTypes: [
      "Bathroom tiling (walls & floor)",
      "Kitchen splashbacks",
      "Wet rooms",
      "Patios & external tiling",
      "Underfloor heating overlays",
      "Tile removal & prep",
      "Natural stone & porcelain",
      "Mosaic & feature walls",
    ],
    bullets: [
      { title: "Priced by the metre, itemised", body: "Voice-note the areas, walls, floor, adhesive, grout, trims, and Quottr writes them up as clear lines you can adjust before sending." },
      { title: "Get a deposit on approval", body: "Customer opens the quote on WhatsApp, accepts and pays a deposit by card or Apple Pay, before you buy a single box of tiles." },
      { title: "Paid without the chasing", body: "Quottr chases the unpaid invoices for you, so you can get on with the next job instead of sending reminders." },
    ],
    prompts: [
      "Quote 12 Beech Drive for full height tiling around the bath and shower plus four square metres of bathroom floor.",
      "Quote the cafe on Castle Street for a metro tile splashback between the worktop and wall units.",
      "Quote 6 Oak Avenue for a wet room, tank the floor and lower walls, porcelain to ceiling height.",
    ],
    exampleQuote: {
      customer: "6 Oak Avenue",
      jobSummary: "Wet room conversion — tank, porcelain tile to ceiling, 9m² walls + 4m² floor",
      lines: [
        { description: "Walls — porcelain tile supply & fit", qty: 9, unitPrice: 78 },
        { description: "Floor — porcelain tile supply & fit (anti-slip)", qty: 4, unitPrice: 92 },
        { description: "Tanking system (membrane + corners + primer)", qty: 1, unitPrice: 280 },
        { description: "Adhesive (rapid-set flexible, S1)", qty: 6, unitPrice: 28 },
        { description: "Grout & silicone (colour matched)", qty: 1, unitPrice: 65 },
        { description: "Aluminium trims & profiles", qty: 1, unitPrice: 95 },
        { description: "Labour, 2.5 days", qty: 1, unitPrice: 920 },
      ],
      deposit: 600,
    },
    faqs: [
      { q: "Do you quote by the m² or by the room?", a: "Both — voice-note the wall and floor areas in m² and Quottr lists them as separate priced lines. You can adjust per-m² rate per job (porcelain vs ceramic vs natural stone)." },
      { q: "Are adhesive, grout and trims itemised separately?", a: "Yes. Adhesive, grout, silicone and trims each get their own line, so the customer sees what they're really paying for — not just 'materials'." },
      { q: "How do I handle awkward cuts and feature walls?", a: "Add them as a labour line at your usual rate, or voice-note 'plus 4 hours mosaic feature wall' and Quottr adds the line for you." },
      { q: "Can I take a deposit before I order the tiles?", a: "Yes. Customer approves the quote on WhatsApp and pays a deposit by card or Apple Pay before your tile order goes in." },
    ],
  },
  {
    slug: "decorators",
    name: "Decorators",
    shortBody: "Rooms, exteriors, commercial. Itemised quotes that win the job on detail.",
    headline: "Quoting app for decorators.",
    intro: "From a single feature wall to a full commercial repaint, Quottr breaks down prep, paint and labour so customers see exactly what they're paying for.",
    seoTitle: "Quoting App for Painters & Decorators | Room & Exterior Quotes — Quottr",
    seoDescription: "Voice-quote interior rooms, exterior masonry and commercial repaints in minutes. Prep, paint and labour itemised. Take card deposits. Free 14-day trial.",
    jobTypes: [
      "Interior rooms",
      "Full house repaints",
      "Exterior masonry & render",
      "Commercial repaints",
      "Wallpapering",
      "Woodwork & doors",
      "Spray finishing",
      "Plaster prep & filling",
    ],
    bullets: [
      { title: "Room by room, itemised", body: "Voice-note each room and Quottr separates walls, ceilings, woodwork and prep, so the quote reads clearly instead of one lump sum." },
      { title: "Win on the detail", body: "An itemised quote beats a rival who just texts 'about £1,200'. Customers want to see what they're paying for, and that wins you the job." },
      { title: "Approved and paid on your phone", body: "Customer approves on WhatsApp and pays a deposit by card or Apple Pay. Quottr chases anything still owing." },
    ],
    prompts: [
      "Quote 4 Linden Close for a full house repaint, five rooms, hallway, stairs and landing in Dulux Trade.",
      "Quote the cafe on Castle Street for a full repaint of the customer area including all woodwork and a feature wall.",
      "Quote Mrs Doyle for exterior masonry paint on a three bed semi, two coats Sandtex.",
    ],
    exampleQuote: {
      customer: "4 Linden Close",
      jobSummary: "Full house repaint — 5 rooms + hallway, stairs & landing, Dulux Trade",
      lines: [
        { description: "Prep — fill, caulk, sand & dust-sheet all rooms", qty: 1, unitPrice: 380 },
        { description: "Master bedroom — walls, ceiling, woodwork (2 coats)", qty: 1, unitPrice: 420 },
        { description: "Bedroom 2 — walls, ceiling, woodwork (2 coats)", qty: 1, unitPrice: 360 },
        { description: "Bedroom 3 — walls, ceiling, woodwork (2 coats)", qty: 1, unitPrice: 320 },
        { description: "Lounge — walls, ceiling, woodwork (2 coats) + feature wall", qty: 1, unitPrice: 520 },
        { description: "Dining room — walls, ceiling, woodwork (2 coats)", qty: 1, unitPrice: 380 },
        { description: "Hallway, stairs & landing (2 coats)", qty: 1, unitPrice: 580 },
        { description: "Dulux Trade paint (trade-priced, supplied)", qty: 1, unitPrice: 420 },
      ],
      deposit: 800,
    },
    faqs: [
      { q: "Is prep priced separately from the paintwork?", a: "Yes — prep gets its own line (fill, caulk, sand, dust-sheet). Customers see why a proper job costs more than the bloke who 'just slaps it on'." },
      { q: "Can I quote trade paint at trade prices?", a: "Yes. Add paint as a supplied line at your trade rate, or leave it as 'customer to supply'. Either way it's on the quote, not absorbed into labour." },
      { q: "Should I quote day-rate or fixed-price?", a: "Both work. Quottr handles fixed-price by room (the usual choice for homeowners) or day-rate plus materials (better for commercial). Pick per quote." },
      { q: "Can I quote a feature wall as an add-on?", a: "Yes — voice-note 'plus a feature wall in Farrow & Ball Hague Blue' and Quottr adds it as its own priced line you can tweak." },
    ],
  },
];

export function getTradeBySlug(slug: string): Trade | undefined {
  return trades.find((t) => t.slug === slug);
}
