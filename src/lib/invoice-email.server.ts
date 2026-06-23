/**
 * Server-only helper that sends a branded invoice / balance / receipt email
 * for a quote and records the result on the quotes row. Used by:
 *   - the Stripe webhook (always mode="receipt")
 *   - the manual mark-paid handler (always mode="receipt")
 *   - the "Job done" action (mode="invoice" | "balance" | "receipt")
 *   - the manual resend button on the invoice screen (mode inferred from
 *     quote status when not passed: paid → receipt, else → invoice)
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateInvoicePdfBytes } from "@/lib/invoice-pdf.server";
import { sendInvoiceEmail, type SendInvoiceEmailMode } from "@/lib/email/send-invoice.server";
import { computeInvoiceAmounts } from "@/lib/invoice-amounts";

export type InvoiceEmailOutcome =
  | { status: "sent"; to: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string; to?: string };

export async function sendAndRecordInvoiceEmail(opts: {
  userId: string;
  quoteId: string;
  /** Optional override (e.g. from Stripe customer_details.email). Falls back to client.email. */
  customerEmailOverride?: string | null;
  /** Headline amount in cents. For balance mode this is the BALANCE due (total − deposit paid). */
  amountCents?: number;
  /** For balance mode: deposit already paid, in cents. Shown in the email body. */
  depositPaidCents?: number;
  currency?: string;
  paymentIntent?: string | null;
  paymentMethod?: string;
  /** Email mode. If omitted, inferred from quote.status: 'paid' → receipt, else → invoice. */
  mode?: SendInvoiceEmailMode;
}): Promise<InvoiceEmailOutcome> {
  const currency = (opts.currency || "gbp").toLowerCase();
  try {
    const [{ data: quote }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from("quotes")
        .select("id, ref, title, job_description, line_items, subtotal, vat_amount, total, vat_registered, status, created_at, client_id, invoice_due_date")
        .eq("id", opts.quoteId)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("business_name, full_name, phone, email, town, address_line_1, address_line_2, postcode, registration_number, vat_registered, vat_number, logo_url, stripe_connect_charges_enabled, bank_account_name, bank_name, sort_code, account_number")
        .eq("id", opts.userId)
        .maybeSingle(),
    ]);

    if (!quote) {
      return { status: "failed", error: "Quote not found" };
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

    const to = (opts.customerEmailOverride || client?.email || "").trim();
    if (!to) {
      await supabaseAdmin
        .from("quotes")
        .update({
          invoice_email_status: "skipped",
          invoice_email_error: "No customer email on file",
          invoice_email_to: null,
        })
        .eq("id", opts.quoteId);
      return { status: "skipped", reason: "No customer email on file" };
    }

    // Resolve mode — default to receipt when the quote is paid, else an
    // invoice for the full total. Callers (Job done, Stripe webhook) pass
    // mode explicitly. Refuse to silently infer when a partial payment
    // amount is provided: a deposit payment with mode omitted would
    // otherwise be emailed as a full invoice, which is a user-facing bug.
    if (!opts.mode && typeof opts.amountCents === "number") {
      const errMsg =
        "sendAndRecordInvoiceEmail requires explicit `mode` when `amountCents` is provided — refusing to infer deposit/balance/receipt from quote.status alone";
      console.error("[invoice-email]", errMsg, { quoteId: opts.quoteId, amountCents: opts.amountCents });
      return { status: "failed", error: errMsg };
    }
    const mode: SendInvoiceEmailMode = opts.mode ?? (quote.status === "paid" ? "receipt" : "invoice");

    const paidAt = new Date().toISOString();
    const pdfBytes = await generateInvoicePdfBytes(
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
        // Only stamp paid_at when the FULL invoice is settled — receipts.
        // Deposit-received, invoice, and balance PDFs must render as unpaid
        // (the renderer keys "PAID" stamp off paid_at).
        paid_at: mode === "receipt" ? paidAt : null,
        payment_method: opts.paymentMethod ?? "card",
        stripe_payment_intent: opts.paymentIntent ?? null,
      },
      client as unknown as Parameters<typeof generateInvoicePdfBytes>[1],
      profile as unknown as Parameters<typeof generateInvoicePdfBytes>[2],
    );

    const businessName = profile?.business_name || profile?.full_name || "Your tradesperson";
    const ref = quote.ref ?? opts.quoteId.slice(0, 8);

    const totalAmount = Number(quote.total) || 0;
    const totalCents = Math.round(totalAmount * 100);
    const amounts = computeInvoiceAmounts({
      mode,
      totalCents,
      amountCents: opts.amountCents,
      depositPaidCents: opts.depositPaidCents,
    });
    if (!amounts.ok) {
      console.error("[invoice-email] refusing send", {
        quoteId: opts.quoteId,
        mode,
        totalCents,
        amountCents: opts.amountCents,
        depositPaidCents: opts.depositPaidCents,
        reason: amounts.reason,
      });
      return { status: "skipped", reason: amounts.reason };
    }
    const fmt = (n: number) => new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(n);
    const amountFormatted = fmt(amounts.headlineCents / 100);
    const totalFormatted = fmt(amounts.totalCents / 100);
    const depositPaidFormatted = fmt(amounts.depositPaidCents / 100);
    const balanceDueFormatted = fmt(amounts.balanceDueCents / 100);

    // Date label: receipt/deposit-received → date paid; invoice/balance → due date.
    // Fallback anchors on the quote's created_at (not send-time) so a quote
    // sent weeks after creation doesn't email a "due in 14 days" date that's
    // contractually wrong. Only fall back to now() if created_at is missing.
    const dueFallbackAnchor = quote.created_at
      ? new Date(quote.created_at).getTime()
      : Date.now();
    const dueDateIso = quote.invoice_due_date
      ?? new Date(dueFallbackAnchor + 14 * 24 * 60 * 60 * 1000).toISOString();
    const dateForLabel = (mode === "receipt" || mode === "deposit-received") ? paidAt : dueDateIso;
    const dateFormatted = new Date(dateForLabel).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // For balance emails, deep-link the "Pay online" button to the portal
    // so the customer can settle the outstanding balance in one tap.
    // Falls back to bank-only copy when no live token exists or the trader
    // hasn't enabled card payments.
    let payNowUrl: string | undefined;
    if (mode === "balance" && (profile as any)?.stripe_connect_charges_enabled) {
      const { data: tokenRow } = await supabaseAdmin
        .from("quote_portal_tokens")
        .select("token, expires_at")
        .eq("quote_id", opts.quoteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (tokenRow?.token) {
        const stillLive =
          !tokenRow.expires_at || new Date(tokenRow.expires_at).getTime() > Date.now();
        if (stillLive) {
          payNowUrl = `https://quottr.co.uk/portal/${tokenRow.token}?pay=balance`;
        }
      }
    }

    const result = await sendInvoiceEmail({
      to,
      businessName,
      replyTo: profile?.email ?? null,
      invoiceRef: ref,
      amountFormatted,
      dateFormatted,
      pdfBytes,
      pdfFilename: `Invoice-${ref}.pdf`,
      mode,
      depositPaidFormatted,
      totalFormatted,
      balanceDueFormatted,
      payNowUrl,
    });

    if (result.ok) {
      await supabaseAdmin
        .from("quotes")
        .update({
          invoice_email_status: "sent",
          invoice_email_sent_at: new Date().toISOString(),
          invoice_email_error: null,
          invoice_email_to: to,
        })
        .eq("id", opts.quoteId);
      return { status: "sent", to };
    }

    const errMsg = result.error || "Email provider returned an error";
    await supabaseAdmin
      .from("quotes")
      .update({
        invoice_email_status: "failed",
        invoice_email_error: errMsg,
        invoice_email_to: to,
      })
      .eq("id", opts.quoteId);
    return { status: "failed", error: errMsg, to };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unexpected error";
    console.error("[invoice-email] sendAndRecord failed", e);
    try {
      await supabaseAdmin
        .from("quotes")
        .update({
          invoice_email_status: "failed",
          invoice_email_error: errMsg,
        })
        .eq("id", opts.quoteId);
    } catch {
      // swallow secondary failure
    }
    return { status: "failed", error: errMsg };
  }
}
