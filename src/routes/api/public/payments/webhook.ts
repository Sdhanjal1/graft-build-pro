import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Lovable Payments registers this exact path at enable-time and pre-subscribes
// the relevant events. The ?env=sandbox or ?env=live query string tells us
// which webhook secret to verify against.
function getSecretForEnv(env: string | null) {
  if (env === "live") return process.env.PAYMENTS_WEBHOOK_SECRET;
  return process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET;
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
          console.error("[payments/webhook] missing secret for env", env);
          return new Response("Server not configured", { status: 500 });
        }

        const rawBody = await request.text();
        const sig =
          request.headers.get("stripe-signature") ??
          request.headers.get("x-webhook-signature") ??
          request.headers.get("x-lovable-signature");

        if (!verify(rawBody, sig, secret)) {
          console.warn("[payments/webhook] invalid signature");
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

          await supabaseAdmin
            .from("subscriptions")
            .update({
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
            })
            .eq("user_id", userId);

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

        // ===== SETUP MODE CHECKOUT (card added during trial) =====
        if (type === "checkout.session.completed") {
          const session = evt.data?.object ?? {};
          if (session.mode === "setup") {
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


        // ===== ONE-OFF INVOICE PAYMENTS (existing behaviour) =====
        const isPaid =
          type === "checkout.session.completed" ||
          type === "payment_intent.succeeded" ||
          type === "transaction.completed";

        if (!isPaid) {
          return new Response("ok", { status: 200 });
        }

        // Try to extract identifiers from whichever shape the gateway sends.
        const obj = evt.data?.object ?? evt.data ?? evt.object ?? evt;
        const sessionId: string | undefined =
          obj.id?.startsWith?.("cs_") ? obj.id : obj.checkout_session_id ?? obj.session_id;
        const paymentIntent: string | undefined =
          obj.payment_intent ?? obj.payment_intent_id ?? (obj.id?.startsWith?.("pi_") ? obj.id : undefined);
        const metadata = obj.metadata ?? obj.payment_intent_metadata ?? {};
        const quoteId: string | undefined = metadata.quote_id;
        const userId: string | undefined = metadata.user_id;
        const requestType: string = metadata.request_type ?? "full";
        const customerEmail: string | undefined =
          obj.customer_details?.email ?? obj.customer_email ?? obj.receipt_email;
        const amountCents: number | undefined =
          obj.amount_total ?? obj.amount_received ?? obj.amount;
        const currency: string = (obj.currency ?? "gbp").toLowerCase();

        // Subscription checkout sessions land here too (mode=subscription).
        // The subscription.* events handle the row; skip invoice insert.
        if (metadata.kind === "quottr_subscription") {
          return new Response("ok", { status: 200 });
        }

        if (!quoteId || !userId) {
          console.warn("[payments/webhook] missing quote_id/user_id in metadata", { type, sessionId });
          return new Response("ok", { status: 200 });
        }

        // Upsert by session id if we have one (created during checkout).
        if (sessionId) {
          const { data: existing } = await supabaseAdmin
            .from("invoice_payments")
            .select("id")
            .eq("stripe_session_id", sessionId)
            .maybeSingle();

          if (existing) {
            await supabaseAdmin
              .from("invoice_payments")
              .update({
                status: "paid",
                stripe_payment_intent: paymentIntent ?? null,
                paid_at: new Date().toISOString(),
                customer_email: customerEmail ?? null,
              })
              .eq("id", existing.id);
          } else {
            await supabaseAdmin.from("invoice_payments").insert({
              user_id: userId,
              quote_id: quoteId,
              request_type: requestType,
              customer_email: customerEmail ?? null,
              amount_cents: amountCents ?? 0,
              currency,
              status: "paid",
              stripe_session_id: sessionId,
              stripe_payment_intent: paymentIntent ?? null,
              payment_method: "card",
              paid_at: new Date().toISOString(),
            });
          }
        } else {
          await supabaseAdmin.from("invoice_payments").insert({
            user_id: userId,
            quote_id: quoteId,
            request_type: requestType,
            customer_email: customerEmail ?? null,
            amount_cents: amountCents ?? 0,
            currency,
            status: "paid",
            stripe_payment_intent: paymentIntent ?? null,
            payment_method: "card",
            paid_at: new Date().toISOString(),
          });
        }

        return new Response("ok", { status: 200 });
      },

      // Some providers ping with GET for health checks.
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
