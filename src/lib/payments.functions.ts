import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveSubscription } from "@/lib/require-active-subscription";
import { DEFAULT_DEPOSIT_FRACTION } from "@/lib/payment-timing";
import { computeInvoiceAmounts } from "@/lib/invoice-amounts";


// Quottr's Stripe platform key. When the pro has completed Connect
// onboarding, client-invoice payments are routed to their connected
// account via `Stripe-Account` so funds go straight to them.
//
// Sandbox is opt-in ONLY when the build was produced with the explicit
// preview flag AND a sandbox key is present. Every other code path —
// unset flag, unrecognised value, missing sandbox key, production build —
// falls through to live. Live is the fail-safe default; we never silently
// route real customers to test keys.
function getStripeEnv() {
  const flag = import.meta.env.VITE_PAYMENTS_MODE;
  const sandboxKey = process.env.STRIPE_SANDBOX_API_KEY;
  if (flag === "sandbox" && sandboxKey) {
    return { key: sandboxKey, env: "sandbox" as const };
  }
  const liveKey =
    process.env.STRIPE_BYOK_SECRET_KEY ?? process.env.STRIPE_LIVE_API_KEY;
  if (!liveKey) throw new Error("Stripe is not configured");
  return { key: liveKey, env: "live" as const };
}

// Origins we'll accept as success/cancel return URLs for both pro-facing
// and customer-portal checkout flows. Prevents open-redirect via Stripe.
const ALLOWED_RETURN_ORIGINS = new Set([
  "https://quottr.co.uk",
  "https://www.quottr.co.uk",
  "https://graft-build-pro.lovable.app",
  "https://id-preview--e4be6907-c837-4e5e-9461-63fadfdad91e.lovable.app",
  "https://e4be6907-c837-4e5e-9461-63fadfdad91e.lovableproject.com",
  "http://localhost:8080",
  "https://localhost:8080",
]);

function assertAllowedReturnUrl(url: string) {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`Invalid return URL (unparseable): ${url}`);
  }
  if (!ALLOWED_RETURN_ORIGINS.has(u.origin)) {
    throw new Error(`Return URL origin not allowed: ${u.origin}`);
  }
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
    // Restrict success/cancel URLs to known Quottr origins so Stripe can't
    // be used as an open redirect via a forged checkout request.
    assertAllowedReturnUrl(data.successUrl);
    assertAllowedReturnUrl(data.cancelUrl);

    const { key, env } = getStripeEnv();
    const amountCents = Math.round(data.amount * 100);
    if (amountCents < 30) {
      throw new Error("Quote total is too low to request payment (minimum 30p).");
    }

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
    if (!connectAccountId) {
      throw new Error(
        "Set up payments before you can take payment — finish connecting your bank in Settings.",
      );
    }

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
      //
      // Intentional behaviour: the fee is computed on `amountCents` for
      // each Stripe checkout independently. For a deposit-then-balance
      // quote that means we charge 0.5% on the deposit AND 0.5% on the
      // balance — net the same percentage as a single full charge, but
      // the per-charge floor (50p) can apply twice. For very small
      // deposits this means the deposit-then-balance flow can take
      // slightly more in fees than a single upfront charge. Documented
      // here so a future reader doesn't "fix" this into a one-off fee.
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
    // RLS already scopes invoice_payments to the owning user; the explicit
    // user_id filter is defence-in-depth so a future RLS change can't
    // silently leak rows across traders.
    const { data: rows, error } = await supabase
      .from("invoice_payments")
      .select("*")
      .eq("quote_id", data.quoteId)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { payments: rows ?? [] };
  });

// ---------- Public: customer pays from the portal (token-auth) ----------
// Stripe-hosted Checkout. We deliberately omit `payment_method_types` so
// Stripe surfaces every method enabled on the account, including Apple Pay
// and Google Pay (auto-detected per browser).

export const createPortalCheckout = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      token: z.string().min(8).max(128),
      requestType: z.enum(["deposit", "full", "balance"]),
      returnOrigin: z.string().url(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { key, env } = getStripeEnv();

    // Prevent open-redirect: only trust known Quottr origins for the
    // post-checkout return URL. Anything else falls back to production.
    const returnOrigin = ALLOWED_RETURN_ORIGINS.has(data.returnOrigin)
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

    // Idempotency: if there is an existing pending session for this
    // (quote, requestType) from the last 24h, reuse it so repeat taps from
    // the customer don't pile up orphan pending invoice_payments rows.
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existingPending } = await supabaseAdmin
      .from("invoice_payments")
      .select("stripe_session_id, amount_cents, created_at")
      .eq("quote_id", quote.id)
      .eq("request_type", data.requestType)
      .eq("status", "pending")
      .not("stripe_session_id", "is", null)
      .gte("created_at", dayAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const total = Number(quote.total) || 0;
    const totalCents = Math.round(total * 100);
    let amount = total;
    let amountCents = totalCents;
    if (data.requestType === "deposit") {
      const explicit = Number(quote.deposit_amount) || 0;
      const pct = Number(quote.deposit_percent) || 0;
      amount = explicit > 0
        ? explicit
        : pct > 0
        ? +(total * (pct / 100)).toFixed(2)
        : +(total * DEFAULT_DEPOSIT_FRACTION).toFixed(2);
      amountCents = Math.round(amount * 100);
    } else if (data.requestType === "balance") {
      // Balance is total − sum of paid deposit rows, computed server-side
      // from the same `invoice_payments` rows the invoice/email read. The
      // client never sends the amount.
      if (quote.payment_timing !== "deposit_then_balance") {
        throw new Error("This quote isn't a deposit-then-balance quote.");
      }
      const { data: depositRows } = await supabaseAdmin
        .from("invoice_payments")
        .select("amount_cents")
        .eq("quote_id", quote.id)
        .eq("request_type", "deposit")
        .eq("status", "paid");
      const depositPaidCents = (depositRows ?? []).reduce(
        (acc, r) => acc + (Number(r.amount_cents) || 0),
        0,
      );
      const amounts = computeInvoiceAmounts({
        mode: "balance",
        totalCents,
        depositPaidCents,
      });
      if (!amounts.ok) {
        throw new Error(
          depositPaidCents <= 0
            ? "No deposit recorded for this quote yet."
            : "Balance is already settled.",
        );
      }
      amountCents = amounts.headlineCents;
      amount = +(amountCents / 100).toFixed(2);
    }
    if (amountCents < 30) {
      throw new Error("Quote total is too low to request payment (minimum 30p).");
    }


    if (existingPending?.stripe_session_id && existingPending.amount_cents === amountCents) {
      // Reuse the existing Checkout Session URL.
      const sessionId = existingPending.stripe_session_id as string;
      // We need the full URL — fetch it from Stripe so the client can redirect.
      try {
        const { data: profileForReuse } = await supabaseAdmin
          .from("profiles")
          .select("stripe_connect_account_id, stripe_connect_charges_enabled")
          .eq("id", tk.user_id)
          .maybeSingle();
        // If onboarding lapsed since the pending session was created, don't
        // hand back a link that would land on the platform account.
        if (
          !profileForReuse?.stripe_connect_charges_enabled ||
          !profileForReuse?.stripe_connect_account_id
        ) {
          throw new Error("This business hasn't finished setting up payments yet.");
        }
        const reuseHeaders: Record<string, string> = {
          Authorization: `Bearer ${key}`,
          "Stripe-Account": profileForReuse.stripe_connect_account_id,
        };
        const sessRes = await fetch(
          `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
          { headers: reuseHeaders },
        );
        const sess = (await sessRes.json()) as { url?: string; status?: string };
        if (sessRes.ok && sess.url && sess.status === "open") {
          return { url: sess.url, sessionId, env, amount };
        }
      } catch (e) {
        // Re-throw onboarding errors; swallow transient Stripe lookup errors.
        if (e instanceof Error && e.message.includes("setting up payments")) throw e;
        console.warn("Failed to reuse pending portal session, creating new", e);
      }
    }

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
    if (!connectAccountId) {
      throw new Error("This business hasn't finished setting up payments yet.");
    }

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

// ---------- Public: customer pays from the CLIENT HUB portal (/portal/c/$code) ----------
// Mirrors `createPortalCheckout` but authenticates via the client's portal_code
// + quoteId combination instead of a quote-specific token. The client hub
// shows all quotes for a customer and previously had a pay button that did
// nothing — this powers that flow so deposits/upfront amounts actually charge.
export const createPortalCheckoutFromCode = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      code: z.string().min(8).max(64),
      quoteId: z.string().uuid(),
      requestType: z.enum(["deposit", "full", "balance"]),
      returnOrigin: z.string().url(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { key, env } = getStripeEnv();

    const returnOrigin = ALLOWED_RETURN_ORIGINS.has(data.returnOrigin)
      ? data.returnOrigin
      : "https://quottr.co.uk";

    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, user_id, portal_active, portal_issued_at, email")
      .eq("portal_code", data.code)
      .maybeSingle();
    if (!client || !client.portal_active) throw new Error("Portal not available");
    if (client.portal_issued_at) {
      const ageDays = (Date.now() - new Date(client.portal_issued_at).getTime()) / 86_400_000;
      if (ageDays > 90) throw new Error("This portal link has expired. Please ask for a new one.");
    }

    const { data: quote } = await supabaseAdmin
      .from("quotes")
      .select("id, ref, title, total, deposit_amount, deposit_percent, payment_timing, status")
      .eq("id", data.quoteId)
      .eq("client_id", client.id)
      .eq("portal_visible", true)
      .maybeSingle();
    if (!quote) throw new Error("Quote not found");
    if (quote.status === "paid") throw new Error("This quote is already paid");

    const total = Number(quote.total) || 0;
    const totalCents = Math.round(total * 100);
    let amount = total;
    let amountCents = totalCents;
    if (data.requestType === "deposit") {
      const explicit = Number(quote.deposit_amount) || 0;
      const pct = Number(quote.deposit_percent) || 0;
      amount = explicit > 0
        ? explicit
        : pct > 0
        ? +(total * (pct / 100)).toFixed(2)
        : +(total * DEFAULT_DEPOSIT_FRACTION).toFixed(2);
      amountCents = Math.round(amount * 100);
    } else if (data.requestType === "balance") {
      // Mirror the createPortalCheckout balance branch: total − sum of paid
      // deposit rows, computed server-side from the same invoice_payments
      // rows the invoice/email read. The client hub never sends the amount.
      if (quote.payment_timing !== "deposit_then_balance") {
        throw new Error("This quote isn't a deposit-then-balance quote.");
      }
      const { data: depositRows } = await supabaseAdmin
        .from("invoice_payments")
        .select("amount_cents")
        .eq("quote_id", quote.id)
        .eq("request_type", "deposit")
        .eq("status", "paid");
      const depositPaidCents = (depositRows ?? []).reduce(
        (acc, r) => acc + (Number(r.amount_cents) || 0),
        0,
      );
      const amounts = computeInvoiceAmounts({
        mode: "balance",
        totalCents,
        depositPaidCents,
      });
      if (!amounts.ok) {
        throw new Error(
          depositPaidCents <= 0
            ? "No deposit recorded for this quote yet."
            : "Balance is already settled.",
        );
      }
      amountCents = amounts.headlineCents;
      amount = +(amountCents / 100).toFixed(2);
    }
    if (amountCents < 30) {
      throw new Error("Quote total is too low to request payment (minimum 30p).");
    }

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existingPending } = await supabaseAdmin
      .from("invoice_payments")
      .select("stripe_session_id, amount_cents")
      .eq("quote_id", quote.id)
      .eq("request_type", data.requestType)
      .eq("status", "pending")
      .not("stripe_session_id", "is", null)
      .gte("created_at", dayAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_charges_enabled")
      .eq("id", client.user_id)
      .maybeSingle();
    const connectAccountId =
      profile?.stripe_connect_charges_enabled && profile?.stripe_connect_account_id
        ? profile.stripe_connect_account_id
        : null;
    if (!connectAccountId) {
      throw new Error("This business hasn't finished setting up payments yet.");
    }

    if (existingPending?.stripe_session_id && existingPending.amount_cents === amountCents) {
      try {
        const sessRes = await fetch(
          `https://api.stripe.com/v1/checkout/sessions/${existingPending.stripe_session_id}`,
          { headers: { Authorization: `Bearer ${key}`, "Stripe-Account": connectAccountId } },
        );
        const sess = (await sessRes.json()) as { url?: string; status?: string };
        if (sessRes.ok && sess.url && sess.status === "open") {
          return { url: sess.url, sessionId: existingPending.stripe_session_id, env, amount };
        }
      } catch (e) {
        console.warn("Failed to reuse pending hub-portal session, creating new", e);
      }
    }

    const ref = quote.ref ?? quote.id.slice(0, 8);
    const params: Record<string, string | number> = {
      mode: "payment",
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": "gbp",
      "line_items[0][price_data][unit_amount]": amountCents,
      "line_items[0][price_data][product_data][name]":
        `${ref}, ${quote.title}`.slice(0, 250),
      success_url: `${returnOrigin}/portal/c/${data.code}?paid=1`,
      cancel_url: `${returnOrigin}/portal/c/${data.code}?cancelled=1`,
      "metadata[quote_id]": quote.id,
      "metadata[quote_ref]": ref,
      "metadata[user_id]": client.user_id,
      "metadata[request_type]": data.requestType,
      "payment_intent_data[metadata][quote_id]": quote.id,
      "payment_intent_data[metadata][user_id]": client.user_id,
      "payment_intent_data[metadata][request_type]": data.requestType,
    };
    if (client.email) params["customer_email"] = client.email;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Account": connectAccountId,
    };
    const feeAmount = Math.max(50, Math.min(2500, Math.round(amountCents * 0.005)));
    params["payment_intent_data[application_fee_amount]"] = feeAmount;

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers,
      body: toFormBody(params),
    });
    const json = (await res.json()) as {
      id?: string; url?: string; error?: { message?: string };
    };
    if (!res.ok || !json.url || !json.id) {
      console.error("Hub-portal Stripe checkout creation failed", json);
      throw new Error("Payment service error. Please try again or contact support.");
    }

    await supabaseAdmin.from("invoice_payments").insert({
      user_id: client.user_id,
      quote_id: quote.id,
      request_type: data.requestType,
      customer_email: client.email ?? null,
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

// Reverse a manually-recorded cash/bank deposit. Only deletes rows the trader
// entered themselves — never card/Stripe rows, which represent real settled
// funds. Idempotent: if nothing matches, returns ok with deleted: 0.
export const removeManualDeposit = createServerFn({ method: "POST" })
  .middleware([requireActiveSubscription])
  .inputValidator(z.object({ quoteId: z.string().min(1).max(128) }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: quote, error: quoteErr } = await supabase
      .from("quotes")
      .select("id")
      .eq("id", data.quoteId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (quoteErr) throw quoteErr;
    if (!quote) throw new Error("Quote not found");

    // Belt-and-braces user_id filter in addition to the ownership check above,
    // so a stray invoice_payments row owned by another user could never be
    // collateral damage from a manual deposit reversal.
    const { error: delErr, count } = await supabaseAdmin
      .from("invoice_payments")
      .delete({ count: "exact" })
      .eq("quote_id", quote.id)
      .eq("user_id", context.userId)
      .eq("request_type", "deposit")
      .eq("status", "paid")
      .in("payment_method", ["cash", "bank"]);
    if (delErr) throw delErr;

    return { ok: true, deleted: count ?? 0 };
  });
