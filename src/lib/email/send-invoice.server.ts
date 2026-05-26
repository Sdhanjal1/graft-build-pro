/**
 * Send a branded paid-invoice email via Resend.
 *
 * Fails gracefully: if RESEND_API_KEY is missing, the domain isn't verified,
 * or Resend returns an error, we log and return `{ ok: false }`. The webhook
 * caller must NEVER let this break the payment flow.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM_DOMAIN = "invoices@quottr.co.uk";

export type SendInvoiceEmailInput = {
  to: string;
  businessName: string;
  replyTo?: string | null;
  invoiceRef: string;
  amountFormatted: string;
  paidDate: string; // e.g. "26 May 2026"
  pdfBytes: Uint8Array;
  pdfFilename: string;
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

function buildHtml(input: SendInvoiceEmailInput): string {
  const { businessName, invoiceRef, amountFormatted, paidDate } = input;
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#F6F4EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0E0E0E;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F4EE;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;">
          <tr><td style="background:#0E0E0E;color:#FFFFFF;padding:24px 28px;">
            <div style="font-size:11px;letter-spacing:.18em;color:#C6F33A;font-weight:700;text-transform:uppercase;">Payment received</div>
            <div style="font-size:22px;font-weight:700;margin-top:6px;">${escapeHtml(businessName)}</div>
          </td></tr>
          <tr><td style="padding:28px;">
            <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">Thanks for your payment — we've received <strong>${escapeHtml(amountFormatted)}</strong> on ${escapeHtml(paidDate)}.</p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.55;color:#55554F;">Your itemised invoice <strong>${escapeHtml(invoiceRef)}</strong> is attached to this email as a PDF — keep it for your records.</p>
            <div style="background:#ECFDF5;border:1px solid #15803D;border-radius:10px;padding:14px 16px;margin:16px 0;">
              <div style="color:#15803D;font-weight:700;font-size:14px;">PAID · ${escapeHtml(amountFormatted)}</div>
              <div style="color:#0E0E0E;font-size:12px;margin-top:4px;">Invoice ${escapeHtml(invoiceRef)} · ${escapeHtml(paidDate)}</div>
            </div>
            <p style="margin:18px 0 0;font-size:13px;line-height:1.55;color:#55554F;">If you have any questions, just reply to this email.</p>
            <p style="margin:18px 0 0;font-size:13px;line-height:1.55;">Thanks,<br/><strong>${escapeHtml(businessName)}</strong></p>
          </td></tr>
          <tr><td style="background:#FAF8F2;padding:16px 28px;text-align:center;font-size:11px;color:#7A7A72;">
            Sent with Quottr · quottr.co.uk
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export async function sendInvoiceEmail(
  input: SendInvoiceEmailInput,
): Promise<SendInvoiceEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[send-invoice] RESEND_API_KEY not set — skipping email send");
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  if (!input.to || !/.+@.+\..+/.test(input.to)) {
    console.warn("[send-invoice] invalid recipient", input.to);
    return { ok: false, error: "invalid recipient" };
  }

  const fromName = (input.businessName || "Quottr").replace(/[<>"\r\n]/g, "").trim() || "Quottr";
  const from = `${fromName} <${DEFAULT_FROM_DOMAIN}>`;

  const body: Record<string, unknown> = {
    from,
    to: [input.to],
    subject: `Invoice ${input.invoiceRef} from ${fromName} — Paid`,
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
