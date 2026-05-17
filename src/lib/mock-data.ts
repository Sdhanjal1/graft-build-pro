export type QuoteStatus = "pending" | "accepted" | "paid" | "overdue";
export type PaymentMethod = "card" | "bank" | "cash";
export type PaymentRequestType = "deposit" | "full" | "custom";
export type JobStatus = "scheduled" | "in_progress" | "complete";

export type ScheduledJob = {
  id: string;
  quote_id: string;
  /** ISO datetime, e.g. "2026-05-19T09:00:00.000Z" */
  starts_at: string;
  duration_minutes: number;
  status: JobStatus;
  /** Indexes of quote.line_items the tradesperson has loaded into the van */
  materials_checked: number[];
  /** ISO date for the 11-month-out annual service reminder, if set */
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
  /** Label used in the customer message: "deposit", "balance" or "amount" */
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
  /** Payment method offered to the client on the invoice */
  payment_method?: PaymentMethod;
  /** How the customer actually paid (set when marked paid) */
  paid_via?: PaymentMethod;
  /** Latest payment request generated for this quote */
  payment_request?: PaymentRequest;
};

export const mockProfile = {
  business_name: "Hendricks Plumbing & Heating",
  full_name: "Tom Hendricks",
  phone: "07700 900123",
  email: "tom@hendricksplumbing.co.uk",
  trade_type: "Plumber / Heating Engineer",
  registration_number: "Gas Safe 558294",
  vat_number: "GB 384 7291 02",
  vat_registered: true,
  // Bank transfer details
  bank_account_name: "T Hendricks Plumbing Ltd",
  bank_name: "Lloyds Bank",
  sort_code: "30-92-14",
  account_number: "28475193",
  payment_reference_note: "Please use the quote reference (e.g. QTR-0142) as the payment reference.",
  // Stripe
  stripe_publishable_key: "",
  stripe_secret_key: "",
  stripe_connected: false,
  payment_terms: "Payment due within 14 days of invoice date.",
};

export const mockClients: Client[] = [
  { id: "c1", name: "Sarah Mitchell", phone: "07712 345678", email: "sarah.m@gmail.com", address: "14 Elm Grove, London SW19 4DH", property_type: "Victorian terrace", notes: "Side gate code 4421. Dog in kitchen.", created_at: "2026-04-12" },
  { id: "c2", name: "James O'Connor", phone: "07801 234567", email: "j.oconnor@outlook.com", address: "27 Park Road, Richmond TW10 6NS", property_type: "Semi-detached", created_at: "2026-03-28" },
  { id: "c3", name: "Priya Shah", phone: "07956 112233", email: "priya@shahfamily.co.uk", address: "8 Linden Court, Kingston KT2 7QA", property_type: "Modern flat", notes: "Concierge access. Prefers WhatsApp.", created_at: "2026-02-14" },
  { id: "c4", name: "Marcus Bell", phone: "07444 887766", email: "marcus.bell@bellco.uk", address: "Bell & Co Offices, 102 High St, Wimbledon", property_type: "Commercial", created_at: "2026-01-30" },
];

export const mockQuotes: Quote[] = [
  { id: "q1", ref: "QTR-0142", client_id: "c1", title: "Combi boiler installation", job_description: "Replace ageing Worcester 28i with new Worcester Greenstar 30Si. Includes magnetic filter, flush and 10yr warranty.",
    line_items: [
      { description: "Worcester Greenstar 30Si combi boiler", qty: 1, unit_price: 1480 },
      { description: "Magnetic system filter", qty: 1, unit_price: 145 },
      { description: "System power flush", qty: 1, unit_price: 380 },
      { description: "Labour — 2 engineers, 1.5 days", qty: 3, unit_price: 245 },
      { description: "Sundries & fittings", qty: 1, unit_price: 95 },
    ],
    subtotal: 2835, vat_amount: 567, total: 3402, status: "pending", due_date: "2026-05-30", created_at: "2026-05-12", payment_method: "card" },
  { id: "q2", ref: "QTR-0141", client_id: "c2", title: "Bathroom full refit", job_description: "Strip out and full refit of family bathroom. Walk-in shower, vanity unit, heated towel rail, tiled walls and floor.",
    line_items: [
      { description: "Strip out and disposal", qty: 1, unit_price: 420 },
      { description: "First fix plumbing", qty: 1, unit_price: 680 },
      { description: "Suite (vanity, WC, basin, shower)", qty: 1, unit_price: 2150 },
      { description: "Tiling — walls & floor", qty: 1, unit_price: 1840 },
      { description: "Labour — 6 days", qty: 6, unit_price: 485 },
    ],
    subtotal: 8000, vat_amount: 1600, total: 9600, status: "accepted", due_date: "2026-06-14", created_at: "2026-05-08", payment_method: "bank" },
  { id: "q3", ref: "QTR-0140", client_id: "c3", title: "Radiator replacement x3", job_description: "Replace three radiators in living room, hallway and bedroom with vertical designer rads.",
    line_items: [
      { description: "Designer vertical radiator (1800mm)", qty: 3, unit_price: 340 },
      { description: "TRVs and lockshields", qty: 3, unit_price: 38 },
      { description: "Labour — 1 day", qty: 1, unit_price: 485 },
    ],
    subtotal: 1619, vat_amount: 323.8, total: 1942.8, status: "paid", due_date: "2026-04-30", created_at: "2026-04-02", payment_method: "card", paid_via: "card" },
  { id: "q4", ref: "QTR-0139", client_id: "c4", title: "Office washroom service", job_description: "Annual service of 4 commercial WCs, 2 urinals and main feed. Replace dosing unit.",
    line_items: [
      { description: "Annual service visit", qty: 1, unit_price: 380 },
      { description: "Urinal dosing unit", qty: 1, unit_price: 215 },
      { description: "Cistern parts & sundries", qty: 1, unit_price: 88 },
    ],
    subtotal: 683, vat_amount: 136.6, total: 819.6, status: "overdue", due_date: "2026-04-20", created_at: "2026-03-30", payment_method: "bank" },
  { id: "q5", ref: "QTR-0138", client_id: "c1", title: "Leaking kitchen tap", job_description: "Replace mixer cartridge, check stop cocks.",
    line_items: [
      { description: "Mixer cartridge", qty: 1, unit_price: 42 },
      { description: "Call out & labour (1hr)", qty: 1, unit_price: 95 },
    ],
    subtotal: 137, vat_amount: 27.4, total: 164.4, status: "paid", due_date: "2026-04-10", created_at: "2026-03-25", payment_method: "cash", paid_via: "cash" },
];

export const TRADE_TYPES = [
  "Plumber / Heating Engineer", "Electrician", "Builder / General Contractor",
  "Carpenter / Joiner", "Roofer", "Decorator", "Tiler",
];

export const getClient = (id: string) => mockClients.find((c) => c.id === id);
export const getQuote = (id: string) => mockQuotes.find((q) => q.id === id);
export const quotesForClient = (id: string) => mockQuotes.filter((q) => q.client_id === id);

/** Mock Stripe payment link — replace with a real Stripe Checkout Session once API keys are added. */
export const stripePaymentLink = (quote: Quote, amount?: number) => {
  const slug = quote.ref.toLowerCase().replace(/[^a-z0-9]/g, "");
  const amt = (amount ?? quote.total).toFixed(2).replace(".", "");
  return `https://buy.stripe.com/test_${slug}_${amt}`;
};

/** Mock transaction log — in production this is fed by the Stripe webhook. */
export type Transaction = {
  id: string;
  quote_ref: string;
  client_name: string;
  method: PaymentMethod;
  amount: number;
  date: string;
};

export const mockTransactions: Transaction[] = [
  { id: "t1", quote_ref: "QTR-0140", client_name: "Priya Shah",   method: "card", amount: 1942.8, date: "2026-05-09" },
  { id: "t2", quote_ref: "QTR-0138", client_name: "Sarah Mitchell", method: "cash", amount: 164.4,  date: "2026-04-28" },
  { id: "t3", quote_ref: "QTR-0137", client_name: "James O'Connor", method: "card", amount: 480.0,  date: "2026-04-22" },
  { id: "t4", quote_ref: "QTR-0136", client_name: "Marcus Bell",    method: "bank", amount: 720.0,  date: "2026-04-15" },
];

/** Build a payment request (deposit / full / custom). Returns the link + label. */
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

/** WhatsApp / email message for a Stripe payment request. */
export const buildPaymentRequestMessage = (
  quote: Quote,
  pr: PaymentRequest,
  clientFirstName: string,
) => {
  return [
    `Hi ${clientFirstName}, please find your invoice from Quottr attached.`,
    "",
    `To pay your ${pr.label} of ${formatGBP(pr.amount)} securely by card tap here:`,
    pr.link,
    "",
    `Payment terms: ${mockProfile.payment_terms}`,
    "",
    `Thank you — ${mockProfile.business_name}`,
    "",
    "Sent via Quottr.",
  ].join("\n");
};

/** Build the body for an outbound quote/invoice message (WhatsApp / email). */
export const buildInvoiceMessage = (quote: Quote, clientFirstName: string) => {
  // If a Stripe payment request exists, prefer the dedicated request copy.
  if (quote.payment_method === "card" && quote.payment_request) {
    return buildPaymentRequestMessage(quote, quote.payment_request, clientFirstName);
  }
  const lines: string[] = [
    `Hi ${clientFirstName}, here's your invoice ${quote.ref} for "${quote.title}" — total ${formatGBP(quote.total)}.`,
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
    `Thanks, ${mockProfile.full_name} (${mockProfile.business_name}).`,
    "",
    "Sent via Quottr.",
  );
  return lines.join("\n");
};

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
  const byMethod = (m: PaymentMethod) =>
    paidQuotes.filter((q) => q.paid_via === m).reduce((s, q) => s + q.total, 0);
  // "This month" — current calendar month (or fall back to most recent for mock data)
  const now = new Date();
  const collectedThisMonth = mockTransactions
    .filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, t) => s + t.amount, 0)
    || mockTransactions.reduce((s, t) => s + t.amount, 0); // fallback so mock data shows
  return {
    totalQuoted,
    clientCount: mockClients.length,
    quoteCount: mockQuotes.length,
    overdueCount: overdue.length,
    overdueAmount,
    paid, pending, accepted, outstanding,
    paidByCard: byMethod("card"),
    paidByBank: byMethod("bank"),
    paidByCash: byMethod("cash"),
    avgQuote: totalQuoted / mockQuotes.length,
    collectedThisMonth,
  };
};

export const formatGBP = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: n < 1000 ? 2 : 0 }).format(n);
