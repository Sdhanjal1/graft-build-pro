import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyUser } from "@/lib/push.server";
// invoice-pdf and email modules are dynamically imported inside the handler
// so any module-load issues in the Worker runtime never break the webhook.

async function notifyTraderOfPayment(opts: {
  userId: string;
  quoteId: string;
  amountCents: number | undefined;
  currency: string;
}) {
  try {
    const { data: quote } = await supabaseAdmin
      .from("quotes")
      .select("title, ref")
      .eq("id", opts.quoteId)
      .maybeSingle();
    const title = quote?.title ?? quote?.ref ?? "Invoice";
    const amount = ((opts.amountCents ?? 0) / 100).toFixed(2);
    const symbol = (opts.currency || "gbp").toLowerCase() === "gbp" ? "£" : "";
    await notifyUser(opts.userId, {
      title: "Payment received 💰",
      body: `${title} · ${symbol}${amount}`,
      url: `/quotes/${opts.quoteId}`,
      tag: `quote-${opts.quoteId}-paid`,
    });
  } catch (e) {
    console.error("[payments/webhook] paid push notify failed", e);
  }
}

async function sendBrandedInvoiceEmail(opts: {
  userId: string;
  quoteId: string;
  customerEmail: string | null | undefined;
  amountCents: number | undefined;
  currency: string;
  paymentIntent: string | null | undefined;
  paymentMethod: string;
}) {
  try {
    if (!opts.customerEmail) {
      return;
    }
    const [{ data: quote }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("quotes")
        .select("id, ref, title, job_description, line_items, subtotal, vat_amount, total, vat_registered, status, created_at, client_id")
        .eq("id", opts.quoteId)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("business_name, full_name, phone, email, town, address_line_1, address_line_2, postcode, registration_number, vat_registered, vat_number")
        .eq("id", opts.userId)
        .maybeSingle(),
    ]);
    if (!quote) {
      console.warn("[payments/webhook] quote not found for invoice email", opts.quoteId);
      return;
    }
    let client: { name: string | null; address: string | null; email: string | null; phone: string | null } | null = null;
    if (quote.client_id) {
      const { data: c } = await supabaseAdmin
        .from("clients")
        .select("name, address, email, phone")
        .eq("id", quote.client_id)
        .maybeSingle();
      client = c;
    }
    const paidAt = new Date().toISOString();
    const { generateInvoicePdfBytes } = await import("@/lib/invoice-pdf.server");
    const { sendInvoiceEmail } = await import("@/lib/email/send-invoice.server");
    const pdfBytes = generateInvoicePdfBytes(
      {
        ref: quote.ref,
        title: quote.title,
        job_description: quote.job_description,
        line_items: Array.isArray(quote.line_items) ? quote.line_items : [],
        subtotal: Number(quote.subtotal) || 0,
        vat_amount: Number(quote.vat_amount) || 0,
        total: Number(quote.total) || 0,
        vat_registered: quote.vat_registered,
        created_at: quote.created_at,
        paid_at: paidAt,
        payment_method: opts.paymentMethod,
        stripe_payment_intent: opts.paymentIntent ?? null,
      },
      client as unknown as Parameters<typeof generateInvoicePdfBytes>[1],
      profile as unknown as Parameters<typeof generateInvoicePdfBytes>[2],
    );
    const businessName =
      profile?.business_name || profile?.full_name || "Your tradesperson";
    const ref = quote.ref ?? opts.quoteId.slice(0, 8);
    const amount = (opts.amountCents ?? Math.round(Number(quote.total) * 100)) / 100;
    const amountFormatted = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: (opts.currency || "gbp").toUpperCase(),
    }).format(amount);
    const paidDate = new Date(paidAt).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    await sendInvoiceEmail({
      to: opts.customerEmail,
      businessName,
      replyTo: profile?.email ?? null,
      invoiceRef: ref,
      amountFormatted,
      paidDate,
      pdfBytes,
      pdfFilename: `Invoice-${ref}.pdf`,
    });
  } catch (e) {
    // NEVER let an email failure break the webhook.
    console.error("[payments/webhook] sendBrandedInvoiceEmail failed", e);
  }
}

// Lovable Payments registers this exact path at enable-time and pre-subscribes
// the relevant events. The ?env=sandbox or ?env=live query string tells us
// which webhook secret to verify against.
function getSecretForEnv(env: string | null) {
  if (env === "live") return process.env.PAYMENTS_WEBHOOK_SECRET;
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
        // Resolve pending invoice_payments rows so reporting stays clean and
        // the customer-facing portal can re-prompt.
        if (
          type === "payment_intent.payment_failed" ||
          type === "checkout.session.expired"
        ) {
          const obj = evt.data?.object ?? {};
          const sessId: string | undefined = obj.id?.startsWith?.("cs_")
            ? obj.id
            : undefined;
          const piId: string | undefined =
            obj.payment_intent ?? (obj.id?.startsWith?.("pi_") ? obj.id : undefined);
          const newStatus =
            type === "checkout.session.expired" ? "expired" : "failed";
          if (sessId) {
            await supabaseAdmin
              .from("invoice_payments")
              .update({ status: newStatus })
              .eq("stripe_session_id", sessId)
              .eq("status", "pending");
          } else if (piId) {
            await supabaseAdmin
              .from("invoice_payments")
              .update({ status: newStatus })
              .eq("stripe_payment_intent", piId)
              .eq("status", "pending");
          }
          return new Response("ok", { status: 200 });
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

        // Flip quote status -> "paid" for full payments. Deposits keep "accepted".
        if (requestType !== "deposit") {
          try {
            await supabaseAdmin
              .from("quotes")
              .update({ status: "paid" })
              .eq("id", quoteId)
              .eq("user_id", userId);
          } catch (e) {
            console.error("[payments/webhook] failed to mark quote paid", e);
          }
        }

        // Best-effort branded invoice email (never throws)
        await sendBrandedInvoiceEmail({
          userId,
          quoteId,
          customerEmail,
          amountCents,
          currency,
          paymentIntent,
          paymentMethod: "card",
        });

        // Best-effort push to the trader (never throws)
        await notifyTraderOfPayment({ userId, quoteId, amountCents, currency });

        return new Response("ok", { status: 200 });
      },

      // Some providers ping with GET for health checks.
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
