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
    shortBody: "Combi swaps, leaks, bathroom refits. Quote on the doorstep, send before you're back in the van.",
    headline: "Quoting app for plumbers.",
    intro: "From a dripping tap to a full bathroom refit, talk through the job and Quottr sends a priced, branded quote before you leave the customer's drive.",
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
  },
  {
    slug: "gas-engineers",
    name: "Gas engineers",
    shortBody: "Boiler installs, services, landlord CP12s. Quote, certify, get paid, all from your phone.",
    headline: "Quoting app for gas engineers.",
    intro: "Boiler installs, services and landlord CP12s, voice-note the job and Quottr turns it into a priced, branded quote in seconds.",
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
  },
  {
    slug: "electricians",
    name: "Electricians",
    shortBody: "Consumer units, EICRs, rewires. Voice-note the scope, send a tidy quote in seconds.",
    headline: "Quoting app for electricians.",
    intro: "EICRs, consumer units and full rewires, talk through the scope and Quottr produces a fully itemised, branded quote in seconds.",
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
  },
  {
    slug: "joiners-carpenters",
    name: "Joiners & carpenters",
    shortBody: "Kitchens, second fix, bespoke joinery. Talk the job, send a complete quote from the van.",
    headline: "Quoting app for joiners and carpenters.",
    intro: "Kitchens, second fix and bespoke joinery, talk through the job and send a complete, itemised quote from the van.",
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
  },
  {
    slug: "builders",
    name: "Builders",
    shortBody: "Extensions, loft conversions, knock-throughs. Big jobs quoted clearly, deposits taken up front.",
    headline: "Quoting app for builders.",
    intro: "Extensions, loft conversions and structural work, talk through the build and Quottr turns it into a clear, itemised quote your customer can actually follow.",
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
  },
  {
    slug: "roofers",
    name: "Roofers",
    shortBody: "Tile repairs, full re-roofs, gutters. Talk the scope, send the quote before you climb down.",
    headline: "Quoting app for roofers.",
    intro: "Tile slips, full re-roofs, fascias and gutters, talk through the scope and send a priced, itemised quote before you're off the ladder.",
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
  },
  {
    slug: "tilers",
    name: "Tilers",
    shortBody: "Bathrooms, splashbacks, wet rooms, patios. Voice-note the room, send a priced quote in minutes.",
    headline: "Quoting app for tilers.",
    intro: "Bathrooms, kitchen splashbacks, wet rooms and patios, talk through the room and Quottr sends a priced, itemised quote in minutes.",
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
  },
  {
    slug: "decorators",
    name: "Decorators",
    shortBody: "Rooms, exteriors, commercial. Itemised quotes that win the job on detail.",
    headline: "Quoting app for decorators.",
    intro: "From a single feature wall to a full commercial repaint, Quottr breaks down prep, paint and labour so customers see exactly what they're paying for.",
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
  },
];

export function getTradeBySlug(slug: string): Trade | undefined {
  return trades.find((t) => t.slug === slug);
}
