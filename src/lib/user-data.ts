import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  computeDepositAmount,
  defaultDepositPercent,
  deriveTimingFromTotal,
  type PaymentTiming,
} from "@/lib/payment-timing";

export type QuoteStatus = "pending" | "sent" | "accepted" | "declined" | "completed" | "paid" | "overdue";
export type PaymentMethod = "card" | "bank" | "cash" | "other";
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

export type LineItemCategory = "labour" | "materials" | "certificate" | "cis_labour" | "other";
export type LineItemUnit = "qty" | "hours" | "days";

export type LineItem = {
  description: string;
  qty: number;
  unit_price: number;
  /** Provenance of the price for badging on quote detail. */
  source?: "voice" | "learned" | "ai";
  /** Accounting category — used for CSV export account-code mapping. */
  category?: LineItemCategory;
  /** How qty is measured. Labour lines use "hours" or "days"; everything else defaults to "qty". */
  unit?: LineItemUnit;
  /** Optional supplier/merchant SKU shown on the material shopping list. */
  supplier_code?: string;
};


/** True for line categories that should default to time-based units. */
export const isLabourCategory = (c?: LineItemCategory) =>
  c === "labour" || c === "cis_labour";

/** Format the qty for display, honouring the line's unit. */
export function formatLineQty(qty: number, unit?: LineItemUnit): string {
  if (unit === "hours") return `${qty} ${qty === 1 ? "hr" : "hrs"}`;
  if (unit === "days") return `${qty} ${qty === 1 ? "day" : "days"}`;
  return String(qty);
}

export function unitPriceSuffix(unit?: LineItemUnit): string {
  if (unit === "hours") return "/hr";
  if (unit === "days") return "/day";
  return "";
}

export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  property_type: string;
  notes?: string;
  created_at: string;
  /** ISO timestamp when a Google review request was last sent */
  review_requested_at?: string;
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
  /** Per-invoice override for the auto-chase scheduler (defaults to profile setting) */
  auto_chase_enabled?: boolean;
  // ---- Payment timing (optional during rollout — defaults applied at read time) ----
  payment_timing?: PaymentTiming;
  deposit_amount?: number;
  deposit_percent?: number;
  /** Set once the trader marks the job as physically complete (pre-payment). */
  completed_at?: string;
  /** Last DB write — proxy for when status changed (e.g. accepted today). */
  updated_at?: string;
  /** Tick state for the material shopping list, indexed by line_items position. (legacy) */
  materials_purchased?: boolean[];
  /** Separate materials shopping list for the job — independent of quote line items. */
  materials_list?: MaterialItem[];
};

export type MaterialItem = {
  id: string;
  description: string;
  qty: number;
  purchased: boolean;
};


export type ChaseStatus = "scheduled" | "sent" | "skipped";


export type ScheduledChase = {
  id: string;
  quote_id: string;
  /** 7 / 14 / 21, days after due date */
  day_offset: number;
  due_at: string; // ISO, when the chase becomes due
  status: ChaseStatus;
  /** ISO timestamp when it will auto-send if Nav doesn't act first */
  auto_send_at?: string;
};


export const DEFAULT_CHASE_TEMPLATES = {
  first:
    "Hi {name}, just a friendly reminder that your invoice for {job} of {amount} is due. You can pay by card here: {link} or by bank transfer to {bank}. Thanks, {business}",
  second:
    "Hi {name}, following up on the invoice for {job}, {amount} now 14 days overdue. Please arrange payment at your earliest convenience: {link}. {business}",
  final:
    "Hi {name}, this is a final reminder regarding the outstanding invoice for {job}, {amount} now 21 days overdue. Please make payment today to avoid further action: {link}. {business}",
};

export const EMPTY_PROFILE = {
  business_name: "",
  full_name: "",
  phone: "",
  email: "",
  town: "",
  address_line_1: "",
  address_line_2: "",
  postcode: "",
  trade_type: "",
  registration_number: "",
  vat_number: "",
  vat_registered: false,
  bank_account_name: "",
  bank_name: "",
  sort_code: "",
  account_number: "",
  payment_reference_note: "",
  stripe_connected: false,
  payment_terms: "Payment due within 14 days of invoice date.",
  /** Card processing fee shown on card payment summaries */
  card_fee_pct: 3.5,
  logo_url: "",
  quote_intro: "",
  quote_footer: "",
  signature_name: "",
  show_signature: true,
  // ---- Auto-chase ----
  auto_chase_enabled: true,
  chase_offsets: [7, 14, 21] as number[],
  chase_templates: { ...DEFAULT_CHASE_TEMPLATES },
  /** Hours to wait for Nav to act before auto-sending a chase */
  chase_auto_send_after_hours: 4,
  // ---- Google reviews ----
  google_review_url: "",
  // ---- Accounting export ----
  accounting_software: "" as "" | "xero" | "quickbooks" | "freeagent" | "sage" | "other" | "none",
  accounting_codes: {
    labour: "",
    materials: "",
    certificate: "",
    cis_labour: "",
    other: "",
  } as Record<LineItemCategory, string>,
  // ---- Default deposit % applied to new quotes over £500 ----
  default_deposit_percent: 30,
  // ---- Labour rates ----
  labour_hourly_rate: 0,
  labour_day_rate: 0,
};

export const userProfile = { ...EMPTY_PROFILE };


export const userClients: Client[] = [];

// ---------- Reactive version (bumps re-render of consumers after async writes) ----------
let _dataVersion = 0;
const _versionListeners = new Set<() => void>();
const bumpVersion = () => { _dataVersion++; _versionListeners.forEach((cb) => cb()); };

export function useDataVersion() {
  const [v, setV] = useState(_dataVersion);
  useEffect(() => {
    const cb = () => setV(_dataVersion);
    _versionListeners.add(cb);
    return () => { _versionListeners.delete(cb); };
  }, []);
  return v;
}

// ---------- Hydration from Lovable Cloud ----------
type DbClient = {
  id: string; name: string; phone: string | null; email: string | null;
  address: string | null; property_type: string | null; notes: string | null;
  created_at: string;
};
type DbQuote = {
  id: string; ref: string | null; client_id: string | null; title: string;
  job_description: string | null; line_items: LineItem[]; subtotal: number;
  vat_amount: number; total: number; status: QuoteStatus; due_date: string | null;
  notes: string | null; created_at: string; payment_method: PaymentMethod | null;
  paid_via: PaymentMethod | null; payment_request: PaymentRequest | null;
  invoiced_at: string | null; invoice_due_date: string | null;
  payment_timing: PaymentTiming | null;
  deposit_amount: number | null;
  deposit_percent: number | null;
  completed_at: string | null;
  updated_at?: string | null;
  materials_purchased?: boolean[] | null;
  materials_list?: MaterialItem[] | null;
};


const rowToClient = (r: DbClient): Client => ({
  id: r.id, name: r.name, phone: r.phone ?? "", email: r.email ?? "",
  address: r.address ?? "", property_type: r.property_type ?? "Homeowner",
  notes: r.notes ?? undefined, created_at: r.created_at.slice(0, 10),
});

const rowToQuote = (r: DbQuote): Quote => ({
  id: r.id, ref: r.ref ?? "", client_id: r.client_id ?? "",
  title: r.title, job_description: r.job_description ?? "",
  line_items: Array.isArray(r.line_items) ? r.line_items : [],
  subtotal: Number(r.subtotal), vat_amount: Number(r.vat_amount), total: Number(r.total),
  status: r.status, due_date: r.due_date ?? undefined, notes: r.notes ?? undefined,
  created_at: r.created_at.slice(0, 10),
  payment_method: r.payment_method ?? undefined,
  paid_via: r.paid_via ?? undefined,
  payment_request: r.payment_request ?? undefined,
  invoiced_at: r.invoiced_at ?? undefined,
  invoice_due_date: r.invoice_due_date ?? undefined,
  payment_timing: (r.payment_timing as PaymentTiming) ?? "on_completion",
  deposit_amount: Number(r.deposit_amount ?? 0),
  deposit_percent: Number(r.deposit_percent ?? 0),
  completed_at: r.completed_at ?? undefined,
  updated_at: r.updated_at ?? undefined,
  materials_purchased: Array.isArray(r.materials_purchased) ? r.materials_purchased : [],
  materials_list: Array.isArray(r.materials_list)
    ? (r.materials_list as MaterialItem[]).map((m) => ({
        id: String(m?.id ?? cryptoRandomId()),
        description: String(m?.description ?? ""),
        qty: Number(m?.qty ?? 1) || 1,
        purchased: !!m?.purchased,
      }))
    : [],
});

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}


export async function hydrateUserData() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    clearUserData();
    return;
  }
  const [clientsRes, quotesRes, profileRes] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase.from("quotes").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").eq("id", userData.user.id).maybeSingle(),
  ]);
  userClients.length = 0;
  (clientsRes.data ?? []).forEach((c) => userClients.push(rowToClient(c as DbClient)));
  mockQuotes.length = 0;
  (quotesRes.data ?? []).forEach((q) => mockQuotes.push(rowToQuote(q as unknown as DbQuote)));
  // Reset to empty defaults so the previous user's data (or seed defaults)
  // never bleeds into a new session.
  Object.assign(userProfile, EMPTY_PROFILE, { chase_templates: { ...DEFAULT_CHASE_TEMPLATES } });
  const p = profileRes.data as Record<string, unknown> | null;
  const asString = (v: unknown) => (typeof v === "string" ? v : "");
  if (p) {
    userProfile.business_name = asString(p.business_name);
    userProfile.full_name = asString(p.full_name);
    userProfile.phone = asString(p.phone);
    userProfile.email = asString(p.email) || userData.user.email || "";
    userProfile.town = asString(p.town);
    userProfile.address_line_1 = asString(p.address_line_1);
    userProfile.address_line_2 = asString(p.address_line_2);
    userProfile.postcode = asString(p.postcode);
    userProfile.trade_type = asString(p.trade_type);
    userProfile.registration_number = asString(p.registration_number);
    userProfile.vat_number = asString(p.vat_number);
    userProfile.vat_registered = !!p.vat_registered;
    userProfile.bank_account_name = asString(p.bank_account_name);
    userProfile.bank_name = asString(p.bank_name);
    userProfile.sort_code = asString(p.sort_code);
    userProfile.account_number = asString(p.account_number);
    userProfile.payment_reference_note = asString(p.payment_reference_note);
    if (asString(p.payment_terms)) userProfile.payment_terms = asString(p.payment_terms);
    userProfile.stripe_connected = !!(p.stripe_connect_charges_enabled);
    userProfile.logo_url = asString(p.logo_url);
    userProfile.quote_intro = asString(p.quote_intro);
    userProfile.quote_footer = asString(p.quote_footer);
    userProfile.signature_name = asString(p.signature_name);
    if (typeof p.show_signature === "boolean") userProfile.show_signature = p.show_signature;
    const sw = asString(p.accounting_software).toLowerCase();
    if (["xero", "quickbooks", "freeagent", "sage", "other", "none"].includes(sw)) {
      userProfile.accounting_software = sw as typeof userProfile.accounting_software;
    }
    if (p.accounting_codes && typeof p.accounting_codes === "object") {
      const codes = p.accounting_codes as Record<string, unknown>;
      (["labour", "materials", "certificate", "cis_labour", "other"] as const).forEach((k) => {
        if (typeof codes[k] === "string") userProfile.accounting_codes[k] = codes[k] as string;
      });
    }
    if (typeof p.default_deposit_percent === "number") {
      userProfile.default_deposit_percent = p.default_deposit_percent;
    }
    if (p.labour_hourly_rate != null && !isNaN(Number(p.labour_hourly_rate))) {
      userProfile.labour_hourly_rate = Number(p.labour_hourly_rate);
    }
    if (p.labour_day_rate != null && !isNaN(Number(p.labour_day_rate))) {
      userProfile.labour_day_rate = Number(p.labour_day_rate);
    }
  } else {
    userProfile.email = userData.user.email || "";
  }
  bumpVersion();
  // Auto-escalate completed invoices whose due date has passed → overdue.
  // Fire-and-forget; the chaser depends on this for escalation.
  void markOverdueQuotes();
}

/**
 * Flip any `completed` quote whose invoice_due_date (or due_date) is in the
 * past to `overdue`. Safe to call on app load and on the chaser screen.
 */
export async function markOverdueQuotes(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const stale = mockQuotes.filter((q) => {
    if (q.status !== "completed") return false;
    const due = q.invoice_due_date ?? q.due_date;
    if (!due) return false;
    const t = new Date(due).getTime();
    return Number.isFinite(t) && t < todayMs;
  });
  if (stale.length === 0) return 0;
  for (const q of stale) {
    const { error } = await supabase
      .from("quotes")
      .update({ status: "overdue" })
      .eq("id", q.id);
    if (!error) q.status = "overdue";
  }
  bumpVersion();
  return stale.length;
}

/** Persist current `userProfile` fields to Supabase (upsert by user id). */
export async function saveProfileToCloud(patch: Partial<typeof userProfile>) {
  Object.assign(userProfile, patch);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  const row = {
    id: userData.user.id,
    business_name: userProfile.business_name || null,
    full_name: userProfile.full_name || null,
    phone: userProfile.phone || null,
    email: userProfile.email || null,
    town: userProfile.town || null,
    address_line_1: userProfile.address_line_1 || null,
    address_line_2: userProfile.address_line_2 || null,
    postcode: userProfile.postcode || null,
    trade_type: userProfile.trade_type || null,
    registration_number: userProfile.registration_number || null,
    vat_number: userProfile.vat_number || null,
    vat_registered: userProfile.vat_registered,
    bank_account_name: userProfile.bank_account_name || null,
    bank_name: userProfile.bank_name || null,
    sort_code: userProfile.sort_code || null,
    account_number: userProfile.account_number || null,
    payment_reference_note: userProfile.payment_reference_note || null,
    payment_terms: userProfile.payment_terms || null,
    logo_url: userProfile.logo_url || null,
    quote_intro: userProfile.quote_intro || null,
    quote_footer: userProfile.quote_footer || null,
    signature_name: userProfile.signature_name || null,
    show_signature: userProfile.show_signature,
    accounting_software: userProfile.accounting_software || null,
    accounting_codes: userProfile.accounting_codes,
    default_deposit_percent: userProfile.default_deposit_percent,
    labour_hourly_rate: userProfile.labour_hourly_rate || null,
    labour_day_rate: userProfile.labour_day_rate || null,
  };
  const { error } = await supabase.from("profiles").upsert(row, { onConflict: "id" });
  if (error) console.error("[profile] save failed", error);
  bumpVersion();
}

export function clearUserData() {
  userClients.length = 0;
  mockQuotes.length = 0;
  mockJobs.length = 0;
  mockChases.length = 0;
  Object.assign(userProfile, EMPTY_PROFILE, { chase_templates: { ...DEFAULT_CHASE_TEMPLATES } });
  bumpVersion();
}

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

export const mockQuotes: Quote[] = [];

// Trade registry is the source of truth — these exports are derived for back-compat.
import { allTrades } from "./trades";

export const TRADE_TYPES = allTrades().filter((t) => t.id !== "Other").map((t) => t.label);

/** Quick-fill job description templates, keyed by trade label. */
export const QUOTE_TEMPLATES: Record<string, { label: string; prompt: string }[]> =
  Object.fromEntries(allTrades().map((t) => [t.label, t.quoteTemplates]));


export const getClient = (id: string) => userClients.find((c) => c.id === id);

/** Update a client's phone number (persisted). No-op if unchanged. */
export const updateClientPhone = async (clientId: string, phone: string): Promise<void> => {
  const existing = userClients.find((c) => c.id === clientId);
  const next = phone.trim();
  if (!existing) return;
  if ((existing.phone ?? "").trim() === next) return;
  const { error } = await supabase
    .from("clients")
    .update({ phone: next || null })
    .eq("id", clientId);
  if (error) {
    console.error("[updateClientPhone] update failed", error);
    throw new Error(error.message || "Could not update customer phone");
  }
  existing.phone = next;
  bumpVersion();
};

// ---------- Materials shopping list (separate from quote line items) ----------

/** Persist the whole materials list for a job. */
const persistMaterialsList = async (quoteId: string, list: MaterialItem[]) => {
  const q = getQuote(quoteId);
  if (!q) return;
  q.materials_list = list;
  const { error } = await supabase
    .from("quotes")
    .update({ materials_list: list as unknown as never })
    .eq("id", quoteId);
  if (error) {
    console.error("[persistMaterialsList] update failed", error);
    throw new Error(error.message || "Could not save materials list");
  }
  bumpVersion();
};

/** Read the materials shopping list for a job. */
export const materialsForQuote = (q: Quote): MaterialItem[] => {
  return Array.isArray(q.materials_list) ? q.materials_list : [];
};

/** Add a manual material item to a job. */
export const addMaterialItem = async (
  quoteId: string,
  input: { description: string; qty: number },
): Promise<void> => {
  const q = getQuote(quoteId);
  if (!q) return;
  const desc = input.description.trim();
  if (!desc) return;
  const qty = Math.max(1, Math.floor(Number(input.qty) || 1));
  const next: MaterialItem[] = [
    ...(q.materials_list ?? []),
    { id: cryptoRandomId(), description: desc, qty, purchased: false },
  ];
  await persistMaterialsList(quoteId, next);
};

/** Toggle / set the purchased flag for a single material item by id. */
export const setMaterialPurchased = async (
  quoteId: string,
  itemId: string,
  purchased: boolean,
): Promise<void> => {
  const q = getQuote(quoteId);
  if (!q) return;
  const next = (q.materials_list ?? []).map((m) =>
    m.id === itemId ? { ...m, purchased } : m,
  );
  await persistMaterialsList(quoteId, next);
};

/** Remove a material item by id. */
export const removeMaterialItem = async (
  quoteId: string,
  itemId: string,
): Promise<void> => {
  const q = getQuote(quoteId);
  if (!q) return;
  const next = (q.materials_list ?? []).filter((m) => m.id !== itemId);
  await persistMaterialsList(quoteId, next);
};

/**
 * Legacy bulk-set: kept for backwards compatibility. Accepts an array of
 * purchased flags aligned with the current materials_list order.
 */
export const setQuoteMaterialsPurchased = async (
  quoteId: string,
  purchased: boolean[],
): Promise<void> => {
  const q = getQuote(quoteId);
  if (!q) return;
  const list = q.materials_list ?? [];
  const next = list.map((m, i) => ({ ...m, purchased: !!purchased[i] }));
  await persistMaterialsList(quoteId, next);
};

/** Render the plain-text shopping list for sharing. */
export const buildMaterialsShareText = (q: Quote, customerName?: string): string => {
  const mats = materialsForQuote(q);
  const header = `Job: ${q.title}${customerName ? " - " + customerName : ""}`;
  if (mats.length === 0) return `${header}\n(No materials added yet)`;
  const lines = mats.map((m) => `- ${m.qty}x ${m.description}`);
  return [header, ...lines].join("\n");
};



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

// Out of scope for now, populated once payments persistence lands.
export const mockTransactions: Transaction[] = [];

/** Build a payment request (deposit / full / custom). */
export const buildPaymentRequest = (
  quote: Quote,
  type: PaymentRequestType,
  customAmount?: number,
): PaymentRequest => {
  const configuredDeposit = (() => {
    const total = Number(quote.total) || 0;
    const explicit = Number(quote.deposit_amount) || 0;
    const pct = Number(quote.deposit_percent) || 0;
    if (explicit > 0) return +explicit.toFixed(2);
    if (pct > 0) return +(total * (pct / 100)).toFixed(2);
    return 0;
  })();
  const amount =
    type === "deposit" ? configuredDeposit
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
    `Hi ${clientFirstName}, please find your invoice ${quote.ref} from ${userProfile.business_name}.`,
    "",
    `To pay your ${pr.label} of ${formatGBP(pr.amount)} securely by card tap here:`,
    pr.link,
    "",
    `Payment terms: ${userProfile.payment_terms}`,
    "",
    `Thanks, ${userProfile.full_name.split(" ")[0]}, ${userProfile.business_name}`,
    "",
    "Sent via Quottr.",
  ].join("\n");
};

export const buildInvoiceMessage = (quote: Quote, clientFirstName: string) => {
  if (quote.payment_method === "card" && quote.payment_request) {
    return buildPaymentRequestMessage(quote, quote.payment_request, clientFirstName);
  }
  const lines: string[] = [
    `Hi ${clientFirstName}, here's your invoice ${quote.ref} from ${userProfile.business_name} for "${quote.title}", total ${formatGBP(quote.total)}.`,
    "",
  ];
  if (quote.payment_method === "card") {
    lines.push(`Pay by card: ${stripePaymentLink(quote)}`);
  } else if (quote.payment_method === "bank") {
    lines.push(
      "Pay by bank transfer:",
      `  Account name: ${userProfile.bank_account_name}`,
      `  Bank: ${userProfile.bank_name}`,
      `  Sort code: ${userProfile.sort_code}`,
      `  Account number: ${userProfile.account_number}`,
      `  Reference: ${quote.ref}`,
    );
  } else if (quote.payment_method === "cash") {
    lines.push("Payment method: Cash on completion, please have cash ready on the day.");
  }
  lines.push(
    "",
    `Payment terms: ${userProfile.payment_terms}`,
    "",
    `Thanks, ${userProfile.full_name.split(" ")[0]}, ${userProfile.business_name}`,
    "",
    "Sent via Quottr.",
  );
  return lines.join("\n");
};

/**
 * Standard chaser copy. Tone depends on status:
 * - completed → friendly "hope the job went well" reminder (invoice now due)
 * - overdue → firmer nudge with days-overdue figure
 * - anything else (defensive fallback) → neutral payment follow-up
 */
export const buildChaserMessage = (quote: Quote, clientFirstName: string) => {
  const first = clientFirstName || "there";
  const amount = formatGBP(quote.total);
  const signOff = `Many thanks, ${userProfile.full_name.split(" ")[0]}`;
  const footer = "\n\nSent via Quottr.";

  if (quote.status === "overdue") {
    const due = quote.invoice_due_date ?? quote.due_date;
    const daysOverdue = due
      ? Math.max(1, Math.floor((Date.now() - new Date(due).getTime()) / 86400000))
      : null;
    const overdueLine = daysOverdue
      ? `this invoice is now ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue.`
      : `this invoice is now overdue.`;
    return [
      `Hi ${first}, ${overdueLine}`,
      `Invoice ${quote.ref} from ${userProfile.business_name} for ${amount} is still outstanding — could you settle it as soon as possible?`,
      signOff,
    ].join("\n") + footer;
  }

  if (quote.status === "completed") {
    return [
      `Hi ${first}, hope the job went well.`,
      `Quick reminder your invoice ${quote.ref} from ${userProfile.business_name} for ${amount} is now due. Could you let me know when payment will be made?`,
      signOff,
    ].join("\n") + footer;
  }

  // Defensive fallback — shouldn't normally fire; chaser only runs on completed/overdue.
  return [
    `Hi ${first}, just following up on invoice ${quote.ref} from ${userProfile.business_name} for ${amount}.`,
    "Could you let me know when payment will be made?",
    signOff,
  ].join("\n") + footer;
};

export const stats = () => {
  const totalQuoted = mockQuotes.reduce((s, q) => s + q.total, 0);
  const overdue = mockQuotes.filter((q) => q.status === "overdue");
  const overdueAmount = overdue.reduce((s, q) => s + q.total, 0);
  const paidQuotes = mockQuotes.filter((q) => q.status === "paid");
  const paid = paidQuotes.reduce((s, q) => s + q.total, 0);
  const pending = mockQuotes.filter((q) => q.status === "pending").reduce((s, q) => s + q.total, 0);
  const accepted = mockQuotes.filter((q) => q.status === "accepted").reduce((s, q) => s + q.total, 0);
  const completed = mockQuotes.filter((q) => q.status === "completed").reduce((s, q) => s + q.total, 0);
  // "You are owed" = work that's done (completed) plus invoices already overdue.
  // Booked/accepted is excluded — the work hasn't happened yet, so nothing is owed.
  const outstanding = mockQuotes
    .filter((q) => q.status === "completed" || q.status === "overdue")
    .reduce((s, q) => s + q.total, 0);
  // Profit tracker totals, derived from the transactions log so card/bank/cash split
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
  // ---- "Today" signals for the home-screen status hero ----
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayTs = startOfToday.getTime();
  const isToday = (iso?: string | null) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t >= todayTs;
  };
  const paidTodayTx = mockTransactions.filter((t) => isToday(t.date));
  const paidToday = paidTodayTx.reduce((s, t) => s + t.amount, 0);
  const paidTodayCount = paidTodayTx.length;
  const acceptedQuotes = mockQuotes.filter((q) => q.status === "accepted");
  const acceptedCount = acceptedQuotes.length;
  const acceptedAmount = acceptedQuotes.reduce((s, q) => s + q.total, 0);
  const acceptedTodayQuotes = acceptedQuotes.filter((q) => isToday(q.updated_at));
  const acceptedTodayCount = acceptedTodayQuotes.length;
  const acceptedTodayAmount = acceptedTodayQuotes.reduce((s, q) => s + q.total, 0);
  const sentQuotes = mockQuotes.filter((q) => q.status === "sent");
  const awaitingReplyCount = sentQuotes.length;
  const awaitingReplyAmount = sentQuotes.reduce((s, q) => s + q.total, 0);
  return {
    totalQuoted,
    clientCount: userClients.length,
    quoteCount: mockQuotes.length,
    overdueCount: overdue.length,
    overdueAmount,
    paid, pending, accepted, completed, outstanding,
    paidByCard: txByMethod("card"),
    paidByBank: txByMethod("bank"),
    paidByCash: txByMethod("cash"),
    collectedAll,
    avgQuote: mockQuotes.length ? totalQuoted / mockQuotes.length : 0,
    collectedThisMonth,
    topJobs,
    bestJob,
    paidToday,
    paidTodayCount,
    acceptedCount,
    acceptedAmount,
    acceptedTodayCount,
    acceptedTodayAmount,
    awaitingReplyCount,
    awaitingReplyAmount,
  };
};

export const formatGBP = (n: number) => {
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: safe < 1000 ? 2 : 0,
  }).format(safe);
};

// ---------- Scheduled jobs (calendar) ----------

const _today = new Date();
// Find Monday of the current week (so the seeded jobs always land on this week's Mon-Fri)
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

export const mockJobs: ScheduledJob[] = [];

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

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (data.user) return data.user.id;
  // Auth may not have rehydrated yet — try the cached session once.
  const { data: sess } = await supabase.auth.getSession();
  if (sess.session?.user) return sess.session.user.id;
  throw new Error("Please sign in again to save");
}

/** Find existing client by name (case-insensitive) or create a new one (persisted). */
export const findOrCreateClient = async (
  name: string,
  opts?: Partial<Client>,
): Promise<Client> => {
  const trimmed = name.trim() || "New client";
  const existing = userClients.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;
  const user_id = await requireUserId();
  const insertPayload = {
    user_id,
    name: trimmed,
    phone: opts?.phone || null,
    email: opts?.email || null,
    address: opts?.address || null,
    property_type: opts?.property_type || "Homeowner",
    notes: opts?.notes || null,
  };
  const { data, error } = await supabase
    .from("clients")
    .insert(insertPayload)
    .select("*")
    .single();
  if (error) {
    console.error("[findOrCreateClient] insert failed", error);
    throw new Error(error.message || "Could not save customer");
  }
  const client = rowToClient(data as DbClient);
  userClients.unshift(client);
  bumpVersion();
  return client;
};

/** Compute next QTR reference (zero-padded 3 digits). */
export const nextQuoteRef = () => {
  const nums = mockQuotes
    .map((q) => Number((q.ref || "").replace(/[^0-9]/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `QTR-${String(next).padStart(3, "0")}`;
};

/** Save a generated quote to Lovable Cloud and return it. */
export const saveGeneratedQuote = async (input: {
  clientName: string;
  clientPhone?: string;
  description: string;
  title: string;
  line_items: LineItem[];
  vatRegistered: boolean;
}): Promise<Quote> => {
  const trimmedName = input.clientName?.trim() ?? "";
  const client = trimmedName
    ? await findOrCreateClient(trimmedName, {
        phone: input.clientPhone?.trim() || undefined,
      })
    : null;

  const subtotal = +input.line_items.reduce((s, li) => s + li.qty * li.unit_price, 0).toFixed(2);
  const vat_amount = input.vatRegistered ? +(subtotal * VAT_RATE).toFixed(2) : 0;
  const total = +(subtotal + vat_amount).toFixed(2);
  const due = new Date(); due.setDate(due.getDate() + 14);
  const user_id = await requireUserId();
  const timing = deriveTimingFromTotal(total);
  const depositPct = timing === "deposit_then_balance"
    ? defaultDepositPercent(userProfile.default_deposit_percent)
    : 0;
  const depositAmt = timing === "deposit_then_balance"
    ? computeDepositAmount(subtotal, depositPct)
    : 0;
  const insertPayload = {
    user_id,
    ref: nextQuoteRef(),
    client_id: client?.id ?? null,
    title: input.title,
    job_description: input.description,
    line_items: input.line_items as unknown as Record<string, unknown>,
    subtotal,
    vat_amount,
    total,
    vat_registered: input.vatRegistered,
    status: "pending" as QuoteStatus,
    due_date: due.toISOString().slice(0, 10),
    payment_method: "card" as PaymentMethod,
    payment_timing: timing,
    deposit_amount: depositAmt,
    deposit_percent: depositPct,
  };
  const { data, error } = await supabase
    .from("quotes")
    .insert(insertPayload as never)
    .select("*")
    .single();
  if (error) throw error;
  const quote = rowToQuote(data as unknown as DbQuote);
  mockQuotes.unshift(quote);
  bumpVersion();
  // Fire-and-forget: feed the pricing memory so future quotes learn from this one.
  try {
    const { upsertPatternsFromQuote } = await import("@/lib/pricing-patterns.functions");
    void upsertPatternsFromQuote({
      data: {
        items: input.line_items.map((li) => ({
          description: li.description,
          qty: li.qty,
          unit_price: li.unit_price,
        })),
      },
    }).catch((e) => console.warn("[pricing-patterns] upsert failed", e));
  } catch (e) {
    console.warn("[pricing-patterns] import failed", e);
  }
  return quote;
};

/** Card processing fee helper, used in the payment summary. */
export const calcCardFee = (amount: number) => {
  const pct = userProfile.card_fee_pct;
  const fee = +(amount * (pct / 100)).toFixed(2);
  return { pct, fee, net: +(amount - fee).toFixed(2) };
};

// ---------- Quote duplication ----------

/** Duplicate a quote with a fresh QTR ref, persisted to Lovable Cloud. */
export const duplicateQuote = async (quoteId: string): Promise<Quote | null> => {
  const src = getQuote(quoteId);
  if (!src) return null;
  const due = new Date(); due.setDate(due.getDate() + 14);
  const user_id = await requireUserId();
  const insertPayload = {
    user_id,
    ref: nextQuoteRef(),
    client_id: src.client_id,
    title: src.title,
    job_description: src.job_description,
    line_items: src.line_items.map((li) => ({ ...li })) as unknown as Record<string, unknown>,
    subtotal: src.subtotal,
    vat_amount: src.vat_amount,
    total: src.total,
    status: "pending" as QuoteStatus,
    due_date: due.toISOString().slice(0, 10),
    payment_method: src.payment_method ?? "card",
  };
  const { data, error } = await supabase
    .from("quotes")
    .insert(insertPayload as never)
    .select("*")
    .single();
  if (error) throw error;
  const copy = rowToQuote(data as unknown as DbQuote);
  mockQuotes.unshift(copy);
  bumpVersion();
  return copy;
};

export const deleteQuote = async (quoteId: string): Promise<void> => {
  const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
  if (error) throw error;
  const idx = mockQuotes.findIndex((q) => q.id === quoteId);
  if (idx >= 0) mockQuotes.splice(idx, 1);
  const jIdx = mockJobs.findIndex((j) => j.quote_id === quoteId);
  if (jIdx >= 0) mockJobs.splice(jIdx, 1);
  bumpVersion();
};

// ---------- Auto-chase scheduler ----------

export const mockChases: ScheduledChase[] = [];

/** Ensure chases exist for an overdue/accepted invoice, honouring per-invoice + profile toggles. */
export const ensureChasesFor = (quote: Quote) => {
  if (!quote.due_date) return;
  const enabled = quote.auto_chase_enabled ?? userProfile.auto_chase_enabled;
  if (!enabled) return;
  const offsets = (userProfile.chase_offsets?.length ? userProfile.chase_offsets : [7, 14, 21]);
  const dueMs = new Date(quote.due_date).getTime();
  offsets.forEach((d) => {
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

/** Disable any pending chases for a quote (used when Nav toggles auto-chase off). */
export const cancelChasesFor = (quoteId: string) => {
  for (let i = mockChases.length - 1; i >= 0; i--) {
    if (mockChases[i].quote_id === quoteId && mockChases[i].status === "scheduled") {
      mockChases.splice(i, 1);
    }
  }
};

/**
 * Whether the chaser should currently be nudging on a given quote, given its
 * payment timing. For deposit_then_balance: chase the deposit as soon as the
 * customer accepts; chase the balance only once the job is marked complete.
 * For everything else (on_completion / upfront / staged): only chase after
 * the job is marked complete or the invoice has actually gone overdue.
 */
export const isQuoteChaseableNow = (quote: Quote): boolean => {
  const timing = quote.payment_timing ?? "on_completion";
  if (timing === "deposit_then_balance") {
    return ["accepted", "completed", "overdue"].includes(quote.status);
  }
  return ["completed", "overdue"].includes(quote.status);
};

/** Seed chases for every quote that's currently chaseable. */
export const seedChases = () => {
  mockQuotes
    .filter((q) => q.status === "overdue" || isQuoteChaseableNow(q))
    .forEach((q) => ensureChasesFor(q));
};

seedChases();

export const chasesForQuote = (quoteId: string) =>
  mockChases
    .filter((c) => c.quote_id === quoteId)
    .sort((a, b) => a.day_offset - b.day_offset);

/** Chases due now (scheduled and past due_at). Auto-stamps auto_send_at on first sight. */
export const chasesDueNow = () => {
  const now = Date.now();
  const windowMs = (userProfile.chase_auto_send_after_hours ?? 4) * 3600 * 1000;
  const due = mockChases
    .filter((c) => c.status === "scheduled" && new Date(c.due_at).getTime() <= now)
    .map((c) => ({ chase: c, quote: getQuote(c.quote_id) }))
    .filter((x): x is { chase: ScheduledChase; quote: Quote } => !!x.quote)
    .filter(({ quote }) => isQuoteChaseableNow(quote));
  due.forEach(({ chase }) => {
    if (!chase.auto_send_at) chase.auto_send_at = new Date(now + windowMs).toISOString();
  });
  return due;
};

export const upcomingChases = () => {
  const now = Date.now();
  return mockChases
    .filter((c) => c.status === "scheduled" && new Date(c.due_at).getTime() > now)
    .sort((a, b) => +new Date(a.due_at) - +new Date(b.due_at))
    .map((c) => ({ chase: c, quote: getQuote(c.quote_id) }))
    .filter((x): x is { chase: ScheduledChase; quote: Quote } => !!x.quote)
    .filter(({ quote }) => isQuoteChaseableNow(quote));
};

export const markChaseSent = (chaseId: string) => {
  const c = mockChases.find((x) => x.id === chaseId);
  if (c) c.status = "sent";
};

/** Build chase message for a specific day offset using the profile templates. */
export const buildChaseMessageForOffset = (
  quote: Quote,
  clientFirstName: string,
  offset: number,
) => {
  const offsets = userProfile.chase_offsets ?? [7, 14, 21];
  const t = userProfile.chase_templates ?? DEFAULT_CHASE_TEMPLATES;
  const tpl =
    offset === offsets[0] ? t.first
    : offset === offsets[1] ? t.second
    : t.final;
  const link = quote.payment_request?.link ?? stripePaymentLink(quote);
  const bank = `${userProfile.bank_account_name} · sort ${userProfile.sort_code} · ${userProfile.account_number}`;
  return tpl
    .replaceAll("{name}", clientFirstName)
    .replaceAll("{job}", quote.title)
    .replaceAll("{amount}", formatGBP(quote.total))
    .replaceAll("{link}", link)
    .replaceAll("{bank}", bank)
    .replaceAll("{business}", userProfile.business_name);
};



export const skipChase = (chaseId: string) => {
  const c = mockChases.find((x) => x.id === chaseId);
  if (c) c.status = "skipped";
};

/** Toggle auto-chase on/off for a single quote. */
export const setQuoteAutoChase = (quoteId: string, enabled: boolean) => {
  const q = getQuote(quoteId);
  if (!q) return;
  q.auto_chase_enabled = enabled;
  if (enabled) ensureChasesFor(q);
  else cancelChasesFor(quoteId);
  bumpVersion();
};

// ---------- WhatsApp helpers ----------

/** Convert a UK mobile (e.g. 07700 900456) into a wa.me digits string (44...). */
export const waDigits = (phone?: string) => {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("44")) return d;
  return "44" + d.replace(/^0/, "");
};

/** Build a wa.me deep link with pre-filled text. */
export const waLink = (phone: string | undefined, text: string) =>
  `https://wa.me/${waDigits(phone)}?text=${encodeURIComponent(text)}`;

/** Spec-format quote message with customer portal link. */
export const buildQuoteWhatsAppMessage = (
  quote: Quote,
  client: Pick<Client, "name"> | undefined,
  portalUrl: string,
) => {
  const first = client?.name?.split(" ")[0] ?? "there";
  return [
    `Hi ${first} 👋`,
    `Your quote from ${userProfile.business_name} is ready.`,
    `Total: ${formatGBP(quote.total)}${userProfile.vat_registered ? " inc VAT" : ""}`,
    "",
    `View, approve and pay your deposit here:`,
    portalUrl,
    "",
    `Quote valid for 30 days. Any questions just reply.`,
    `${userProfile.business_name} · ${userProfile.phone}`,
  ].join("\n");
};

// ---------- Google review request ----------

export const buildReviewRequestMessage = (clientFirstName: string) => {
  const url = userProfile.google_review_url || "[paste your Google review link in Settings]";
  return [
    `Hi ${clientFirstName}, thank you for choosing ${userProfile.business_name}.`,
    `We really hope you were happy with the work.`,
    "",
    `If you have a moment it would mean the world if you left us a quick Google review, it helps other homeowners find us:`,
    url,
    "",
    `Takes 30 seconds and makes a huge difference. Thank you 🙏`,
    userProfile.business_name,
  ].join("\n");
};

export const markReviewRequested = (clientId: string) => {
  const c = getClient(clientId);
  if (!c) return;
  c.review_requested_at = new Date().toISOString();
  bumpVersion();
};



// ---------- Quote → invoice split ----------

/** Mark a quote as invoiced (issues a formal invoice), persisted to Lovable Cloud. */
export const markInvoiced = async (quoteId: string): Promise<Quote | null> => {
  const q = getQuote(quoteId);
  if (!q) return null;
  if (q.invoiced_at) return q;
  const today = new Date();
  const due = new Date(); due.setDate(due.getDate() + 14);
  const invoiced_at = today.toISOString();
  const invoice_due_date = due.toISOString().slice(0, 10);
  const { error } = await supabase
    .from("quotes")
    .update({ invoiced_at, invoice_due_date })
    .eq("id", quoteId);
  if (error) throw error;
  q.invoiced_at = invoiced_at;
  q.invoice_due_date = invoice_due_date;
  ensureChasesFor(q);
  bumpVersion();
  return q;
};

/** Mark a job physically complete (sets status + completed_at). */
export const markJobComplete = async (quoteId: string): Promise<Quote | null> => {
  const q = getQuote(quoteId);
  if (!q) return null;
  const completed_at = new Date().toISOString();
  const { error } = await supabase
    .from("quotes")
    .update({ status: "completed", completed_at })
    .eq("id", quoteId);
  if (error) throw error;
  q.status = "completed";
  q.completed_at = completed_at;
  bumpVersion();
  return q;
};

/** Update payment timing + deposit fields on a quote. */
export const updateQuotePaymentTiming = async (
  quoteId: string,
  patch: { payment_timing?: PaymentTiming; deposit_amount?: number; deposit_percent?: number },
): Promise<Quote | null> => {
  const q = getQuote(quoteId);
  if (!q) return null;
  const { error } = await supabase
    .from("quotes")
    .update(patch as never)
    .eq("id", quoteId);
  if (error) throw error;
  if (patch.payment_timing !== undefined) q.payment_timing = patch.payment_timing;
  if (patch.deposit_amount !== undefined) q.deposit_amount = patch.deposit_amount;
  if (patch.deposit_percent !== undefined) q.deposit_percent = patch.deposit_percent;
  bumpVersion();
  return q;
};

/** Persist a quote status change to Lovable Cloud. */
export const setQuoteStatus = async (
  quoteId: string,
  status: QuoteStatus,
): Promise<Quote | null> => {
  const q = getQuote(quoteId);
  if (!q) return null;
  const { error } = await supabase
    .from("quotes")
    .update({ status })
    .eq("id", quoteId);
  if (error) throw error;
  q.status = status;
  bumpVersion();
  return q;
};

const VAT_RATE_LOCAL = 0.2;

/** Persist edited line items and recompute totals. */
export const updateQuoteLineItems = async (
  quoteId: string,
  line_items: LineItem[],
  vatRegistered: boolean,
): Promise<Quote | null> => {
  const q = getQuote(quoteId);
  if (!q) return null;
  const subtotal = +line_items.reduce((s, li) => s + li.qty * li.unit_price, 0).toFixed(2);
  const vat_amount = vatRegistered ? +(subtotal * VAT_RATE_LOCAL).toFixed(2) : 0;
  const total = +(subtotal + vat_amount).toFixed(2);
  const { error } = await supabase
    .from("quotes")
    .update({
      line_items: line_items as never,
      subtotal,
      vat_amount,
      total,
    })
    .eq("id", quoteId);
  if (error) throw error;
  q.line_items = line_items;
  q.subtotal = subtotal;
  q.vat_amount = vat_amount;
  q.total = total;
  bumpVersion();
  // Feed pricing memory with the corrected prices.
  try {
    const { upsertPatternsFromQuote } = await import("@/lib/pricing-patterns.functions");
    void upsertPatternsFromQuote({
      data: {
        items: line_items.map((li) => ({
          description: li.description,
          qty: li.qty,
          unit_price: li.unit_price,
        })),
      },
    }).catch((e) => console.warn("[pricing-patterns] upsert failed", e));
  } catch (e) {
    console.warn("[pricing-patterns] import failed", e);
  }
  return q;
};

export const assignClientToQuote = async (
  quoteId: string,
  clientId: string,
): Promise<Quote | null> => {
  const q = getQuote(quoteId);
  if (!q) return null;
  const { error } = await supabase
    .from("quotes")
    .update({ client_id: clientId })
    .eq("id", quoteId);
  if (error) throw error;
  q.client_id = clientId;
  bumpVersion();
  return q;
};

export const invoiceRef = (q: Quote) => q.ref.replace(/^QTR/i, "INV");

export const buildFinalInvoiceMessage = (quote: Quote, clientFirstName: string) => {
  const ref = invoiceRef(quote);
  const due = quote.invoice_due_date ?? "";
  const lines = [
    `Hi ${clientFirstName}, please find your INVOICE ${ref} from ${userProfile.business_name}.`,
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
    `  ${userProfile.bank_account_name}`,
    `  ${userProfile.bank_name} · sort ${userProfile.sort_code} · ${userProfile.account_number}`,
    `  Reference: ${ref}`,
    "",
    `${userProfile.payment_terms}`,
    "",
    `Thanks, ${userProfile.full_name.split(" ")[0]}, ${userProfile.business_name}`,
    "",
    "Sent via Quottr.",
  );
  return lines.filter(Boolean).join("\n");
};

// ---------- Deposit on acceptance ----------

/** Build the WhatsApp-ready deposit request message immediately after a quote is accepted. */
export const buildDepositOnAcceptMessage = (quote: Quote, clientFirstName: string) => {
  const total = Number(quote.total) || 0;
  const explicit = Number(quote.deposit_amount) || 0;
  const pct = Number(quote.deposit_percent) || 0;
  const amount =
    explicit > 0 ? +explicit.toFixed(2)
    : pct > 0 ? +(total * (pct / 100)).toFixed(2)
    : 0;
  const link = stripePaymentLink(quote, amount);
  const method = quote.payment_method ?? "card";
  const lines = [
    `Hi ${clientFirstName}, thanks for accepting your quote ${quote.ref} from ${userProfile.business_name}!`,
    "",
    `To get you booked in, please pay a deposit of ${formatGBP(amount)}.`,
    "",
  ];
  if (method === "card") {
    lines.push(`Pay by card here: ${link}`);
  } else if (method === "bank") {
    lines.push(
      "Bank transfer:",
      `  ${userProfile.bank_account_name}`,
      `  ${userProfile.bank_name} · sort ${userProfile.sort_code} · ${userProfile.account_number}`,
      `  Reference: ${quote.ref}`,
    );
  } else {
    lines.push("Cash deposit accepted, please drop off or pay on first visit.");
  }
  lines.push(
    "",
    `Once received I'll confirm your booking date. Any questions just shout.`,
    "",
    `Thanks, ${userProfile.full_name.split(" ")[0]}`,
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
    `Hi ${clientFirstName}, it's ${userProfile.full_name.split(" ")[0]} from ${userProfile.business_name}.`,
    "",
    "Your annual boiler service is due next month. Would you like to book in?",
    "Just reply YES and I'll get you booked.",
    "",
    `Many thanks, ${userProfile.full_name.split(" ")[0]}`,
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
  userClients.forEach((c) => {
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
    // No q1 job seeded, synthesise one so the reminder shows.
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
  // Add a second reminder ~12 days out for the second seeded client (q2)
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
