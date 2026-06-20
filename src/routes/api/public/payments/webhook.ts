import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { handlePaidEvent, handleFailedEvent } from "@/lib/payments-webhook-shared.server";

// Lovable Payments registers this exact path at enable-time and pre-subscribes
// the relevant events. The ?env=sandbox or ?env=live query string tells us
// which webhook secret to verify against.
function getSecretForEnv(env: string | null) {
  if (env === "live") return process.env.PAYMENTS_LIVE_WEBHOOK_SECRET;
  return process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET;
}

// If a webhook arrives for an env whose secret we never configured, drop it
// cleanly with a 200 so the provider doesn't retry for days. Logged so we
// notice if live events start arriving before we wire up live keys.
function dropUnconfiguredEnv(env: string | null) {
  console.warn("[payments/webhook] no secret configured for env, dropping", env);
  return new Response("ok (env not configured)", { status: 200 });
}

// Parse Stripe-style "stripe-signature: t=...,v1=...,v1=..." header.
function parseStripeSig(header: string) {
  const parts = header.split(",").map((p) => p.trim());
  let t = "";
  const v1: string[] = [];
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k === "t") t = v;
    if (k === "v1" && v) v1.push(v);
  }
  return { t, v1 };
}

function verify(rawBody: string, sigHeader: string | null, secret: string) {
  if (!sigHeader) return false;
  // Stripe-native scheme
  if (sigHeader.includes("t=") && sigHeader.includes("v1=")) {
    const { t, v1 } = parseStripeSig(sigHeader);
    if (!t || v1.length === 0) return false;
    const ts = parseInt(t, 10);
    if (isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
    const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
    return v1.some((sig) => {
      try {
        return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
      } catch {
        return false;
      }
    });
  }
  // Plain HMAC fallback
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sigHeader, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = url.searchParams.get("env");
        const secret = getSecretForEnv(env);
        if (!secret) {
          // Sandbox-only deployment receiving a live event (or vice versa) —
          // ack with 200 so Stripe doesn't retry for 3 days.
          return dropUnconfiguredEnv(env);
        }

        const rawBody = await request.text();
        const sig =
          request.headers.get("stripe-signature") ??
          request.headers.get("x-webhook-signature") ??
          request.headers.get("x-lovable-signature");

        if (!verify(rawBody, sig, secret)) {
          console.warn("[payments/webhook] invalid signature");
          const { logErrorEvent } = await import("@/lib/ops-errors.server");
          await logErrorEvent({
            context: "payments.webhook.invalid_signature",
            message: `env=${env ?? "?"}`,
          });
          return new Response("Invalid signature", { status: 401 });
        }

        let evt: any;
        try {
          evt = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const type: string = evt.type ?? evt.event_type ?? "";

        // ===== SUBSCRIPTION LIFECYCLE =====
        if (
          type === "customer.subscription.created" ||
          type === "customer.subscription.updated" ||
          type === "customer.subscription.deleted"
        ) {
          const subObj = evt.data?.object ?? {};
          const userIdMeta: string | undefined = subObj.metadata?.user_id;
          const item = subObj.items?.data?.[0];
          const periodStart = item?.current_period_start ?? subObj.current_period_start;
          const periodEnd = item?.current_period_end ?? subObj.current_period_end;
          const status = type === "customer.subscription.deleted" ? "canceled" : subObj.status;
          const hasPm = Boolean(subObj.default_payment_method);

          // Find user by metadata first, fall back to customer id lookup.
          let userId = userIdMeta;
          if (!userId && subObj.customer) {
            const { data: row } = await supabaseAdmin
              .from("subscriptions")
              .select("user_id")
              .eq("stripe_customer_id", subObj.customer)
              .maybeSingle();
            userId = row?.user_id;
          }
          if (!userId) {
            console.warn("[payments/webhook] subscription event without user_id", subObj.id);
            return new Response("ok", { status: 200 });
          }

          // Upsert (not just update): the user's row is normally seeded by the
          // handle_new_user_subscription trigger, but if that ever failed to
          // run we'd otherwise silently drop real Stripe events. user_id has a
          // unique constraint, so onConflict keeps a single row per user.
          await supabaseAdmin
            .from("subscriptions")
            .upsert(
              {
                user_id: userId,
                status,
                stripe_subscription_id: subObj.id,
                stripe_customer_id: subObj.customer,
                price_id: item?.price?.lookup_key ?? item?.price?.id ?? null,
                product_id: item?.price?.product ?? null,
                current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
                current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
                trial_end: subObj.trial_end
                  ? new Date(subObj.trial_end * 1000).toISOString()
                  : undefined,
                cancel_at_period_end: Boolean(subObj.cancel_at_period_end),
                has_payment_method: hasPm,
                environment: env === "live" ? "live" : "sandbox",
              },
              { onConflict: "user_id" },
            );

          return new Response("ok", { status: 200 });
        }

        // ===== INVOICE PAYMENT EVENTS (subscription billing) =====
        if (type === "invoice.payment_succeeded" || type === "invoice.payment_failed") {
          const inv = evt.data?.object ?? {};
          const subId: string | undefined = inv.subscription;
          const customerId: string | undefined = inv.customer;
          if (subId || customerId) {
            const patch = type === "invoice.payment_succeeded"
              ? { status: "active", has_payment_method: true }
              : { status: "past_due" };
            const query = supabaseAdmin.from("subscriptions").update(patch);
            if (subId) {
              await query.eq("stripe_subscription_id", subId);
            } else if (customerId) {
              await query.eq("stripe_customer_id", customerId);
            }
          }
          return new Response("ok", { status: 200 });
        }

        // ===== SUBSCRIPTION CHECKOUT COMPLETED (card added during trial) =====
        // The user came back from Stripe Checkout (mode=subscription) after
        // attaching a card. Flip has_payment_method immediately so the UI
        // (TrialBanner, BillingSection) stops nagging them — we can't rely on
        // subscription.default_payment_method because Stripe often leaves it
        // null on trialing subs until the first invoice runs.
        if (type === "checkout.session.completed") {
          const session = evt.data?.object ?? {};
          const isSubscription =
            session.mode === "subscription" ||
            session.mode === "setup" ||
            session.metadata?.kind === "quottr_subscription";
          if (isSubscription) {
            const customerId: string | undefined = session.customer;
            const userIdMeta: string | undefined = session.metadata?.user_id;
            if (userIdMeta) {
              await supabaseAdmin
                .from("subscriptions")
                .update({ has_payment_method: true })
                .eq("user_id", userIdMeta);
            } else if (customerId) {
              await supabaseAdmin
                .from("subscriptions")
                .update({ has_payment_method: true })
                .eq("stripe_customer_id", customerId);
            }
            return new Response("ok", { status: 200 });
          }
          // fall through, mode=payment is handled below
        }

        // ===== FAILED / EXPIRED ONE-OFF INVOICE PAYMENTS =====
        if (
          type === "payment_intent.payment_failed" ||
          type === "checkout.session.expired"
        ) {
          await handleFailedEvent(evt);
          return new Response("ok", { status: 200 });
        }

        // ===== ONE-OFF INVOICE PAYMENTS =====
        const isPaid =
          type === "checkout.session.completed" ||
          type === "payment_intent.succeeded" ||
          type === "transaction.completed";

        if (!isPaid) {
          return new Response("ok", { status: 200 });
        }

        await handlePaidEvent(evt);
        return new Response("ok", { status: 200 });
      },

      // Some providers ping with GET for health checks.
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
