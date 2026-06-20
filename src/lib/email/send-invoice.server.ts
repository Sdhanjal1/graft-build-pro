/**
 * Send a branded invoice / balance / receipt email via Resend.
 *
 * Three modes, picked by the caller:
 *   - "receipt": payment already received (Stripe webhook, manual mark-paid).
 *                Header "Payment received", green PAID badge.
 *   - "invoice": final invoice for the full amount, due by `dueDate`.
 *                No PAID badge. Payment instructions in body.
 *   - "balance": balance invoice for total minus deposit already paid.
 *                Shows deposit credited and remaining balance due.
 *
 * Fails gracefully: if RESEND_API_KEY is missing, the domain isn't verified,
 * or Resend returns an error, we log and return `{ ok: false }`. The webhook
 * caller must NEVER let this break the payment flow.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM_DOMAIN = "invoices@quottr.co.uk";

export type SendInvoiceEmailMode = "receipt" | "invoice" | "balance" | "deposit-received";

export type SendInvoiceEmailInput = {
  to: string;
  businessName: string;
  replyTo?: string | null;
  invoiceRef: string;
  /** Headline amount: receipt → amount paid; invoice → total due; balance → balance due; deposit-received → deposit paid. */
  amountFormatted: string;
  /** For receipt/deposit-received: date payment received. For invoice/balance: due date. */
  dateFormatted: string;
  pdfBytes: Uint8Array;
  pdfFilename: string;
  mode: SendInvoiceEmailMode;
  /** For "balance" and "deposit-received" modes — money already paid (deposit). */
  depositPaidFormatted?: string;
  /** For "balance" and "deposit-received" modes — full quote total, shown for context. */
  totalFormatted?: string;
  /** For "deposit-received" mode — remaining balance still owed. */
  balanceDueFormatted?: string;
  /** For "balance" mode — deep link to the portal that auto-opens Stripe Checkout for the balance. */
  payNowUrl?: string;
};

export type SendInvoiceEmailResult = {
  ok: boolean;
  id?: string;
  error?: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  // Workers runtime exposes Buffer via nodejs_compat.
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  // Fallback (browser): chunked btoa to avoid call-stack issues.
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as unknown as number[],
    );
  }
  return btoa(bin);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(businessName: string, eyebrow: string, accent: string, inner: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#F6F4EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0E0E0E;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F4EE;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;">
          <tr><td style="background:#0E0E0E;color:#FFFFFF;padding:24px 28px;">
            <div style="font-size:11px;letter-spacing:.18em;color:${accent};font-weight:700;text-transform:uppercase;">${escapeHtml(eyebrow)}</div>
            <div style="font-size:22px;font-weight:700;margin-top:6px;">${escapeHtml(businessName)}</div>
          </td></tr>
          <tr><td style="padding:28px;">${inner}</td></tr>
          <tr><td style="background:#FAF8F2;padding:16px 28px;text-align:center;font-size:11px;color:#7A7A72;">
            Sent with Quottr · quottr.co.uk
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function receiptHtml(i: SendInvoiceEmailInput): string {
  const inner = `
    <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">Thanks for your payment — we've received <strong>${escapeHtml(i.amountFormatted)}</strong> on ${escapeHtml(i.dateFormatted)}.</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#55554F;">Your itemised invoice <strong>${escapeHtml(i.invoiceRef)}</strong> is attached as a PDF — keep it for your records.</p>
    <div style="background:#ECFDF5;border:1px solid #15803D;border-radius:10px;padding:14px 16px;margin:16px 0;">
      <div style="color:#15803D;font-weight:700;font-size:14px;">PAID · ${escapeHtml(i.amountFormatted)}</div>
      <div style="color:#0E0E0E;font-size:12px;margin-top:4px;">Invoice ${escapeHtml(i.invoiceRef)} · ${escapeHtml(i.dateFormatted)}</div>
    </div>
    <p style="margin:18px 0 0;font-size:13px;line-height:1.55;color:#55554F;">If you have any questions, just reply to this email.</p>
    <p style="margin:18px 0 0;font-size:13px;line-height:1.55;">Thanks,<br/><strong>${escapeHtml(i.businessName)}</strong></p>`;
  return shell(i.businessName, "Payment received", "#C6F33A", inner);
}

function invoiceHtml(i: SendInvoiceEmailInput): string {
  const inner = `
    <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">Your invoice <strong>${escapeHtml(i.invoiceRef)}</strong> is ready. Total due: <strong>${escapeHtml(i.amountFormatted)}</strong>.</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#55554F;">The itemised invoice is attached as a PDF. Payment due by <strong>${escapeHtml(i.dateFormatted)}</strong>.</p>
    <div style="background:#FFF7ED;border:1px solid #C2410C;border-radius:10px;padding:14px 16px;margin:16px 0;">
      <div style="color:#C2410C;font-weight:700;font-size:14px;">DUE · ${escapeHtml(i.amountFormatted)}</div>
      <div style="color:#0E0E0E;font-size:12px;margin-top:4px;">Invoice ${escapeHtml(i.invoiceRef)} · by ${escapeHtml(i.dateFormatted)}</div>
    </div>
    <p style="margin:18px 0 0;font-size:13px;line-height:1.55;color:#55554F;">Payment details are on the attached invoice. Any questions, just reply to this email.</p>
    <p style="margin:18px 0 0;font-size:13px;line-height:1.55;">Thanks,<br/><strong>${escapeHtml(i.businessName)}</strong></p>`;
  return shell(i.businessName, "Invoice", "#C6F33A", inner);
}

function balanceHtml(i: SendInvoiceEmailInput): string {
  const deposit = i.depositPaidFormatted ?? "";
  const total = i.totalFormatted ?? "";
  const inner = `
    <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">Thanks for your deposit. The remaining balance for invoice <strong>${escapeHtml(i.invoiceRef)}</strong> is <strong>${escapeHtml(i.amountFormatted)}</strong>.</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#55554F;">Itemised invoice attached as a PDF. Payment due by <strong>${escapeHtml(i.dateFormatted)}</strong>.</p>
    <div style="background:#FFF7ED;border:1px solid #C2410C;border-radius:10px;padding:14px 16px;margin:16px 0;">
      <div style="color:#C2410C;font-weight:700;font-size:14px;">BALANCE DUE · ${escapeHtml(i.amountFormatted)}</div>
      <div style="color:#0E0E0E;font-size:12px;margin-top:6px;line-height:1.5;">
        Total ${escapeHtml(total)}<br/>
        Less deposit received ${escapeHtml(deposit)} — thank you<br/>
        Invoice ${escapeHtml(i.invoiceRef)} · by ${escapeHtml(i.dateFormatted)}
      </div>
    </div>
    <p style="margin:18px 0 0;font-size:13px;line-height:1.55;color:#55554F;">Payment details are on the attached invoice. Any questions, just reply to this email.</p>
    <p style="margin:18px 0 0;font-size:13px;line-height:1.55;">Thanks,<br/><strong>${escapeHtml(i.businessName)}</strong></p>`;
  return shell(i.businessName, "Balance due", "#C6F33A", inner);
}

function depositReceivedHtml(i: SendInvoiceEmailInput): string {
  const total = i.totalFormatted ?? "";
  const balance = i.balanceDueFormatted ?? "";
  const inner = `
    <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">Thanks — we've received your deposit of <strong>${escapeHtml(i.amountFormatted)}</strong> on ${escapeHtml(i.dateFormatted)}.</p>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#55554F;">Your itemised invoice <strong>${escapeHtml(i.invoiceRef)}</strong> is attached as a PDF. The balance is payable on completion of the work.</p>
    <div style="background:#FFF7ED;border:1px solid #C2410C;border-radius:10px;padding:14px 16px;margin:16px 0;">
      <div style="color:#C2410C;font-weight:700;font-size:14px;">DEPOSIT RECEIVED · ${escapeHtml(i.amountFormatted)}</div>
      <div style="color:#0E0E0E;font-size:12px;margin-top:6px;line-height:1.5;">
        Total ${escapeHtml(total)}<br/>
        Deposit received ${escapeHtml(i.amountFormatted)} — thank you<br/>
        Balance to pay on completion · <strong>${escapeHtml(balance)}</strong>
      </div>
    </div>
    <p style="margin:18px 0 0;font-size:13px;line-height:1.55;color:#55554F;">We'll send the final invoice for the balance once the work is done. Any questions, just reply to this email.</p>
    <p style="margin:18px 0 0;font-size:13px;line-height:1.55;">Thanks,<br/><strong>${escapeHtml(i.businessName)}</strong></p>`;
  return shell(i.businessName, "Deposit received", "#C6F33A", inner);
}

export function buildHtml(i: SendInvoiceEmailInput): string {
  if (i.mode === "receipt") return receiptHtml(i);
  if (i.mode === "balance") return balanceHtml(i);
  if (i.mode === "deposit-received") return depositReceivedHtml(i);
  return invoiceHtml(i);
}

export function buildSubject(i: SendInvoiceEmailInput, fromName: string): string {
  if (i.mode === "receipt") return `Invoice ${i.invoiceRef} from ${fromName} — Paid`;
  if (i.mode === "balance") return `Invoice ${i.invoiceRef} from ${fromName} — Balance ${i.amountFormatted} due`;
  if (i.mode === "deposit-received") {
    const bal = i.balanceDueFormatted ? ` · balance ${i.balanceDueFormatted} due` : "";
    return `Invoice ${i.invoiceRef} from ${fromName} — Deposit received${bal}`;
  }
  return `Invoice ${i.invoiceRef} from ${fromName} — ${i.amountFormatted} due`;
}

export async function sendInvoiceEmail(
  input: SendInvoiceEmailInput,
): Promise<SendInvoiceEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[send-invoice] RESEND_API_KEY not set — skipping email send");
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  // RFC 5321 caps the address at 254 chars; this regex enforces a local-part
  // + "@" + domain with at least one dot in the domain, no spaces. Good
  // enough to catch obvious typos without rejecting legitimate addresses.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!input.to || input.to.length > 254 || !EMAIL_RE.test(input.to)) {
    console.warn("[send-invoice] invalid recipient", input.to);
    return { ok: false, error: "invalid recipient" };
  }

  const fromName = (input.businessName || "Quottr").replace(/[<>"\r\n]/g, "").trim() || "Quottr";
  const from = `${fromName} <${DEFAULT_FROM_DOMAIN}>`;

  const body: Record<string, unknown> = {
    from,
    to: [input.to],
    subject: buildSubject(input, fromName),
    html: buildHtml(input),
    attachments: [
      {
        filename: input.pdfFilename,
        content: bytesToBase64(input.pdfBytes),
      },
    ],
  };
  if (input.replyTo) body.reply_to = input.replyTo;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      console.error("[send-invoice] Resend returned", res.status, json);
      return { ok: false, error: `Resend ${res.status}: ${json?.message ?? "unknown"}` };
    }
    return { ok: true, id: (json as any)?.id };
  } catch (e) {
    console.error("[send-invoice] fetch failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "fetch failed" };
  }
}
