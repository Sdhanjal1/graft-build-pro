import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Mirror payments.functions.ts: sandbox is opt-in ONLY when the build was
// produced with the explicit preview flag AND a sandbox key is present.
// Every other path (unset flag, missing sandbox key, production build)
// falls through to live. Live is the fail-safe default so a sandbox flag
// in a published build can't silently route real subscription customers
// to test keys, and a missing live key in preview can't be papered over.
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

// Origins we'll accept as success/cancel return URLs for the subscription
// checkout flow — same allowlist used in payments.functions.ts to prevent
// open-redirect via a forged subscription checkout request.
const ALLOWED_RETURN_ORIGINS = new Set([
  "https://quottr.co.uk",
  "https://www.quottr.co.uk",
  "https://graft-build-pro.lovable.app",
  "https://id-preview--e4be6907-c837-4e5e-9461-63fadfdad91e.lovable.app",
]);

function assertAllowedReturnUrl(url: string) {
  try {
    const u = new URL(url);
    if (!ALLOWED_RETURN_ORIGINS.has(u.origin)) {
      throw new Error("Return URL origin not allowed");
    }
  } catch {
    throw new Error("Invalid return URL");
  }
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
    throw new Error("Payment service error. Please try again or contact support.");
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
    // Restrict success/cancel URLs to known Quottr origins so Stripe can't
    // be used as an open redirect via a forged subscription checkout.
    assertAllowedReturnUrl(data.successUrl);
    assertAllowedReturnUrl(data.cancelUrl);

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
