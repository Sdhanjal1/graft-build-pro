export type QuoteStatus = "pending" | "accepted" | "paid" | "overdue";
export type PaymentMethod = "card" | "bank" | "cash";
export type PaymentRequestType = "deposit" | "full" | "custom";
export type JobStatus = "scheduled" | "in_progress" | "complete";

export type ScheduledJob = {
  id: string;
  quote_id: string;
  starts_at: string;
  duration_minutes: number;
  status: JobStatus;
  materials_checked: number[];
  annual_reminder_at?: string;
  notes?: string;
  created_at: string;
};

export type LineItem = {
  description: string;
  qty: number;
  unit_price: number;
};

export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  property_type: string;
  notes?: string;
  created_at: string;
};

export type PaymentRequest = {
  id: string;
  quote_id: string;
  type: PaymentRequestType;
  label: string;
  amount: number;
  link: string;
  status: "open" | "paid";
  created_at: string;
};

export type Quote = {
  id: string;
  ref: string;
  client_id: string;
  title: string;
  job_description: string;
  line_items: LineItem[];
  subtotal: number;
  vat_amount: number;
  total: number;
  status: QuoteStatus;
  due_date?: string;
  notes?: string;
  created_at: string;
  payment_method?: PaymentMethod;
  paid_via?: PaymentMethod;
  payment_request?: PaymentRequest;
  /** Set once a formal INVOICE has been issued (separate from quote) */
  invoiced_at?: string;
  /** ISO date the customer is asked to pay by on the invoice */
  invoice_due_date?: string;
};

export type ChaseStatus = "scheduled" | "sent" | "skipped";

export type ScheduledChase = {
  id: string;
  quote_id: string;
  /** 7 / 14 / 21 — days after due date */
  day_offset: number;
  due_at: string; // ISO
  status: ChaseStatus;
};

export const mockProfile = {
  business_name: "Cosy Plumbing & Heating",
  full_name: "Nav Dhanjal",
  phone: "07700 900456",
  email: "nav@cosyplumbing.co.uk",
  town: "",
  trade_type: "Plumber / Heating Engineer",
  registration_number: "Gas Safe 543219",
  vat_number: "GB 234 5678 90",
  vat_registered: true,
  bank_account_name: "Cosy Plumbing & Heating",
  bank_name: "Lloyds Bank",
  sort_code: "12-34-56",
  account_number: "12345678",
  payment_reference_note: "Please use the quote reference (e.g. QTR-006) as the payment reference.",
  stripe_publishable_key: "",
  stripe_secret_key: "",
  stripe_connected: false,
  payment_terms: "Payment due within 14 days of invoice date.",
  /** Card processing fee shown on card payment summaries */
  card_fee_pct: 3.5,
};

export const mockClients: Client[] = [
  { id: "c1", name: "James Thornton",  phone: "07712 345678", email: "james.thornton@gmail.com",   address: "42 Birchwood Avenue, Manchester M14 5QR", property_type: "Homeowner — Victorian terrace",   notes: "Annual boiler service every November.", created_at: "2025-11-04" },
  { id: "c2", name: "Sarah Mitchell",  phone: "07801 234567", email: "sarah.mitchell@hotmail.com", address: "8 Elm Grove, Stockport SK4 2AB",         property_type: "Homeowner — semi-detached",       notes: "Prefers morning appointments.",          created_at: "2025-09-22" },
  { id: "c3", name: "Robert Okafor",   phone: "07956 112233", email: "r.okafor@gmail.com",         address: "15 Chestnut Road, Salford M6 7TY",       property_type: "Homeowner — 1930s semi",          created_at: "2026-01-12" },
  { id: "c4", name: "Linda Patterson", phone: "07444 887766", email: "linda.p@yahoo.co.uk",        address: "3 Maple Close, Didsbury M20 2NP",        property_type: "Landlord — owns 3 properties",    notes: "Needs landlord Gas Safe certificates for all properties.", created_at: "2025-08-03" },
  { id: "c5", name: "David Chen",      phone: "07523 998877", email: "dchen@chenenterprises.co.uk", address: "102 High Street, Manchester M1 4AB",    property_type: "Commercial — small business",     notes: "Invoice via accounts: accounts@chenenterprises.co.uk", created_at: "2025-10-18" },
  { id: "c6", name: "Karen Walsh",     phone: "07689 334455", email: "k.walsh@outlook.com",        address: "27 Oak Lane, Cheadle SK8 1QR",           property_type: "Homeowner — detached",            created_at: "2026-02-28" },
];

// --- Quote builder helper (keeps VAT maths consistent) ----------------------
const VAT_RATE = 0.20;
const makeQuote = (
  q: Omit<Quote, "subtotal" | "vat_amount" | "total"> & { vat?: boolean },
): Quote => {
  const subtotal = +q.line_items.reduce((s, li) => s + li.qty * li.unit_price, 0).toFixed(2);
  const vat = q.vat === false ? 0 : +(subtotal * VAT_RATE).toFixed(2);
  const total = +(subtotal + vat).toFixed(2);
  // Drop the helper-only `vat` field
  const { vat: _vat, ...rest } = q;
  return { ...rest, subtotal, vat_amount: vat, total };
};

export const mockQuotes: Quote[] = [
  // --- PAID -----------------------------------------------------------------
  makeQuote({
    id: "q1", ref: "QTR-001", client_id: "c1",
    title: "Annual boiler service & safety check",
    job_description: "Annual service and safety check on Worcester Greenstar 30i combi. Includes flue gas analysis, pressure check, condensate trap clean and Gas Safe certificate.",
    line_items: [
      { description: "Annual boiler service — combi", qty: 1, unit_price: 95 },
      { description: "Gas Safe landlord/homeowner certificate", qty: 1, unit_price: 55 },
    ],
    status: "paid", due_date: "2025-11-25", created_at: "2025-11-11",
    payment_method: "bank", paid_via: "bank", vat: false, // gas service below VAT threshold simple line
  }),
  makeQuote({
    id: "q2", ref: "QTR-002", client_id: "c2",
    title: "Pressure relief valve replacement",
    job_description: "Diagnose and replace faulty pressure relief valve on system boiler. Re-pressurise heating circuit and bleed all rads.",
    line_items: [
      { description: "PRV — 3 bar replacement valve", qty: 1, unit_price: 38 },
      { description: "Labour — diagnose, replace, re-pressurise (1.5hr)", qty: 1.5, unit_price: 95 },
      { description: "Inhibitor top-up & sundries", qty: 1, unit_price: 25 },
    ],
    status: "paid", due_date: "2026-02-08", created_at: "2026-01-25",
    payment_method: "card", paid_via: "card", vat: false,
  }),
  makeQuote({
    id: "q3", ref: "QTR-003", client_id: "c3",
    title: "Honeywell T6 wireless thermostat — supply & fit",
    job_description: "Supply and fit Honeywell Home T6R wireless smart thermostat. Decommission existing wired stat, pair with boiler receiver, configure schedule.",
    line_items: [
      { description: "Honeywell Home T6R wireless thermostat kit", qty: 1, unit_price: 195 },
      { description: "Installation, wiring & commissioning", qty: 1, unit_price: 125 },
    ],
    status: "paid", due_date: "2026-03-18", created_at: "2026-03-04",
    payment_method: "card", paid_via: "card", vat: false,
  }),
  makeQuote({
    id: "q4", ref: "QTR-004", client_id: "c4",
    title: "Landlord gas safety certificates — 3 properties",
    job_description: "CP12 landlord gas safety inspections across all three rental properties. Boilers, hobs and gas fires checked. Reports issued to landlord and tenants.",
    line_items: [
      { description: "Landlord CP12 inspection — per property", qty: 3, unit_price: 75 },
      { description: "Travel & report admin", qty: 1, unit_price: 45 },
    ],
    status: "paid", due_date: "2026-04-20", created_at: "2026-04-06",
    payment_method: "bank", paid_via: "bank", vat: false,
  }),

  // --- ACCEPTED -------------------------------------------------------------
  makeQuote({
    id: "q5", ref: "QTR-005", client_id: "c5",
    title: "Commercial washroom service",
    job_description: "Repair 3 leaking mixer taps on washbasins, replace dual-flush toilet cistern with concealed isolation valve. Out-of-hours visit.",
    line_items: [
      { description: "Bristan basin mixer cartridge", qty: 3, unit_price: 28 },
      { description: "Geberit dual-flush cistern (concealed)", qty: 1, unit_price: 215 },
      { description: "Isolation valves & sundries", qty: 1, unit_price: 32 },
      { description: "Labour — 4hr on-site (out of hours)", qty: 4, unit_price: 65 },
    ],
    status: "accepted", due_date: "2026-05-28", created_at: "2026-05-09",
    payment_method: "bank", vat: true,
  }),
  makeQuote({
    id: "q6", ref: "QTR-006", client_id: "c1",
    title: "Worcester Bosch 30i combi boiler — supply & fit",
    job_description: "Remove existing 18yr-old Potterton system boiler. Supply and fit Worcester Bosch Greenstar 30i combi with 10-year warranty. Magnetic system filter, full power flush, new flue and condensate run. Gas Safe certificate and benchmark logbook included.",
    line_items: [
      { description: "Worcester Bosch Greenstar 30i combi boiler", qty: 1, unit_price: 1395 },
      { description: "Magnaclean Pro2 magnetic filter", qty: 1, unit_price: 145 },
      { description: "Full system power flush", qty: 1, unit_price: 395 },
      { description: "Flue kit, condensate & gas works", qty: 1, unit_price: 185 },
      { description: "Labour — 2 days, lead engineer + mate", qty: 2, unit_price: 540 },
      { description: "Gas Safe registration & benchmark", qty: 1, unit_price: 35 },
    ],
    status: "accepted", due_date: "2026-05-30", created_at: "2026-05-10",
    payment_method: "card", vat: true,
  }),

  // --- PENDING --------------------------------------------------------------
  makeQuote({
    id: "q7", ref: "QTR-007", client_id: "c6",
    title: "Full bathroom suite — supply & fit",
    job_description: "Strip out existing bathroom. Supply and fit new freestanding bath, vanity basin unit, close-coupled WC, 900mm walk-in shower with thermostatic valve. New tiling to walls and floor. 2-day fit by lead engineer plus mate.",
    line_items: [
      { description: "Bath, basin, WC, shower suite (mid-range)", qty: 1, unit_price: 1850 },
      { description: "Thermostatic shower valve & 900mm enclosure", qty: 1, unit_price: 485 },
      { description: "Wall & floor tiles + adhesive/grout", qty: 1, unit_price: 620 },
      { description: "Strip out, dispose & first-fix plumbing", qty: 1, unit_price: 420 },
      { description: "Labour — 2 days (lead + mate)", qty: 2, unit_price: 540 },
      { description: "Sundries, sealant, isolators", qty: 1, unit_price: 105 },
    ],
    status: "pending", due_date: "2026-06-05", created_at: "2026-05-14",
    payment_method: "bank", vat: true,
  }),
  makeQuote({
    id: "q8", ref: "QTR-008", client_id: "c2",
    title: "Radiator replacement x2 + new TRVs throughout",
    job_description: "Replace 2x failing single-panel radiators with new double-panel convector rads in living room and bedroom. Fit Drayton TRV4 thermostatic valves to all 7 rads in the property. Drain, flush and refill system with inhibitor.",
    line_items: [
      { description: "Double-panel convector rad 1200x600 (white)", qty: 2, unit_price: 145 },
      { description: "Drayton TRV4 thermostatic radiator valve", qty: 7, unit_price: 24 },
      { description: "System drain, flush & inhibitor", qty: 1, unit_price: 95 },
      { description: "Labour — 1 day", qty: 1, unit_price: 215 },
    ],
    status: "pending", due_date: "2026-06-02", created_at: "2026-05-15",
    payment_method: "bank", vat: false,
  }),

  // --- OVERDUE --------------------------------------------------------------
  makeQuote({
    id: "q9", ref: "QTR-009", client_id: "c4",
    title: "Emergency call out — burst pipe repair",
    job_description: "Out-of-hours emergency call out to tenant property at 14 Maple Street. Isolated mains, cut out failed 22mm copper section under sink, fitted new push-fit replacement, dried floor and confirmed no further leaks.",
    line_items: [
      { description: "Emergency out-of-hours call out", qty: 1, unit_price: 145 },
      { description: "22mm push-fit fittings & 1m copper", qty: 1, unit_price: 38 },
      { description: "Labour on site (2hr)", qty: 2, unit_price: 68 },
    ],
    status: "overdue", due_date: "2026-05-03", created_at: "2026-04-19",
    payment_method: "bank", vat: false,
  }),
  makeQuote({
    id: "q10", ref: "QTR-010", client_id: "c3",
    title: "Underfloor heating installation — kitchen",
    job_description: "Supply and install warm-water underfloor heating loops in 18m² kitchen extension. New manifold, wiring centre and room stat. Connection to existing combi via blending valve. Excludes screed and floor finish.",
    line_items: [
      { description: "UFH manifold (4-port) + pump & blending valve", qty: 1, unit_price: 385 },
      { description: "UFH pipe (PE-RT 16mm) — 120m", qty: 1, unit_price: 165 },
      { description: "Wiring centre + room thermostat", qty: 1, unit_price: 145 },
      { description: "Labour — 2 days fit & commission", qty: 2, unit_price: 540 },
    ],
    status: "overdue", due_date: "2026-05-08", created_at: "2026-04-24",
    payment_method: "bank", vat: true,
  }),
];

export const TRADE_TYPES = [
  "Plumber / Heating Engineer", "Electrician", "Builder / General Contractor",
  "Carpenter / Joiner", "Roofer", "Decorator", "Tiler",
];

export const getClient = (id: string) => mockClients.find((c) => c.id === id);
export const getQuote = (id: string) => mockQuotes.find((q) => q.id === id);
export const quotesForClient = (id: string) => mockQuotes.filter((q) => q.client_id === id);

/** Mock Stripe payment link */
export const stripePaymentLink = (quote: Quote, amount?: number) => {
  const slug = quote.ref.toLowerCase().replace(/[^a-z0-9]/g, "");
  const amt = (amount ?? quote.total).toFixed(2).replace(".", "");
  return `https://buy.stripe.com/test_${slug}_${amt}`;
};

export type Transaction = {
  id: string;
  quote_ref: string;
  client_name: string;
  method: PaymentMethod;
  amount: number;
  date: string;
};

// Mix of "this month" payments from the paid quotes + a handful of historical
// jobs so the profit tracker breakdown reflects six months of trading.
export const mockTransactions: Transaction[] = [
  // This-month / recent
  { id: "t1", quote_ref: "QTR-001", client_name: "James Thornton",  method: "bank", amount: 180,  date: "2025-11-24" },
  { id: "t2", quote_ref: "QTR-002", client_name: "Sarah Mitchell",  method: "card", amount: 245,  date: "2026-02-06" },
  { id: "t3", quote_ref: "QTR-003", client_name: "Robert Okafor",   method: "card", amount: 320,  date: "2026-03-16" },
  { id: "t4", quote_ref: "QTR-004", client_name: "Linda Patterson", method: "bank", amount: 270,  date: "2026-04-18" },
  // Historical jobs (not in current quote list, kept for tracker realism)
  { id: "t5",  quote_ref: "QTR-H12", client_name: "Sarah Mitchell",  method: "cash", amount: 240,  date: "2026-05-02" },
  { id: "t6",  quote_ref: "QTR-H11", client_name: "Karen Walsh",     method: "card", amount: 1280, date: "2026-05-05" },
  { id: "t7",  quote_ref: "QTR-H10", client_name: "James Thornton",  method: "bank", amount: 1640, date: "2026-04-29" },
  { id: "t8",  quote_ref: "QTR-H09", client_name: "Linda Patterson", method: "bank", amount: 1600, date: "2026-04-15" },
  { id: "t9",  quote_ref: "QTR-H08", client_name: "Robert Okafor",   method: "card", amount: 1355, date: "2026-04-10" },
  { id: "t10", quote_ref: "QTR-H07", client_name: "David Chen",      method: "cash", amount: 960,  date: "2026-03-28" },
];

/** Build a payment request (deposit / full / custom). */
export const buildPaymentRequest = (
  quote: Quote,
  type: PaymentRequestType,
  customAmount?: number,
): PaymentRequest => {
  const amount =
    type === "deposit" ? +(quote.total * 0.5).toFixed(2)
    : type === "full" ? quote.total
    : Math.max(0, +(customAmount ?? 0).toFixed(2));
  const label = type === "deposit" ? "deposit" : type === "full" ? "balance" : "amount";
  return {
    id: `pr_${Date.now()}`,
    quote_id: quote.id,
    type,
    label,
    amount,
    link: stripePaymentLink(quote, amount),
    status: "open",
    created_at: new Date().toISOString(),
  };
};

export const buildPaymentRequestMessage = (
  quote: Quote,
  pr: PaymentRequest,
  clientFirstName: string,
) => {
  return [
    `Hi ${clientFirstName}, please find your invoice ${quote.ref} from ${mockProfile.business_name}.`,
    "",
    `To pay your ${pr.label} of ${formatGBP(pr.amount)} securely by card tap here:`,
    pr.link,
    "",
    `Payment terms: ${mockProfile.payment_terms}`,
    "",
    `Thanks, ${mockProfile.full_name.split(" ")[0]} — ${mockProfile.business_name}`,
    "",
    "Sent via Quottr.",
  ].join("\n");
};

export const buildInvoiceMessage = (quote: Quote, clientFirstName: string) => {
  if (quote.payment_method === "card" && quote.payment_request) {
    return buildPaymentRequestMessage(quote, quote.payment_request, clientFirstName);
  }
  const lines: string[] = [
    `Hi ${clientFirstName}, here's your invoice ${quote.ref} from ${mockProfile.business_name} for "${quote.title}" — total ${formatGBP(quote.total)}.`,
    "",
  ];
  if (quote.payment_method === "card") {
    lines.push(`Pay by card: ${stripePaymentLink(quote)}`);
  } else if (quote.payment_method === "bank") {
    lines.push(
      "Pay by bank transfer:",
      `  Account name: ${mockProfile.bank_account_name}`,
      `  Bank: ${mockProfile.bank_name}`,
      `  Sort code: ${mockProfile.sort_code}`,
      `  Account number: ${mockProfile.account_number}`,
      `  Reference: ${quote.ref}`,
    );
  } else if (quote.payment_method === "cash") {
    lines.push("Payment method: Cash on completion — please have cash ready on the day.");
  }
  lines.push(
    "",
    `Payment terms: ${mockProfile.payment_terms}`,
    "",
    `Thanks, ${mockProfile.full_name.split(" ")[0]} — ${mockProfile.business_name}`,
    "",
    "Sent via Quottr.",
  );
  return lines.join("\n");
};

/** Standard chaser copy used by /chaser */
export const buildChaserMessage = (quote: Quote, clientFirstName: string) =>
  [
    `Hi ${clientFirstName}, I hope you're well. Just following up on invoice ${quote.ref} from ${mockProfile.business_name} for ${formatGBP(quote.total)}.`,
    "Could you let me know when payment will be made?",
    `Many thanks, ${mockProfile.full_name.split(" ")[0]}`,
    "",
    "Sent via Quottr.",
  ].join("\n");

export const stats = () => {
  const totalQuoted = mockQuotes.reduce((s, q) => s + q.total, 0);
  const overdue = mockQuotes.filter((q) => q.status === "overdue");
  const overdueAmount = overdue.reduce((s, q) => s + q.total, 0);
  const paidQuotes = mockQuotes.filter((q) => q.status === "paid");
  const paid = paidQuotes.reduce((s, q) => s + q.total, 0);
  const pending = mockQuotes.filter((q) => q.status === "pending").reduce((s, q) => s + q.total, 0);
  const accepted = mockQuotes.filter((q) => q.status === "accepted").reduce((s, q) => s + q.total, 0);
  const outstanding = mockQuotes
    .filter((q) => q.status === "accepted" || q.status === "overdue" || q.status === "pending")
    .reduce((s, q) => s + q.total, 0);
  // Profit tracker totals — derived from the transactions log so card/bank/cash split
  // reflects the full trading history, not just the current quote list.
  const txByMethod = (m: PaymentMethod) =>
    mockTransactions.filter((t) => t.method === m).reduce((s, t) => s + t.amount, 0);
  const collectedAll = mockTransactions.reduce((s, t) => s + t.amount, 0);
  const now = new Date();
  const collectedThisMonth = mockTransactions
    .filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, t) => s + t.amount, 0) || collectedAll;
  // Top 5 jobs by total value (excluding voided/draft etc)
  const topJobs = [...mockQuotes].sort((a, b) => b.total - a.total).slice(0, 5);
  const bestJob = topJobs[0];
  return {
    totalQuoted,
    clientCount: mockClients.length,
    quoteCount: mockQuotes.length,
    overdueCount: overdue.length,
    overdueAmount,
    paid, pending, accepted, outstanding,
    paidByCard: txByMethod("card"),
    paidByBank: txByMethod("bank"),
    paidByCash: txByMethod("cash"),
    collectedAll,
    avgQuote: totalQuoted / mockQuotes.length,
    collectedThisMonth,
    topJobs,
    bestJob,
  };
};

export const formatGBP = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: n < 1000 ? 2 : 0 }).format(n);

// ---------- Scheduled jobs (calendar) ----------

const _today = new Date();
// Find Monday of the current week (so the seeded jobs always land on this week's Mon–Fri)
const _monday = (() => {
  const d = new Date(_today); d.setHours(0, 0, 0, 0);
  const offset = (d.getDay() + 6) % 7; // Sun=6, Mon=0
  d.setDate(d.getDate() - offset);
  return d;
})();
const _weekday = (dayOffset: number, hour: number, minute = 0) => {
  const d = new Date(_monday);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

export const mockJobs: ScheduledJob[] = [
  // Monday — James Thornton boiler install (in progress today)
  { id: "j1", quote_id: "q6", starts_at: _weekday(0, 8, 0),  duration_minutes: 540, status: "in_progress", materials_checked: [0, 1, 2], created_at: _weekday(-3, 12) },
  // Tuesday — David Chen commercial washroom
  { id: "j2", quote_id: "q5", starts_at: _weekday(1, 9, 0),  duration_minutes: 240, status: "scheduled",   materials_checked: [], created_at: _weekday(-2, 9) },
  // Wednesday — Karen Walsh bathroom day 1
  { id: "j3", quote_id: "q7", starts_at: _weekday(2, 8, 0),  duration_minutes: 540, status: "scheduled",   materials_checked: [], notes: "Day 1 of 2 — strip out & first fix", created_at: _weekday(-2, 11) },
  // Thursday — Karen Walsh bathroom day 2
  { id: "j4", quote_id: "q7", starts_at: _weekday(3, 8, 0),  duration_minutes: 540, status: "scheduled",   materials_checked: [], notes: "Day 2 of 2 — second fix, tile & commission", created_at: _weekday(-2, 11) },
  // Friday — Sarah Mitchell radiator replacement
  { id: "j5", quote_id: "q8", starts_at: _weekday(4, 10, 0), duration_minutes: 360, status: "scheduled",   materials_checked: [], created_at: _weekday(-1, 16) },
];

export const getJob = (id: string) => mockJobs.find((j) => j.id === id);
export const getJobByQuote = (quoteId: string) =>
  mockJobs.find((j) => j.quote_id === quoteId);

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const jobsForDay = (day: Date) =>
  mockJobs
    .filter((j) => sameDay(new Date(j.starts_at), day))
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));

export const jobsForRange = (from: Date, to: Date) =>
  mockJobs
    .filter((j) => {
      const d = new Date(j.starts_at);
      return d >= from && d <= to;
    })
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));

export const scheduleJob = (
  quoteId: string,
  startsAt: string,
  durationMinutes = 240,
): ScheduledJob => {
  const existing = getJobByQuote(quoteId);
  if (existing) {
    existing.starts_at = startsAt;
    existing.duration_minutes = durationMinutes;
    existing.status = "scheduled";
    return existing;
  }
  const job: ScheduledJob = {
    id: `j_${Date.now()}`,
    quote_id: quoteId,
    starts_at: startsAt,
    duration_minutes: durationMinutes,
    status: "scheduled",
    materials_checked: [],
    created_at: new Date().toISOString(),
  };
  mockJobs.push(job);
  const q = getQuote(quoteId);
  if (q && q.status === "pending") q.status = "accepted";
  return job;
};

export const setJobStatus = (jobId: string, status: JobStatus) => {
  const j = getJob(jobId);
  if (j) j.status = status;
  return j;
};

export const toggleMaterial = (jobId: string, idx: number) => {
  const j = getJob(jobId);
  if (!j) return;
  const i = j.materials_checked.indexOf(idx);
  if (i >= 0) j.materials_checked.splice(i, 1);
  else j.materials_checked.push(idx);
};

export const setAnnualReminder = (jobId: string, monthsFromNow = 11) => {
  const j = getJob(jobId);
  if (!j) return;
  const d = new Date();
  d.setMonth(d.getMonth() + monthsFromNow);
  j.annual_reminder_at = d.toISOString();
};

export const estimateTravelMinutes = (fromAddr?: string, toAddr?: string) => {
  if (!fromAddr || !toAddr) return null;
  const pc = (a: string) => (a.match(/[A-Z]{1,2}\d[A-Z0-9]?/i) ?? [""])[0].toUpperCase();
  const a = pc(fromAddr);
  const b = pc(toAddr);
  if (!a || !b) return null;
  if (a === b) return 10;
  if (a.replace(/\d.*/, "") === b.replace(/\d.*/, "")) return 20;
  return 35;
};

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
export const formatDayLabel = (d: Date) =>
  d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

// ---------- New quote ----------

/** Find existing client by name (case-insensitive) or create a new mock one. */
export const findOrCreateClient = (name: string, opts?: Partial<Client>): Client => {
  const trimmed = name.trim();
  if (!trimmed) {
    return mockClients[0];
  }
  const existing = mockClients.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;
  const c: Client = {
    id: `c_${Date.now()}`,
    name: trimmed,
    phone: opts?.phone ?? "",
    email: opts?.email ?? "",
    address: opts?.address ?? "",
    property_type: opts?.property_type ?? "Homeowner",
    notes: opts?.notes,
    created_at: new Date().toISOString().slice(0, 10),
  };
  mockClients.unshift(c);
  return c;
};

/** Compute next QTR reference (zero-padded 3 digits). */
export const nextQuoteRef = () => {
  const nums = mockQuotes
    .map((q) => Number(q.ref.replace(/[^0-9]/g, "")))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `QTR-${String(next).padStart(3, "0")}`;
};

// Quote generation is now handled by Claude AI via src/lib/ai-quote.functions.ts

/** Save a generated quote into the mock store and return it. */
export const saveGeneratedQuote = (input: {
  clientName: string;
  description: string;
  title: string;
  line_items: LineItem[];
  vatRegistered: boolean;
}): Quote => {
  const client = findOrCreateClient(input.clientName || "New client");
  const subtotal = +input.line_items.reduce((s, li) => s + li.qty * li.unit_price, 0).toFixed(2);
  const vat_amount = input.vatRegistered ? +(subtotal * VAT_RATE).toFixed(2) : 0;
  const total = +(subtotal + vat_amount).toFixed(2);
  const due = new Date(); due.setDate(due.getDate() + 14);
  const quote: Quote = {
    id: `q_${Date.now()}`,
    ref: nextQuoteRef(),
    client_id: client.id,
    title: input.title,
    job_description: input.description,
    line_items: input.line_items,
    subtotal,
    vat_amount,
    total,
    status: "pending",
    due_date: due.toISOString().slice(0, 10),
    created_at: new Date().toISOString().slice(0, 10),
    payment_method: "card",
  };
  mockQuotes.unshift(quote);
  return quote;
};

/** Card processing fee helper — used in the payment summary. */
export const calcCardFee = (amount: number) => {
  const pct = mockProfile.card_fee_pct;
  const fee = +(amount * (pct / 100)).toFixed(2);
  return { pct, fee, net: +(amount - fee).toFixed(2) };
};

// ---------- Quote duplication ----------

/** Duplicate a quote with a fresh QTR ref, today's date, status reset to pending. */
export const duplicateQuote = (quoteId: string): Quote | null => {
  const src = getQuote(quoteId);
  if (!src) return null;
  const today = new Date();
  const due = new Date(); due.setDate(due.getDate() + 14);
  const copy: Quote = {
    ...src,
    id: `q_${Date.now()}`,
    ref: nextQuoteRef(),
    status: "pending",
    created_at: today.toISOString().slice(0, 10),
    due_date: due.toISOString().slice(0, 10),
    line_items: src.line_items.map((li) => ({ ...li })),
    payment_request: undefined,
    paid_via: undefined,
    invoiced_at: undefined,
    invoice_due_date: undefined,
  };
  mockQuotes.unshift(copy);
  return copy;
};

// ---------- Auto-chase scheduler ----------

const CHASE_OFFSETS = [7, 14, 21];

export const mockChases: ScheduledChase[] = [];

/** Ensure day 7/14/21 chases exist for an overdue/accepted invoice. */
export const ensureChasesFor = (quote: Quote) => {
  if (!quote.due_date) return;
  const dueMs = new Date(quote.due_date).getTime();
  CHASE_OFFSETS.forEach((d) => {
    const exists = mockChases.find((c) => c.quote_id === quote.id && c.day_offset === d);
    if (exists) return;
    mockChases.push({
      id: `ch_${quote.id}_${d}`,
      quote_id: quote.id,
      day_offset: d,
      due_at: new Date(dueMs + d * 86400000).toISOString(),
      status: "scheduled",
    });
  });
};

/** Seed chases for every overdue quote on load. */
export const seedChases = () => {
  mockQuotes
    .filter((q) => q.status === "overdue")
    .forEach((q) => ensureChasesFor(q));
  // Mark past-due scheduled chases as still scheduled (the UI surfaces "due now").
};

seedChases();

export const chasesForQuote = (quoteId: string) =>
  mockChases
    .filter((c) => c.quote_id === quoteId)
    .sort((a, b) => a.day_offset - b.day_offset);

/** Chases due now (scheduled and past due_at) across all overdue invoices. */
export const chasesDueNow = () => {
  const now = Date.now();
  return mockChases
    .filter((c) => c.status === "scheduled" && new Date(c.due_at).getTime() <= now)
    .map((c) => ({ chase: c, quote: getQuote(c.quote_id) }))
    .filter((x): x is { chase: ScheduledChase; quote: Quote } => !!x.quote);
};

export const upcomingChases = () => {
  const now = Date.now();
  return mockChases
    .filter((c) => c.status === "scheduled" && new Date(c.due_at).getTime() > now)
    .sort((a, b) => +new Date(a.due_at) - +new Date(b.due_at))
    .map((c) => ({ chase: c, quote: getQuote(c.quote_id) }))
    .filter((x): x is { chase: ScheduledChase; quote: Quote } => !!x.quote);
};

export const markChaseSent = (chaseId: string) => {
  const c = mockChases.find((x) => x.id === chaseId);
  if (c) c.status = "sent";
};

export const skipChase = (chaseId: string) => {
  const c = mockChases.find((x) => x.id === chaseId);
  if (c) c.status = "skipped";
};

// ---------- Quote → invoice split ----------

/** Mark a quote as invoiced (issues a formal invoice). */
export const markInvoiced = (quoteId: string): Quote | null => {
  const q = getQuote(quoteId);
  if (!q) return null;
  const today = new Date();
  const due = new Date(); due.setDate(due.getDate() + 14);
  q.invoiced_at = today.toISOString();
  q.invoice_due_date = due.toISOString().slice(0, 10);
  // Promote to overdue tracking if not already paid; chase scheduler will pick up
  ensureChasesFor(q);
  return q;
};

export const invoiceRef = (q: Quote) => q.ref.replace(/^QTR/i, "INV");

export const buildFinalInvoiceMessage = (quote: Quote, clientFirstName: string) => {
  const ref = invoiceRef(quote);
  const due = quote.invoice_due_date ?? "";
  const lines = [
    `Hi ${clientFirstName}, please find your INVOICE ${ref} from ${mockProfile.business_name}.`,
    "",
    `Job: ${quote.title}`,
    `Amount due: ${formatGBP(quote.total)}`,
    due ? `Payment due by: ${new Date(due).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : "",
    "",
  ];
  if (quote.payment_method === "card" && quote.payment_request) {
    lines.push(`Pay by card (tap to pay): ${quote.payment_request.link}`);
  } else if (quote.payment_method === "card") {
    lines.push(`Pay by card (tap to pay): ${stripePaymentLink(quote)}`);
  }
  lines.push(
    `Or by bank transfer:`,
    `  ${mockProfile.bank_account_name}`,
    `  ${mockProfile.bank_name} · sort ${mockProfile.sort_code} · ${mockProfile.account_number}`,
    `  Reference: ${ref}`,
    "",
    `${mockProfile.payment_terms}`,
    "",
    `Thanks, ${mockProfile.full_name.split(" ")[0]} — ${mockProfile.business_name}`,
    "",
    "Sent via Quottr.",
  );
  return lines.filter(Boolean).join("\n");
};

// ---------- Deposit on acceptance ----------

/** Build the WhatsApp-ready deposit request message immediately after a quote is accepted. */
export const buildDepositOnAcceptMessage = (quote: Quote, clientFirstName: string) => {
  const amount = +(quote.total * 0.5).toFixed(2);
  const link = stripePaymentLink(quote, amount);
  const method = quote.payment_method ?? "card";
  const lines = [
    `Hi ${clientFirstName}, thanks for accepting your quote ${quote.ref} from ${mockProfile.business_name}!`,
    "",
    `To get you booked in, please pay a 50% deposit of ${formatGBP(amount)}.`,
    "",
  ];
  if (method === "card") {
    lines.push(`Pay by card here: ${link}`);
  } else if (method === "bank") {
    lines.push(
      "Bank transfer:",
      `  ${mockProfile.bank_account_name}`,
      `  ${mockProfile.bank_name} · sort ${mockProfile.sort_code} · ${mockProfile.account_number}`,
      `  Reference: ${quote.ref}`,
    );
  } else {
    lines.push("Cash deposit accepted — please drop off or pay on first visit.");
  }
  lines.push(
    "",
    `Once received I'll confirm your booking date. Any questions just shout.`,
    "",
    `Thanks, ${mockProfile.full_name.split(" ")[0]}`,
    "",
    "Sent via Quottr.",
  );
  return { amount, link, message: lines.join("\n") };
};

// ---------- Today / upcoming reminders / search ----------

export const todaysJobs = () => jobsForDay(new Date());

/** Annual reminders falling within the next 30 days. */
export const annualRemindersDue = (withinDays = 30) => {
  const now = Date.now();
  const cutoff = now + withinDays * 86400000;
  return mockJobs
    .filter((j) => j.annual_reminder_at)
    .map((j) => ({ job: j, quote: getQuote(j.quote_id) }))
    .filter((x): x is { job: ScheduledJob; quote: Quote } => !!x.quote)
    .map(({ job, quote }) => ({ job, quote, client: getClient(quote.client_id), due: new Date(job.annual_reminder_at!).getTime() }))
    .filter(({ due }) => due >= now && due <= cutoff)
    .sort((a, b) => a.due - b.due);
};

export const buildAnnualReminderMessage = (clientFirstName: string) => {
  return [
    `Hi ${clientFirstName}, it's ${mockProfile.full_name.split(" ")[0]} from ${mockProfile.business_name}.`,
    "",
    "Your annual boiler service is due next month. Would you like to book in?",
    "Just reply YES and I'll get you booked.",
    "",
    `Many thanks, ${mockProfile.full_name.split(" ")[0]}`,
    "",
    "Sent via Quottr.",
  ].join("\n");
};

export type SearchResult =
  | { kind: "client"; id: string; title: string; subtitle: string }
  | { kind: "quote"; id: string; title: string; subtitle: string }
  | { kind: "job"; id: string; title: string; subtitle: string; quoteId: string };

export const globalSearch = (query: string): SearchResult[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: SearchResult[] = [];
  mockClients.forEach((c) => {
    const blob = `${c.name} ${c.address} ${c.phone} ${c.email}`.toLowerCase();
    if (blob.includes(q)) results.push({ kind: "client", id: c.id, title: c.name, subtitle: c.address });
  });
  mockQuotes.forEach((qq) => {
    const blob = `${qq.ref} ${qq.title} ${qq.job_description} ${qq.total}`.toLowerCase();
    if (blob.includes(q)) {
      const cl = getClient(qq.client_id);
      results.push({ kind: "quote", id: qq.id, title: `${qq.ref} · ${qq.title}`, subtitle: `${cl?.name ?? ""} · ${formatGBP(qq.total)}` });
    }
  });
  mockJobs.forEach((j) => {
    const qq = getQuote(j.quote_id);
    if (!qq) return;
    const cl = getClient(qq.client_id);
    const blob = `${qq.title} ${cl?.name ?? ""} ${cl?.address ?? ""}`.toLowerCase();
    if (blob.includes(q)) {
      results.push({
        kind: "job", id: j.id, quoteId: qq.id,
        title: `${qq.title}`,
        subtitle: `${cl?.name ?? ""} · ${new Date(j.starts_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ${formatTime(j.starts_at)}`,
      });
    }
  });
  return results;
};

// Seed: give James Thornton an annual service reminder ~25 days out so the
// Upcoming reminders widget has real content on first load.
(() => {
  const jamesService = mockJobs.find((j) => j.quote_id === "q1");
  if (jamesService && !jamesService.annual_reminder_at) {
    const d = new Date(); d.setDate(d.getDate() + 25);
    jamesService.annual_reminder_at = d.toISOString();
  } else {
    // No q1 job seeded — synthesise one so the reminder shows.
    const q = getQuote("q1");
    if (q) {
      const d = new Date(); d.setDate(d.getDate() + 25);
      mockJobs.push({
        id: "j_seed_james",
        quote_id: "q1",
        starts_at: new Date(Date.now() - 86400000 * 200).toISOString(),
        duration_minutes: 90,
        status: "complete",
        materials_checked: [],
        annual_reminder_at: d.toISOString(),
        created_at: new Date(Date.now() - 86400000 * 200).toISOString(),
      });
    }
  }
  // Add a second reminder ~12 days out for Sarah Mitchell (q2)
  const sarah = mockJobs.find((j) => j.quote_id === "q2");
  if (!sarah) {
    const d = new Date(); d.setDate(d.getDate() + 12);
    const past = new Date(Date.now() - 86400000 * 100).toISOString();
    mockJobs.push({
      id: "j_seed_sarah",
      quote_id: "q2",
      starts_at: past,
      duration_minutes: 90,
      status: "complete",
      materials_checked: [],
      annual_reminder_at: d.toISOString(),
      created_at: past,
    });
  }
})();
