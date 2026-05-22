export type Trade = {
  slug: string;
  name: string;
  shortBody: string;
  headline: string;
  intro: string;
  bullets: { title: string; body: string }[];
  prompts: string[];
};

export const trades: Trade[] = [
  {
    slug: "plumbers",
    name: "Plumbers",
    shortBody: "Combi swaps, leaks, bathrooms. Quote on the doorstep, send before you get back in the van.",
    headline: "Quoting app for plumbers.",
    intro: "From a dripping tap to a full bathroom refit, voice-note the job and Quottr sends a priced, branded quote before you leave the customer's drive.",
    bullets: [
      { title: "Combi & boiler swaps priced in seconds", body: "Quottr knows 2026 UK trade pricing for the major boiler brands, Worcester, Vaillant, Ideal, Baxi, and adds labour, flue runs and filters automatically." },
      { title: "Bathroom refits without spreadsheets", body: "Speak the room: suite, tiles, isolations, second fix. Quottr itemises every line and totals the deposit, stage payment and balance." },
      { title: "Get paid the same day", body: "Customer taps the WhatsApp link, approves and pays the deposit by card or Apple Pay. You get a notification before the kettle's boiled." },
    ],
    prompts: [
      "Quote Mrs Jones for a new Worcester 30i combi swap, vertical flue, system flush and a magnetic filter.",
      "Quote 17 Elm Road for a full bathroom refit, Roca suite, porcelain tiles to ceiling, three day labour.",
      "Quote the Smiths for a hot water cylinder replacement, 210 litre unvented, with G3 unvented commissioning.",
    ],
  },
  {
    slug: "gas-engineers",
    name: "Gas engineers",
    shortBody: "Boiler installs, annual services, landlord certs. Quottr remembers when to call them back.",
    headline: "Quoting app for gas engineers.",
    intro: "Boiler installs, services, landlord CP12s, Quottr handles the quote, the cert, and the chase so you stay on the tools.",
    bullets: [
      { title: "CP12 landlord certs sorted", body: "Attach gas safety certs to every job. Customer portal stores every cert you've ever issued for them, landlords love it." },
      { title: "Service reminders that actually work", body: "Quottr remembers when a boiler was installed and chases the annual service automatically. Recurring revenue, on autopilot." },
      { title: "Branded with your Gas Safe number", body: "Every quote and invoice carries your Gas Safe registration. Looks professional, builds trust, wins the job." },
    ],
    prompts: [
      "Quote the Patels for a Vaillant ecoTEC Plus 832, magnetic filter, power flush and 10 year warranty.",
      "Quote 14 Acacia Avenue for an annual boiler service plus a landlord CP12.",
      "Quote the new build at Plot 6 for a system boiler install with 8 zone wiring centre.",
    ],
  },
  {
    slug: "electricians",
    name: "Electricians",
    shortBody: "Consumer units, EICRs, rewires. Voice-note the scope, send a tidy quote in seconds.",
    headline: "Quoting app for electricians.",
    intro: "EICRs, consumer units, full rewires, talk the job and Quottr produces a fully itemised, NICEIC-style quote in seconds.",
    bullets: [
      { title: "EICRs priced room by room", body: "Walk the property in site capture mode, tap each circuit, and Quottr generates the report-ready quote." },
      { title: "Consumer unit upgrades", body: "Quottr knows current 2026 prices for Hager, Wylex, MK and Schneider boards, plus the SPDs and RCBOs that regs require." },
      { title: "Compliant invoices", body: "Every invoice carries your part P / NICEIC details. Tax digital ready and HMRC happy." },
    ],
    prompts: [
      "Quote 22 Hill Crescent for a full EICR on a three bed semi.",
      "Quote Mrs Akhtar for a consumer unit upgrade, 18th edition compliant Hager board with surge protection.",
      "Quote the cafe on the High Street for 12 LED downlights, 4 double sockets and an extractor isolation.",
    ],
  },
  {
    slug: "joiners-carpenters",
    name: "Joiners & carpenters",
    shortBody: "Kitchens, second fix, bespoke. Site capture mode walks the room with you.",
    headline: "Quoting app for joiners and carpenters.",
    intro: "Kitchens, second fix, bespoke joinery, walk the job, tap as you go, send a complete quote from the van.",
    bullets: [
      { title: "Kitchen fits priced room-by-room", body: "Site capture mode lets you tap units, worktops, appliances and plinths as you survey. One quote, fully itemised." },
      { title: "Second fix, sorted", body: "Skirting, architrave, doors, ironmongery, voice-note the spec and Quottr breaks down materials and labour separately." },
      { title: "Stage payments built in", body: "Bespoke jobs need staged invoicing. Quottr handles deposit, mid-job draw and final balance automatically." },
    ],
    prompts: [
      "Quote the Hughes for a full kitchen install, Howdens shaker units, quartz tops, four day fit.",
      "Quote 31 Ashfield Road for second fix on a loft conversion, two doors, skirting and architrave throughout.",
      "Quote the new build at Plot 9 for a bespoke understairs storage unit in oak veneer.",
    ],
  },
  {
    slug: "roofers",
    name: "Roofers",
    shortBody: "Tile repairs, full re-roofs, gutters. Photo, voice, done.",
    headline: "Quoting app for roofers.",
    intro: "Tile slips, full re-roofs, fascias and gutters, snap a photo, talk the scope, send a quote before you climb down.",
    bullets: [
      { title: "Photo + voice = quote", body: "Snap the roof from the ground, voice-note what you can see. Quottr turns it into a priced, itemised quote." },
      { title: "Scaffold and waste sorted", body: "Quottr factors scaffold hire, skip costs and labour days into every roofing quote, no more forgotten line items." },
      { title: "Deposits before you start", body: "Roofing deposits cover your materials. Customer pays via WhatsApp link before the order goes in." },
    ],
    prompts: [
      "Quote 8 Park View for replacing 12 slipped tiles, ridge re-bedding and a new lead flashing to the chimney.",
      "Quote the bungalow on Mill Lane for a full re-roof, concrete interlocking tiles, new felt and battens, 80 square metres.",
      "Quote Mrs Reilly for full UPVC fascias, soffits and gutters on a three bed semi.",
    ],
  },
  {
    slug: "decorators",
    name: "Decorators",
    shortBody: "Rooms, exteriors, commercial. Itemised quotes that win the job.",
    headline: "Quoting app for decorators.",
    intro: "From a single feature wall to a full commercial repaint, Quottr breaks down prep, paint and labour so customers see the value.",
    bullets: [
      { title: "Room-by-room pricing", body: "Walk the house, voice-note each room. Quottr itemises walls, ceilings, woodwork and prep separately." },
      { title: "Paint specced properly", body: "Mention the brand and finish, Dulux Trade, Farrow & Ball, Johnstone's, and Quottr applies the right rate." },
      { title: "Win on detail", body: "Itemised quotes win against tradespeople who just text 'about £1,200'. Customers want to see what they're paying for." },
    ],
    prompts: [
      "Quote 4 Linden Close for a full house repaint, five rooms, hallway, stairs and landing in Dulux Trade.",
      "Quote the cafe on Castle Street for a full repaint of the customer area including all woodwork and a feature wall.",
      "Quote Mrs Doyle for exterior masonry paint on a three bed semi, two coats Sandtex.",
    ],
  },
  {
    slug: "bathroom-kitchen",
    name: "Bathroom & kitchen fitters",
    shortBody: "Multi-day jobs, deposits, stage payments. Quottr handles the schedule.",
    headline: "Quoting app for bathroom and kitchen fitters.",
    intro: "Multi-day fits with deposits, mid-job draws and final balances, Quottr handles the money so you handle the install.",
    bullets: [
      { title: "Stage payments on autopilot", body: "Set the deposit, mid-job and final percentages once. Quottr invoices and chases each stage automatically." },
      { title: "Itemised by trade", body: "Plumbing, electrics, tiling, joinery, plastering, each trade broken out so customers see exactly what they're paying for." },
      { title: "Schedule it from the quote", body: "Once the customer approves, the job slots straight into your calendar with the dates blocked out." },
    ],
    prompts: [
      "Quote 12 Beech Drive for a full bathroom refit, Roca suite, porcelain tiles, eight day fit including plumbing and electrics.",
      "Quote the Hughes for a Howdens kitchen install, 14 units, quartz worktops, integrated appliances, five day fit.",
      "Quote 6 Oak Avenue for an ensuite refit, walk-in shower, vanity unit, tiled floor and walls, four day fit.",
    ],
  },
  {
    slug: "landscapers",
    name: "Landscapers & groundworks",
    shortBody: "Big jobs, multiple visits. Quote, invoice, get paid before winter.",
    headline: "Quoting app for landscapers and groundworks.",
    intro: "Patios, driveways, full garden builds, big-ticket jobs with materials, plant hire and multi-week labour all priced in one quote.",
    bullets: [
      { title: "Plant hire and skips priced in", body: "Quottr factors mini-digger hire, dumpers, skips and aggregate deliveries into every quote so nothing comes off the margin." },
      { title: "Phased invoicing", body: "Big garden jobs run for weeks. Quottr invoices in phases, dig out, base, build, finish, so cash flow stays healthy." },
      { title: "Photo-led quotes", body: "Take photos of the garden, voice-note the scope, send a fully visual quote that helps the customer say yes." },
    ],
    prompts: [
      "Quote 19 Willow Way for a 60 square metre Indian sandstone patio with raised beds and outdoor lighting.",
      "Quote the bungalow on Vicarage Lane for a full block-paved driveway, 90 square metres, dig out and base included.",
      "Quote Mr Brennan for a full garden makeover, porcelain patio, artificial lawn, fencing and a pergola.",
    ],
  },
];

export function getTradeBySlug(slug: string): Trade | undefined {
  return trades.find((t) => t.slug === slug);
}
