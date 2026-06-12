import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Quottr uses a single platform Stripe account (BYOK secret key) with
 * Stripe Connect to onboard each pro as a Standard connected account.
 * Their client-invoice card payments then flow through their own Stripe
 * balance, Quottr never holds funds.
 */
function platformKey() {
  // Prefer the live BYOK platform key; fall back to the sandbox key so
  // Connect onboarding keeps working in test mode (mirrors the
  // subscription + invoice flows).
  const key =
    process.env.STRIPE_BYOK_SECRET_KEY ?? process.env.STRIPE_SANDBOX_API_KEY;
  if (!key) throw new Error("Stripe Connect platform key not configured");
  return key;
}

function toForm(params: Record<string, string | number | boolean>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.append(k, String(v));
  return body.toString();
}

async function stripe(
  path: string,
  body?: Record<string, string | number | boolean>,
  method: "GET" | "POST" = "POST",
) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${platformKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? toForm(body) : undefined,
  });
  const json = (await res.json()) as any;
  if (!res.ok) {
    console.error("Stripe Connect API error", path, json);
    throw new Error("Payment service error. Please try again or contact support.");
  }
  return json;
}

/** Read the pro's Connect status from their profile (server-authoritative). */
export const getConnectStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled",
      )
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return {
      accountId: data?.stripe_connect_account_id ?? null,
      chargesEnabled: !!data?.stripe_connect_charges_enabled,
      payoutsEnabled: !!data?.stripe_connect_payouts_enabled,
    };
  });

/**
 * Create (or reuse) a Standard Connect account for the pro and return a
 * one-time onboarding link to Stripe's hosted flow.
 */
export const startConnectOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      returnUrl: z.string().url(),
      refreshUrl: z.string().url(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "email, business_name, full_name, stripe_connect_account_id",
      )
      .eq("id", userId)
      .maybeSingle();

    let accountId = profile?.stripe_connect_account_id ?? null;
    if (!accountId) {
      const account = await stripe("/accounts", {
        type: "standard",
        country: "GB",
        email: profile?.email ?? "",
        "business_profile[name]":
          profile?.business_name ?? profile?.full_name ?? "Quottr pro",
        "metadata[user_id]": userId,
      });
      accountId = account.id as string;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", userId);
    }

    const link = await stripe("/account_links", {
      account: accountId,
      refresh_url: data.refreshUrl,
      return_url: data.returnUrl,
      type: "account_onboarding",
    });

    return { url: link.url as string, accountId };
  });

/** Open the Stripe-hosted Express dashboard for the pro's connected account. */
export const openConnectDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("id", userId)
      .maybeSingle();
    const accountId = profile?.stripe_connect_account_id;
    if (!accountId) throw new Error("No connected Stripe account yet");

    const login = await stripe(`/accounts/${accountId}/login_links`);
    return { url: login.url as string };
  });

/** Force a refresh of capability flags from Stripe (used after onboarding return). */
export const refreshConnectStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("id", userId)
      .maybeSingle();
    const accountId = profile?.stripe_connect_account_id;
    if (!accountId) return { chargesEnabled: false, payoutsEnabled: false };

    const account = await stripe(`/accounts/${accountId}`, undefined, "GET");
    const chargesEnabled = !!account.charges_enabled;
    const payoutsEnabled = !!account.payouts_enabled;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("profiles")
      .update({
        stripe_connect_charges_enabled: chargesEnabled,
        stripe_connect_payouts_enabled: payoutsEnabled,
      })
      .eq("id", userId);

    return { chargesEnabled, payoutsEnabled };
  });
