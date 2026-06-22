import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyUser } from "@/lib/push.server";
import { logErrorEvent } from "@/lib/ops-errors.server";

async function notifyTraderOfPayment(opts: {
  userId: string;
  quoteId: string;
  amountCents: number | undefined;
  currency: string;
  requestType: string;
}) {
  try {
    const { data: quote } = await supabaseAdmin
      .from("quotes")
      .select("title, ref, client_id")
      .eq("id", opts.quoteId)
      .maybeSingle();
    const jobTitle = quote?.title ?? quote?.ref ?? "Invoice";

    let firstName: string | null = null;
    if (quote?.client_id) {
      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("name")
        .eq("id", quote.client_id)
        .maybeSingle();
      const fullName = (client?.name ?? "").trim();
      firstName = fullName ? fullName.split(/\s+/)[0] : null;
    }
    const who = firstName ?? "Customer";

    const what =
      opts.requestType === "deposit"
        ? "paid the deposit"
        : opts.requestType === "balance"
          ? "paid the balance"
          : "paid";

    const amount = ((opts.amountCents ?? 0) / 100).toFixed(2);
    const symbol = (opts.currency || "gbp").toLowerCase() === "gbp" ? "£" : "";

    await notifyUser(opts.userId, {
      title: `${who} just ${what} · ${symbol}${amount} 💰`,
      body: jobTitle,
      url: `/quotes/${opts.quoteId}`,
      tag: `quote-${opts.quoteId}-${opts.requestType}`,
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
}): Promise<{ status: "sent" | "skipped" | "failed"; to?: string; error?: string }> {
  try {
    const { sendAndRecordInvoiceEmail } = await import("@/lib/invoice-email.server");
    const isDeposit = opts.requestType === "deposit";
    const isBalance = opts.requestType === "balance";
    const outcome = await sendAndRecordInvoiceEmail({
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
    if (outcome.status === "sent") return { status: "sent", to: outcome.to };
    if (outcome.status === "skipped") return { status: "skipped", error: outcome.reason };
    return { status: "failed", error: outcome.error, to: outcome.to };
  } catch (e) {
    // NEVER let an email failure break the webhook.
    console.error("[payments/webhook] sendBrandedInvoiceEmail failed", e);
    return { status: "failed", error: e instanceof Error ? e.message : "Unknown error" };
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
  const stripeEventId: string | undefined = evt.id;
  const eventType: string = evt.type ?? evt.event_type ?? "unknown";
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

  // ===== IDEMPOTENCY GATE =====
  // Stripe retries the same event on any non-2xx response (or our own
  // transient errors). Insert an audit row keyed on the stripe event id;
  // the UNIQUE constraint guarantees only ONE delivery wins the race and
  // proceeds to flip status / send receipt. Duplicates short-circuit here.
  let auditRowId: string | null = null;
  if (stripeEventId) {
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("payment_webhook_audit")
      .insert({
        stripe_event_id: stripeEventId,
        event_type: eventType,
        user_id: userId,
        quote_id: quoteId,
        request_type: requestType,
        amount_cents: amountCents ?? null,
        currency,
        stripe_session_id: sessionId ?? null,
        stripe_payment_intent: paymentIntent ?? null,
      })
      .select("id")
      .maybeSingle();
    if (insertErr) {
      // Unique violation → already processed. Anything else is unexpected.
      if ((insertErr as any).code === "23505") {
        console.log("[payments/webhook] duplicate event, skipping", stripeEventId);
        return;
      }
      console.error("[payments/webhook] audit insert failed", insertErr);
    } else {
      auditRowId = inserted?.id ?? null;
    }
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
    } else if (paymentIntent) {
      // The matching `payment_intent.succeeded` may have landed first and
      // inserted a paid row keyed only on stripe_payment_intent (no session
      // id). Backfill the session id onto that row.
      const { data: existingByPi } = await supabaseAdmin
        .from("invoice_payments")
        .select("id")
        .eq("stripe_payment_intent", paymentIntent)
        .maybeSingle();
      if (existingByPi) {
        await supabaseAdmin
          .from("invoice_payments")
          .update({
            stripe_session_id: sessionId,
            status: "paid",
            paid_at: new Date().toISOString(),
            customer_email: customerEmail ?? null,
            ...(platformFeeCents !== null ? { platform_fee_cents: platformFeeCents } : {}),
          })
          .eq("id", existingByPi.id);
        // Only short-circuit if a receipt was actually sent on a prior
        // event for this payment_intent. Without this check, a PI event
        // that landed first but failed to email (or was skipped for any
        // reason) would leave the customer without a receipt forever.
        const { data: priorReceipt } = await supabaseAdmin
          .from("payment_webhook_audit")
          .select("id")
          .eq("stripe_payment_intent", paymentIntent)
          .eq("receipt_status", "sent")
          .limit(1)
          .maybeSingle();
        if (priorReceipt) return;
        // else fall through to status flip + email + push so the receipt
        // is sent on this delivery instead.
      }
    }
    if (!existing) {
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
      // Only short-circuit if a receipt was actually sent on a prior event
      // for this payment_intent. Without this check, a row that exists but
      // was never emailed (PI event arrived before a session was created,
      // or the prior email send was skipped/failed) would leave the
      // customer without a receipt on every subsequent retry.
      const { data: priorReceipt } = await supabaseAdmin
        .from("payment_webhook_audit")
        .select("id")
        .eq("stripe_payment_intent", paymentIntent)
        .eq("receipt_status", "sent")
        .limit(1)
        .maybeSingle();
      if (priorReceipt) return;
      // else fall through to status flip + email + push so the receipt is
      // sent on this delivery.
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
      // Stamp deposit_paid_at so downstream UI (chaser, invoice screen,
      // quote detail) can read it directly from the quote without joining
      // invoice_payments.
      const depositPaidAt = new Date().toISOString();
      await supabaseAdmin
        .from("quotes")
        .update({ status: "accepted", deposit_paid_at: depositPaidAt })
        .eq("id", quoteId)
        .eq("user_id", userId)
        .in("status", ["pending", "sent"]);
      // Idempotent backfill: if a prior replay already flipped status but
      // didn't stamp deposit_paid_at (older code path), stamp it now.
      await supabaseAdmin
        .from("quotes")
        .update({ deposit_paid_at: depositPaidAt })
        .eq("id", quoteId)
        .eq("user_id", userId)
        .is("deposit_paid_at", null)
        .in("status", ["accepted", "paid", "completed"]);
    } catch (e) {
      console.error("[payments/webhook] failed to mark quote accepted", e);
    }
  } else {
    // "full" or "balance" — both settle the quote. Auto-complete it too,
    // so the trader doesn't have to tap "Job done — send receipt" after
    // Stripe has already confirmed payment. The receipt email + push are
    // sent below; nothing else is left for the trader to do.
    try {
      // Only nudge forward — don't regress `completed` bookkeeping, and
      // don't resurrect a `declined` or already-`paid` quote on a Stripe
      // replay or out-of-order event. Stamp paid_at so the invoice PDF
      // "PAID" stamp + paid-date label fire (portal-pdf reads quote.paid_at).
      const paidAtIso = new Date().toISOString();
      await supabaseAdmin
        .from("quotes")
        .update({ status: "paid", completed_at: paidAtIso, paid_at: paidAtIso })
        .eq("id", quoteId)
        .eq("user_id", userId)
        .in("status", ["pending", "sent", "accepted", "overdue"]);
      // Idempotent backfill: if a prior replay already flipped status=paid
      // but didn't stamp completed_at (older code path), stamp it now.
      await supabaseAdmin
        .from("quotes")
        .update({ completed_at: paidAtIso })
        .eq("id", quoteId)
        .eq("user_id", userId)
        .eq("status", "paid")
        .is("completed_at", null);
      // Idempotent backfill for paid_at (older rows / replays where the
      // forward-flip already ran without paid_at). Only sets when null,
      // so replays don't churn the timestamp.
      await supabaseAdmin
        .from("quotes")
        .update({ paid_at: paidAtIso })
        .eq("id", quoteId)
        .eq("user_id", userId)
        .eq("status", "paid")
        .is("paid_at", null);
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
  const emailOutcome = await sendBrandedInvoiceEmail({
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

  // Stamp the audit row with the receipt outcome so the trader UI can show
  // "Receipt sent · 14 Jun 16:02 · alex@example.com".
  if (auditRowId) {
    try {
      await supabaseAdmin
        .from("payment_webhook_audit")
        .update({
          receipt_status: emailOutcome.status,
          receipt_sent_at: emailOutcome.status === "sent" ? new Date().toISOString() : null,
          receipt_to: emailOutcome.to ?? null,
          receipt_error: emailOutcome.error ?? null,
        })
        .eq("id", auditRowId);
    } catch (e) {
      console.error("[payments/webhook] failed to stamp audit row", e);
    }
  }

  // Best-effort push to the trader (never throws)
  await notifyTraderOfPayment({ userId, quoteId, amountCents, currency, requestType });
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
