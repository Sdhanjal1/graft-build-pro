import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Reuse the same env-picking logic as invoice checkout: prefer live key
// when claimed, otherwise sandbox.
function getStripeEnv() {
  const liveKey = process.env.STRIPE_API_KEY;
  if (liveKey) return { key: liveKey, env: "live" as const };
  const sandboxKey = process.env.STRIPE_SANDBOX_API_KEY;
  if (!sandboxKey) throw new Error("Stripe is not configured");
  return { key: sandboxKey, env: "sandbox" as const };
}

function toFormBody(params: Record<string, string | number>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.append(k, String(v));
  return body.toString();
}

async function stripe(
  path: string,
  key: string,
  body?: Record<string, string | number>,
  method: "GET" | "POST" = "POST",
) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? toFormBody(body) : undefined,
  });
  const json = (await res.json()) as any;
  if (!res.ok) {
    console.error("Stripe API error", path, json);
    throw new Error(json?.error?.message ?? `Stripe ${path} failed`);
  }
  return json;
}

const PRICE_LOOKUP = "quottr_monthly";

/** Get current subscription row for the user (server-authoritative). */
export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return { subscription: data };
  });

/**
 * Create a Stripe Checkout session in `setup` mode so the user can attach a
 * payment method to their trial without being charged today. On success
 * Stripe redirects back; the webhook attaches the PM and creates the
 * subscription that starts billing at trial_end.
 */
export const startSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { key, env } = getStripeEnv();
    const { supabase, userId } = context;

    // Load profile email + existing customer id (if any)
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, business_name, full_name")
      .eq("id", userId)
      .maybeSingle();

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, trial_end")
      .eq("user_id", userId)
      .maybeSingle();

    let customerId = sub?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe("/customers", key, {
        email: profile?.email ?? "",
        name: profile?.business_name ?? profile?.full_name ?? "",
        "metadata[user_id]": userId,
      });
      customerId = customer.id as string;
    }

    // Resolve price by lookup_key so the same code works in sandbox + live.
    const priceList = await stripe(
      `/prices?lookup_keys[]=${encodeURIComponent(PRICE_LOOKUP)}&active=true&limit=1`,
      key,
      undefined,
      "GET",
    );
    const priceId = priceList.data?.[0]?.id as string | undefined;
    if (!priceId) throw new Error("Quottr subscription price not found");

    // Compute remaining trial days from our DB so users don't get a fresh
    // 14 days every time they add a card mid-trial.
    const trialEnd = sub?.trial_end ? new Date(sub.trial_end).getTime() : null;
    const now = Date.now();
    const trialPeriodDays = trialEnd
      ? Math.max(1, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)))
      : 14;

    const sessionParams: Record<string, string | number> = {
      mode: "subscription",
      customer: customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": 1,
      "subscription_data[trial_period_days]": trialPeriodDays,
      "subscription_data[trial_settings][end_behavior][missing_payment_method]":
        "cancel",
      "subscription_data[metadata][user_id]": userId,
      payment_method_collection: "always",
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
      "metadata[user_id]": userId,
      "metadata[kind]": "quottr_subscription",
    };

    const session = await stripe("/checkout/sessions", key, sessionParams);

    // Stash the customer id eagerly so we can open the portal even before
    // the first webhook lands.
    await supabaseAdmin
      .from("subscriptions")
      .update({ stripe_customer_id: customerId, environment: env })
      .eq("user_id", userId);

    return { url: session.url as string, env };
  });

/** Open Stripe Billing Portal for the signed-in user. */
export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ returnUrl: z.string().url() }))
  .handler(async ({ data, context }) => {
    const { key } = getStripeEnv();
    const { supabase, userId } = context;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!sub?.stripe_customer_id) throw new Error("No billing account yet");
    const portal = await stripe("/billing_portal/sessions", key, {
      customer: sub.stripe_customer_id,
      return_url: data.returnUrl,
    });
    return { url: portal.url as string };
  });
