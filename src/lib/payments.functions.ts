import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveSubscription } from "@/lib/require-active-subscription";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Quottr's BYOK Stripe platform key. When the pro has completed Connect
// onboarding, client-invoice payments are routed to their connected
// account via `Stripe-Account` so funds go straight to them.
function getStripeEnv() {
  const byok = process.env.STRIPE_BYOK_SECRET_KEY;
  if (byok) return { key: byok, env: "live" as const };
  const sandbox = process.env.STRIPE_SANDBOX_API_KEY;
  if (!sandbox) throw new Error("Stripe is not configured");
  return { key: sandbox, env: "sandbox" as const };
}

function toFormBody(params: Record<string, string | number>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.append(k, String(v));
  return body.toString();
}

export const createInvoiceCheckout = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator(
    z.object({
      quoteId: z.string().min(1).max(128),
      quoteRef: z.string().min(1).max(64),
      title: z.string().min(1).max(200),
      amount: z.number().positive().max(1_000_000),
      currency: z.string().length(3).default("gbp"),
      requestType: z.enum(["deposit", "full", "custom"]),
      customerEmail: z.string().email().optional(),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { key, env } = getStripeEnv();
    const amountCents = Math.round(data.amount * 100);

    // Look up the pro's Connect account so client payments land in their
    // Stripe balance directly (Quottr never holds funds).
    const { supabase } = context;

    // Verify the quote belongs to the authenticated user before creating
    // a Stripe session that references it in metadata.
    const { data: ownedQuote, error: ownedQuoteError } = await supabase
      .from("quotes")
      .select("id")
      .eq("id", data.quoteId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (ownedQuoteError) throw ownedQuoteError;
    if (!ownedQuote) throw new Error("Quote not found");

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "stripe_connect_account_id, stripe_connect_charges_enabled",
      )
      .eq("id", context.userId)
      .maybeSingle();
    const connectAccountId =
      profile?.stripe_connect_charges_enabled && profile?.stripe_connect_account_id
        ? profile.stripe_connect_account_id
        : null;

    const params: Record<string, string | number> = {
      mode: "payment",
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": data.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": amountCents,
      "line_items[0][price_data][product_data][name]":
        `${data.quoteRef}, ${data.title}`.slice(0, 250),
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
      "metadata[quote_id]": data.quoteId,
      "metadata[quote_ref]": data.quoteRef,
      "metadata[user_id]": context.userId,
      "metadata[request_type]": data.requestType,
      "payment_intent_data[metadata][quote_id]": data.quoteId,
      "payment_intent_data[metadata][user_id]": context.userId,
      "payment_intent_data[metadata][request_type]": data.requestType,
    };
    if (data.customerEmail) params["customer_email"] = data.customerEmail;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (connectAccountId) {
      // Direct charge on the connected account.
      headers["Stripe-Account"] = connectAccountId;
      // Quottr platform fee: 0.5% of the transaction, min 50p, max £25.
      // Only applied when routing to a connected account, so funds still
      // go to the pro and Quottr keeps the small platform cut.
      const feeAmount = Math.max(50, Math.min(2500, Math.round(amountCents * 0.005)));
      params["payment_intent_data[application_fee_amount]"] = feeAmount;
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers,
      body: toFormBody(params),
    });

    const json = (await res.json()) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };
    if (!res.ok || !json.url || !json.id) {
      console.error("Stripe checkout creation failed", json);
      throw new Error("Payment service error. Please try again or contact support.");
    }

    // Log a pending payment row so the dashboard can show it.
    await supabase.from("invoice_payments").insert({
      user_id: context.userId,
      quote_id: data.quoteId,
      request_type: data.requestType,
      customer_email: data.customerEmail ?? null,
      amount_cents: amountCents,
      currency: data.currency.toLowerCase(),
      status: "pending",
      stripe_session_id: json.id,
      payment_method: "card",
    });

    return { url: json.url, sessionId: json.id, env };
  });

export const listInvoicePayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("invoice_payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return { payments: data ?? [] };
  });

export const getQuotePaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ quoteId: z.string().min(1).max(128) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("invoice_payments")
      .select("*")
      .eq("quote_id", data.quoteId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { payments: rows ?? [] };
  });

// ---------- Public: customer pays from the portal (token-auth) ----------
// Stripe-hosted Checkout. We deliberately omit `payment_method_types` so
// Stripe surfaces every method enabled on the account, including Apple Pay
// and Google Pay (auto-detected per browser).
const ALLOWED_PORTAL_ORIGINS = new Set([
  "https://quottr.co.uk",
  "https://www.quottr.co.uk",
  "https://graft-build-pro.lovable.app",
  "https://id-preview--e4be6907-c837-4e5e-9461-63fadfdad91e.lovable.app",
]);

export const createPortalCheckout = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: z.string().min(8).max(128),
      requestType: z.enum(["deposit", "full"]),
      returnOrigin: z.string().url(),
    }),
  )
  .handler(async ({ data }) => {
    const { key, env } = getStripeEnv();

    // Prevent open-redirect: only trust known Quottr origins for the
    // post-checkout return URL. Anything else falls back to production.
    const returnOrigin = ALLOWED_PORTAL_ORIGINS.has(data.returnOrigin)
      ? data.returnOrigin
      : "https://quottr.co.uk";

    const { data: tk } = await supabaseAdmin
      .from("quote_portal_tokens")
      .select("quote_id, user_id, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!tk) throw new Error("Invalid or expired link");
    if (tk.expires_at && new Date(tk.expires_at).getTime() < Date.now()) {
      throw new Error("This link has expired. Please ask for a new one.");
    }

    const { data: quote } = await supabaseAdmin
      .from("quotes")
      .select("id, ref, title, total, deposit_amount, deposit_percent, payment_timing, client_id, status")
      .eq("id", tk.quote_id)
      .maybeSingle();
    if (!quote) throw new Error("Quote not found");
    if (quote.status === "paid") throw new Error("This quote is already paid");

    const total = Number(quote.total) || 0;
    let amount = total;
    if (data.requestType === "deposit") {
      const explicit = Number(quote.deposit_amount) || 0;
      const pct = Number(quote.deposit_percent) || 0;
      amount = explicit > 0
        ? explicit
        : pct > 0
        ? +(total * (pct / 100)).toFixed(2)
        : +(total * 0.5).toFixed(2);
    }
    if (amount <= 0) throw new Error("Invalid payment amount");
    const amountCents = Math.round(amount * 100);

    const [{ data: profile }, { data: client }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("stripe_connect_account_id, stripe_connect_charges_enabled")
        .eq("id", tk.user_id)
        .maybeSingle(),
      quote.client_id
        ? supabaseAdmin
            .from("clients")
            .select("email")
            .eq("id", quote.client_id)
            .maybeSingle()
        : Promise.resolve({ data: null as { email: string | null } | null }),
    ]);

    const connectAccountId =
      profile?.stripe_connect_charges_enabled && profile?.stripe_connect_account_id
        ? profile.stripe_connect_account_id
        : null;

    const ref = quote.ref ?? quote.id.slice(0, 8);
    const params: Record<string, string | number> = {
      mode: "payment",
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": "gbp",
      "line_items[0][price_data][unit_amount]": amountCents,
      "line_items[0][price_data][product_data][name]":
        `${ref}, ${quote.title}`.slice(0, 250),
      success_url: `${returnOrigin}/portal/${data.token}?paid=1`,
      cancel_url: `${returnOrigin}/portal/${data.token}?cancelled=1`,
      "metadata[quote_id]": quote.id,
      "metadata[quote_ref]": ref,
      "metadata[user_id]": tk.user_id,
      "metadata[request_type]": data.requestType,
      "payment_intent_data[metadata][quote_id]": quote.id,
      "payment_intent_data[metadata][user_id]": tk.user_id,
      "payment_intent_data[metadata][request_type]": data.requestType,
    };
    if (client?.email) params["customer_email"] = client.email;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (connectAccountId) {
      headers["Stripe-Account"] = connectAccountId;
      const feeAmount = Math.max(50, Math.min(2500, Math.round(amountCents * 0.005)));
      params["payment_intent_data[application_fee_amount]"] = feeAmount;
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers,
      body: toFormBody(params),
    });
    const json = (await res.json()) as {
      id?: string; url?: string; error?: { message?: string };
    };
    if (!res.ok || !json.url || !json.id) {
      console.error("Portal Stripe checkout creation failed", json);
      throw new Error("Payment service error. Please try again or contact support.");
    }

    await supabaseAdmin.from("invoice_payments").insert({
      user_id: tk.user_id,
      quote_id: quote.id,
      request_type: data.requestType,
      customer_email: client?.email ?? null,
      amount_cents: amountCents,
      currency: "gbp",
      status: "pending",
      stripe_session_id: json.id,
      payment_method: "card",
    });

    return { url: json.url, sessionId: json.id, env, amount };
  });

// Record a manual (cash / bank) deposit. Writes the same shape of
// invoice_payments row the Stripe webhook writes for card deposits, so the
// final invoice's "Less deposit paid" line picks it up automatically.
export const recordManualDeposit = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator(
    z.object({
      quoteId: z.string().min(1).max(128),
      method: z.enum(["cash", "bank"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: quote, error: quoteErr } = await supabase
      .from("quotes")
      .select("id, total, deposit_amount, deposit_percent")
      .eq("id", data.quoteId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (quoteErr) throw quoteErr;
    if (!quote) throw new Error("Quote not found");

    const total = Number(quote.total) || 0;
    const explicit = Number(quote.deposit_amount) || 0;
    const pct = Number(quote.deposit_percent) || 0;
    const deposit =
      explicit > 0
        ? explicit
        : pct > 0
        ? +(total * (pct / 100)).toFixed(2)
        : 0;
    if (deposit <= 0) throw new Error("No deposit configured for this quote");

    // Dedupe: one paid deposit per quote. If a paid deposit row already exists,
    // do not insert another — return the existing one so repeat taps from the
    // client are idempotent and the invoice balance can't be double-subtracted.
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("invoice_payments")
      .select("id, amount_cents, payment_method")
      .eq("quote_id", quote.id)
      .eq("request_type", "deposit")
      .eq("status", "paid")
      .limit(1)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (existing) {
      return { ok: true, amount: (existing.amount_cents ?? 0) / 100, alreadyRecorded: true };
    }

    const { error: insErr } = await supabaseAdmin.from("invoice_payments").insert({
      user_id: context.userId,
      quote_id: quote.id,
      request_type: "deposit",
      status: "paid",
      amount_cents: Math.round(deposit * 100),
      currency: "gbp",
      payment_method: data.method,
      paid_at: new Date().toISOString(),
    });
    if (insErr) throw insErr;

    return { ok: true, amount: deposit };
  });
