import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyUser } from "@/lib/push.server";
import { logErrorEvent } from "@/lib/ops-errors.server";

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
      title: "Paid. That's in the bank. 💰",
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
  requestType: string;
  depositPaidCents?: number;
}) {
  try {
    const { sendAndRecordInvoiceEmail } = await import("@/lib/invoice-email.server");
    // Deposits get a dedicated "deposit-received" email so the customer sees
    // an orange "deposit received · balance £Y due" badge instead of a green
    // PAID-IN-FULL receipt. Balance payments use a receipt with the prior
    // deposit credited so the body reads "balance £Y collected · deposit £X
    // already credited · total £T" rather than re-claiming the full total.
    const isDeposit = opts.requestType === "deposit";
    const isBalance = opts.requestType === "balance";
    await sendAndRecordInvoiceEmail({
      userId: opts.userId,
      quoteId: opts.quoteId,
      customerEmailOverride: opts.customerEmail ?? null,
      amountCents: opts.amountCents,
      currency: opts.currency,
      paymentIntent: opts.paymentIntent ?? null,
      paymentMethod: opts.paymentMethod,
      mode: isDeposit ? "deposit-received" : "receipt",
      depositPaidCents: isDeposit
        ? opts.amountCents
        : isBalance
        ? opts.depositPaidCents
        : undefined,
    });
  } catch (e) {
    // NEVER let an email failure break the webhook.
    console.error("[payments/webhook] sendBrandedInvoiceEmail failed", e);
  }
}

/**
 * Process a paid Stripe event (checkout.session.completed,
 * payment_intent.succeeded, transaction.completed). Idempotent via
 * upsert-by-session-id. Safe to call from both the platform webhook and the
 * connected-account webhook — identifiers come from event metadata.
 */
export async function handlePaidEvent(evt: any): Promise<void> {
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
  const platformFeeCents: number | null =
    typeof obj.application_fee_amount === "number" ? obj.application_fee_amount : null;
  const currency: string = (obj.currency ?? "gbp").toLowerCase();

  // Subscription checkout sessions land here too (mode=subscription).
  // The subscription.* events handle the row; skip invoice insert.
  if (metadata.kind === "quottr_subscription") {
    return;
  }

  if (!quoteId || !userId) {
    console.warn("[payments/webhook] missing quote_id/user_id in metadata", { type: evt.type, sessionId });
    return;
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
          ...(platformFeeCents !== null ? { platform_fee_cents: platformFeeCents } : {}),
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
        platform_fee_cents: platformFeeCents,
      });
    }
  } else if (paymentIntent) {
    // No checkout session id (e.g. payment_intent.succeeded retry). Dedup
    // on stripe_payment_intent so Stripe retries don't create multiple
    // paid rows or trigger duplicate invoice emails.
    const { data: existingPi } = await supabaseAdmin
      .from("invoice_payments")
      .select("id")
      .eq("stripe_payment_intent", paymentIntent)
      .maybeSingle();
    if (existingPi) {
      await supabaseAdmin
        .from("invoice_payments")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          customer_email: customerEmail ?? null,
          ...(platformFeeCents !== null ? { platform_fee_cents: platformFeeCents } : {}),
        })
        .eq("id", existingPi.id);
      // Early return: the original session already fired email + push when
      // it was first marked paid, so don't re-fire on retries.
      return;
    }
    await supabaseAdmin.from("invoice_payments").insert({
      user_id: userId,
      quote_id: quoteId,
      request_type: requestType,
      customer_email: customerEmail ?? null,
      amount_cents: amountCents ?? 0,
      currency,
      status: "paid",
      stripe_payment_intent: paymentIntent,
      payment_method: "card",
      paid_at: new Date().toISOString(),
      platform_fee_cents: platformFeeCents,
    });
  } else {
    // No Stripe identifier on the event — refuse to insert rather than
    // create an undeduplicable paid row. Stripe usually retries with the id
    // attached. Better to miss the row than to double-credit / double-email.
    console.error("[payments/webhook] paid event with no session_id and no payment_intent — skipping insert", {
      type: evt.type,
      quoteId,
      userId,
    });
    await logErrorEvent({
      userId,
      context: `payments.webhook.no_stripe_id.${evt.type ?? "unknown"}`,
      message: `Paid event had no session_id and no payment_intent`,
    });
    return;
  }


  // Flip quote status -> "paid" for full/balance payments; deposits imply acceptance.
  if (requestType === "deposit") {
    try {
      // Only nudge forward — don't regress a quote that's already accepted,
      // paid, completed, or declined (Stripe replays the same event).
      await supabaseAdmin
        .from("quotes")
        .update({ status: "accepted" })
        .eq("id", quoteId)
        .eq("user_id", userId)
        .in("status", ["pending", "sent"]);
    } catch (e) {
      console.error("[payments/webhook] failed to mark quote accepted", e);
    }
  } else {
    // "full" or "balance" — both settle the quote.
    try {
      // Only nudge forward — don't regress `completed` bookkeeping, and
      // don't resurrect a `declined` or already-`paid` quote on a Stripe
      // replay or out-of-order event.
      await supabaseAdmin
        .from("quotes")
        .update({ status: "paid" })
        .eq("id", quoteId)
        .eq("user_id", userId)
        .in("status", ["pending", "sent", "accepted", "overdue"]);
    } catch (e) {
      console.error("[payments/webhook] failed to mark quote paid", e);
    }
  }

  // For balance receipts, look up the already-credited deposit so the
  // email's receipt body shows "balance £Y collected · deposit £X credited
  // · total £T" rather than re-claiming the full total.
  let depositPaidCentsForEmail: number | undefined;
  if (requestType === "balance") {
    try {
      const { data: rows } = await supabaseAdmin
        .from("invoice_payments")
        .select("amount_cents")
        .eq("quote_id", quoteId)
        .eq("request_type", "deposit")
        .eq("status", "paid");
      depositPaidCentsForEmail = (rows ?? []).reduce(
        (acc, r) => acc + (Number(r.amount_cents) || 0),
        0,
      );
    } catch (e) {
      console.error("[payments/webhook] failed to sum prior deposits for balance receipt", e);
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
    requestType,
    depositPaidCents: depositPaidCentsForEmail,
  });

  // Best-effort push to the trader (never throws)
  await notifyTraderOfPayment({ userId, quoteId, amountCents, currency });
}

/**
 * Process a failed/expired Stripe event
 * (payment_intent.payment_failed, checkout.session.expired). Updates any
 * pending invoice_payments row to "failed" / "expired".
 */
export async function handleFailedEvent(evt: any): Promise<void> {
  const type: string = evt.type ?? evt.event_type ?? "";
  const obj = evt.data?.object ?? {};
  const sessId: string | undefined = obj.id?.startsWith?.("cs_") ? obj.id : undefined;
  const piId: string | undefined =
    obj.payment_intent ?? (obj.id?.startsWith?.("pi_") ? obj.id : undefined);
  const newStatus = type === "checkout.session.expired" ? "expired" : "failed";
  const userIdMeta: string | undefined = obj.metadata?.user_id;
  const failureMessage: string =
    obj.last_payment_error?.message ??
    obj.failure_message ??
    `Stripe event ${type}`;
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
  await logErrorEvent({
    userId: userIdMeta ?? null,
    context: `payments.webhook.${type}`,
    message: failureMessage,
  });
}
