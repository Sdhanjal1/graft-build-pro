import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Pick the right Stripe + webhook secret pair based on environment.
// Lovable Payments provisions sandbox creds immediately; live creds appear
// after the user claims their account in the Payments tab.
function getStripeEnv() {
  const liveKey = process.env.STRIPE_API_KEY;
  if (liveKey) {
    return { key: liveKey, env: "live" as const };
  }
  const sandboxKey = process.env.STRIPE_SANDBOX_API_KEY;
  if (!sandboxKey) {
    throw new Error("Stripe is not configured. Enable Payments in Lovable.");
  }
  return { key: sandboxKey, env: "sandbox" as const };
}

function toFormBody(params: Record<string, string | number>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.append(k, String(v));
  return body.toString();
}

export const createInvoiceCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

    const params: Record<string, string | number> = {
      mode: "payment",
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": data.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": amountCents,
      "line_items[0][price_data][product_data][name]":
        `${data.quoteRef} — ${data.title}`.slice(0, 250),
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

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: toFormBody(params),
    });

    const json = (await res.json()) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };
    if (!res.ok || !json.url || !json.id) {
      console.error("Stripe checkout creation failed", json);
      throw new Error(json.error?.message ?? "Failed to create Stripe checkout");
    }

    // Log a pending payment row so the dashboard can show it.
    const { supabase } = context;
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
