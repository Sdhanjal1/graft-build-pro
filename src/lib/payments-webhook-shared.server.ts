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
        line_items: (Array.isArray(quote.line_items) ? quote.line_items : []) as Parameters<typeof generateInvoicePdfBytes>[0]["line_items"],
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
    });
  } else {
    await supabaseAdmin.from("invoice_payments").insert({
      user_id: userId,
      quote_id: quoteId,
      request_type: requestType,
      customer_email: customerEmail ?? null,
      amount_cents: amountCents ?? 0,
      currency,
      status: "paid",
      payment_method: "card",
      paid_at: new Date().toISOString(),
    });
  }

  // Flip quote status -> "paid" for full payments; deposits imply acceptance.
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
}
