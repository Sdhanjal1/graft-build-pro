export type QuoteStatus = "pending" | "accepted" | "paid" | "overdue";

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
};

export const mockClients: Client[] = [
  {
    id: "c1",
    name: "Sarah Mitchell",
    phone: "07712 345678",
    email: "sarah.m@gmail.com",
    address: "14 Elm Grove, London SW19 4DH",
    property_type: "Victorian terrace",
    notes: "Side gate code 4421. Dog in kitchen.",
    created_at: "2026-04-12",
  },
  {
    id: "c2",
    name: "James O'Connor",
    phone: "07801 234567",
    email: "j.oconnor@outlook.com",
    address: "27 Park Road, Richmond TW10 6NS",
    property_type: "Semi-detached",
    created_at: "2026-03-28",
  },
  {
    id: "c3",
    name: "Priya Shah",
    phone: "07956 112233",
    email: "priya@shahfamily.co.uk",
    address: "8 Linden Court, Kingston KT2 7QA",
    property_type: "Modern flat",
    notes: "Concierge access. Prefers WhatsApp.",
    created_at: "2026-02-14",
  },
  {
    id: "c4",
    name: "Marcus Bell",
    phone: "07444 887766",
    email: "marcus.bell@bellco.uk",
    address: "Bell & Co Offices, 102 High St, Wimbledon",
    property_type: "Commercial",
    created_at: "2026-01-30",
  },
];

export const mockQuotes: Quote[] = [
  {
    id: "q1",
    ref: "GRF-0142",
    client_id: "c1",
    title: "Combi boiler installation",
    job_description: "Replace ageing Worcester 28i with new Worcester Greenstar 30Si. Includes magnetic filter, flush and 10yr warranty.",
    line_items: [
      { description: "Worcester Greenstar 30Si combi boiler", qty: 1, unit_price: 1480 },
      { description: "Magnetic system filter", qty: 1, unit_price: 145 },
      { description: "System power flush", qty: 1, unit_price: 380 },
      { description: "Labour — 2 engineers, 1.5 days", qty: 3, unit_price: 245 },
      { description: "Sundries & fittings", qty: 1, unit_price: 95 },
    ],
    subtotal: 2835,
    vat_amount: 567,
    total: 3402,
    status: "pending",
    due_date: "2026-05-30",
    created_at: "2026-05-12",
  },
  {
    id: "q2",
    ref: "GRF-0141",
    client_id: "c2",
    title: "Bathroom full refit",
    job_description: "Strip out and full refit of family bathroom. Walk-in shower, vanity unit, heated towel rail, tiled walls and floor.",
    line_items: [
      { description: "Strip out and disposal", qty: 1, unit_price: 420 },
      { description: "First fix plumbing", qty: 1, unit_price: 680 },
      { description: "Suite (vanity, WC, basin, shower)", qty: 1, unit_price: 2150 },
      { description: "Tiling — walls & floor", qty: 1, unit_price: 1840 },
      { description: "Labour — 6 days", qty: 6, unit_price: 485 },
    ],
    subtotal: 8000,
    vat_amount: 1600,
    total: 9600,
    status: "accepted",
    due_date: "2026-06-14",
    created_at: "2026-05-08",
  },
  {
    id: "q3",
    ref: "GRF-0140",
    client_id: "c3",
    title: "Radiator replacement x3",
    job_description: "Replace three radiators in living room, hallway and bedroom with vertical designer rads.",
    line_items: [
      { description: "Designer vertical radiator (1800mm)", qty: 3, unit_price: 340 },
      { description: "TRVs and lockshields", qty: 3, unit_price: 38 },
      { description: "Labour — 1 day", qty: 1, unit_price: 485 },
    ],
    subtotal: 1619,
    vat_amount: 323.8,
    total: 1942.8,
    status: "paid",
    due_date: "2026-04-30",
    created_at: "2026-04-02",
  },
  {
    id: "q4",
    ref: "GRF-0139",
    client_id: "c4",
    title: "Office washroom service",
    job_description: "Annual service of 4 commercial WCs, 2 urinals and main feed. Replace dosing unit.",
    line_items: [
      { description: "Annual service visit", qty: 1, unit_price: 380 },
      { description: "Urinal dosing unit", qty: 1, unit_price: 215 },
      { description: "Cistern parts & sundries", qty: 1, unit_price: 88 },
    ],
    subtotal: 683,
    vat_amount: 136.6,
    total: 819.6,
    status: "overdue",
    due_date: "2026-04-20",
    created_at: "2026-03-30",
  },
  {
    id: "q5",
    ref: "GRF-0138",
    client_id: "c1",
    title: "Leaking kitchen tap",
    job_description: "Replace mixer cartridge, check stop cocks.",
    line_items: [
      { description: "Mixer cartridge", qty: 1, unit_price: 42 },
      { description: "Call out & labour (1hr)", qty: 1, unit_price: 95 },
    ],
    subtotal: 137,
    vat_amount: 27.4,
    total: 164.4,
    status: "overdue",
    due_date: "2026-04-10",
    created_at: "2026-03-25",
  },
];

export const TRADE_TYPES = [
  "Plumber / Heating Engineer",
  "Electrician",
  "Builder / General Contractor",
  "Carpenter / Joiner",
  "Roofer",
  "Decorator",
  "Tiler",
];

export const getClient = (id: string) => mockClients.find((c) => c.id === id);
export const getQuote = (id: string) => mockQuotes.find((q) => q.id === id);
export const quotesForClient = (id: string) => mockQuotes.filter((q) => q.client_id === id);

export const stats = () => {
  const totalQuoted = mockQuotes.reduce((s, q) => s + q.total, 0);
  const overdue = mockQuotes.filter((q) => q.status === "overdue");
  const overdueAmount = overdue.reduce((s, q) => s + q.total, 0);
  const paid = mockQuotes.filter((q) => q.status === "paid").reduce((s, q) => s + q.total, 0);
  const pending = mockQuotes.filter((q) => q.status === "pending").reduce((s, q) => s + q.total, 0);
  const accepted = mockQuotes.filter((q) => q.status === "accepted").reduce((s, q) => s + q.total, 0);
  return {
    totalQuoted,
    clientCount: mockClients.length,
    quoteCount: mockQuotes.length,
    overdueCount: overdue.length,
    overdueAmount,
    paid,
    pending,
    accepted,
    avgQuote: totalQuoted / mockQuotes.length,
  };
};

export const formatGBP = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: n < 1000 ? 2 : 0 }).format(n);
