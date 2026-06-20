import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const INK = "#0E0E0E";
const MUTED = "#6B6B66";
const LIME = "#C6F33A";
const BORDER = "#E5E4DD";
const PAID_GREEN = "#15803D";

function formatGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    Number(n) || 0,
  );
}

export type PortalPdfProfile = {
  business_name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  town?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  postcode?: string | null;
  registration_number?: string | null;
  vat_registered?: boolean | null;
  vat_number?: string | null;
  logo_url?: string | null;
  /** Optional precomputed data URL for the trader's logo (preferred — sync render). */
  logoDataUrl?: string | null;
} | null;


export type PortalPdfClient = {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
} | null;

export type PortalPdfQuote = {
  ref?: string | null;
  title: string;
  job_description?: string | null;
  status?: string | null;
  subtotal: number;
  vat_amount: number;
  total: number;
  vat_registered?: boolean | null;
  created_at: string;
  line_items: Array<{ description: string; qty: number; unit_price: number }>;
  /** For invoice variant: when the payment was received */
  paid_at?: string | null;
  /** For invoice variant: e.g. "card" / "bank" */
  payment_method?: string | null;
  /** For invoice variant: Stripe payment intent or session id */
  stripe_payment_intent?: string | null;
};

type Variant = "quote" | "invoice";

function detectImageFormat(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  const head = dataUrl.slice(0, 40).toLowerCase();
  if (head.includes("image/jpeg") || head.includes("image/jpg")) return "JPEG";
  if (head.includes("image/webp")) return "WEBP";
  return "PNG";
}

function header(doc: jsPDF, variant: Variant, quote: PortalPdfQuote, profile: PortalPdfProfile) {
  doc.setFillColor(INK);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 80, "F");

  const businessName = profile?.business_name ?? profile?.full_name ?? "Your tradesperson";
  let textX = 40;

  // Trader logo (if provided as data URL). No Quottr placeholder.
  const logo = profile?.logoDataUrl;
  if (logo) {
    try {
      const size = 44;
      // White rounded plate so logos with dark glyphs stay readable on the black bar
      doc.setFillColor("#FFFFFF");
      doc.roundedRect(40, 18, size, size, 6, 6, "F");
      doc.addImage(logo, detectImageFormat(logo), 44, 22, size - 8, size - 8, undefined, "FAST");
      textX = 40 + size + 14;
    } catch {
      // ignore decode errors and fall back to name-only header
    }
  }

  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(businessName, textX, 38);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#BBBBBB");
  const meta = [
    profile?.registration_number,
    profile?.vat_registered && profile?.vat_number ? `VAT ${profile.vat_number}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  if (meta) doc.text(meta, textX, 54);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor("#FFFFFF");
  const right = doc.internal.pageSize.getWidth() - 40;
  doc.text(variant === "invoice" ? "INVOICE" : "QUOTE", right, 38, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#BBBBBB");
  if (quote.ref) doc.text(quote.ref, right, 54, { align: "right" });
}

function footer(doc: jsPDF, profile: PortalPdfProfile) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(BORDER);
  doc.line(40, h - 50, w - 40, h - 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  const businessName = profile?.business_name ?? profile?.full_name ?? "";
  const left = [businessName, profile?.phone, profile?.email].filter(Boolean).join(" · ");
  doc.text(left, 40, h - 32);

  // "Powered by Quottr" — legible, dark text, right-aligned
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(INK);
  doc.text("Powered by Quottr", w - 40, h - 32, { align: "right" });
}



function traderAddressLines(profile: PortalPdfProfile): string[] {
  if (!profile) return [];
  const lines: string[] = [];
  if (profile.address_line_1) lines.push(profile.address_line_1);
  if (profile.address_line_2) lines.push(profile.address_line_2);
  const cityLine = [profile.town, profile.postcode].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  return lines;
}

export function generatePortalPdf(
  quote: PortalPdfQuote,
  client: PortalPdfClient,
  profile: PortalPdfProfile,
  variant: Variant = "quote",
): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  header(doc, variant, quote, profile);

  let y = 110;
  doc.setTextColor(MUTED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("FROM", 40, y);
  doc.text("BILL TO", w / 2, y);
  doc.text(variant === "invoice" ? "INVOICE DATE" : "QUOTE DATE", w - 40, y, { align: "right" });

  y += 14;
  // FROM (trader)
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(profile?.business_name ?? profile?.full_name ?? "-", 40, y);
  let fromY = y + 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED);
  for (const line of traderAddressLines(profile)) {
    doc.text(line, 40, fromY);
    fromY += 11;
  }
  const fromContact = [profile?.phone, profile?.email].filter(Boolean).join(" · ");
  if (fromContact) { doc.text(fromContact, 40, fromY); fromY += 11; }
  if (profile?.registration_number) { doc.text(`Reg: ${profile.registration_number}`, 40, fromY); fromY += 11; }
  if (profile?.vat_registered && profile?.vat_number) { doc.text(`VAT: ${profile.vat_number}`, 40, fromY); fromY += 11; }

  // BILL TO (client)
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(client?.name ?? "-", w / 2, y);
  let billY = y + 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED);
  if (client?.address) { doc.text(client.address, w / 2, billY); billY += 11; }
  const billContact = [client?.phone, client?.email].filter(Boolean).join(" · ");
  if (billContact) { doc.text(billContact, w / 2, billY); billY += 11; }

  // Date (right-aligned)
  const issueDate = new Date(
    variant === "invoice" && quote.paid_at ? quote.paid_at : quote.created_at,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(INK);
  doc.text(
    issueDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    w - 40,
    y,
    { align: "right" },
  );

  y = Math.max(fromY, billY) + 18;

  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(quote.title, 40, y);

  if (quote.job_description) {
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(MUTED);
    const lines = doc.splitTextToSize(quote.job_description, w - 80);
    doc.text(lines, 40, y);
    y += lines.length * 12;
  }

  y += 14;
  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit", "Amount"]],
    body: quote.line_items.map((li) => {
      const u = (li as any).unit;
      const cat = (li as any).category;
      const isLabour = cat === "labour" || cat === "cis_labour";
      const qtyStr = isLabour ? "" : u === "hours" ? `${li.qty} ${li.qty === 1 ? "hr" : "hrs"}` : u === "days" ? `${li.qty} ${li.qty === 1 ? "day" : "days"}` : String(li.qty);
      const suffix = u === "hours" ? "/hr" : u === "days" ? "/day" : "";
      const unitStr = isLabour ? "" : `${formatGBP(li.unit_price)}${suffix}`;
      return [
        li.description,
        qtyStr,
        unitStr,
        formatGBP(li.qty * li.unit_price),
      ];
    }),
    styles: { font: "helvetica", fontSize: 10, cellPadding: 8, textColor: INK, lineColor: BORDER },
    headStyles: { fillColor: INK, textColor: "#FFFFFF", fontStyle: "bold", fontSize: 9 },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 40, halign: "right" },
      2: { cellWidth: 70, halign: "right" },
      3: { cellWidth: 80, halign: "right" },
    },
    margin: { left: 40, right: 40 },
    theme: "grid",
  });

  let afterTable = (doc as any).lastAutoTable.finalY + 16;
  const boxX = w - 240;
  const boxW = 200;
  const showVat = quote.vat_registered && quote.vat_amount > 0;
  const rows: Array<[string, string]> = [["Subtotal", formatGBP(quote.subtotal)]];
  if (showVat) {
    rows.push(["VAT (20%)", formatGBP(quote.vat_amount)]);
  }
  rows.push([variant === "invoice" ? "Amount paid" : "Total", formatGBP(quote.total)]);

  doc.setDrawColor(BORDER);
  doc.setFillColor("#FAF8F2");
  const boxH = rows.length * 20 + 14;
  doc.roundedRect(boxX, afterTable, boxW, boxH, 6, 6, "FD");

  rows.forEach((r, i) => {
    const yy = afterTable + 18 + i * 20;
    const isTotal = i === rows.length - 1;
    doc.setFont("helvetica", isTotal ? "bold" : "normal");
    doc.setFontSize(isTotal ? 12 : 10);
    doc.setTextColor(isTotal ? INK : MUTED);
    doc.text(r[0], boxX + 12, yy);
    doc.setTextColor(INK);
    doc.text(r[1], boxX + boxW - 12, yy, { align: "right" });
  });

  // VAT not applicable note (HMRC clarity for non-VAT-registered traders)
  if (variant === "invoice" && !showVat) {
    const noteY = afterTable + boxH + 14;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    doc.text("VAT not applicable — supplier is not VAT registered.", 40, noteY);
  }

  // PAID stamp + payment reference (invoice only)
  if (variant === "invoice" && quote.paid_at) {
    const stampX = 40;
    const stampY = afterTable;
    const stampW = 200;
    const stampH = 70;
    doc.setDrawColor(PAID_GREEN);
    doc.setFillColor("#ECFDF5");
    doc.setLineWidth(2);
    doc.roundedRect(stampX, stampY, stampW, stampH, 8, 8, "FD");
    doc.setLineWidth(0.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(PAID_GREEN);
    doc.text("PAID", stampX + 14, stampY + 26);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(INK);
    const paidDate = new Date(quote.paid_at).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
    const rawMethod = (quote.payment_method ?? "card").toLowerCase();
    const method =
      rawMethod === "card"
        ? "Paid by card"
        : rawMethod === "manual" || rawMethod === ""
          ? "Paid"
          : rawMethod === "cash"
            ? "Paid — cash"
            : rawMethod === "bank" || rawMethod === "bank_transfer" || rawMethod === "transfer"
              ? "Paid — bank transfer"
              : "Paid";
    doc.text(`${method}`, stampX + 14, stampY + 42);
    doc.text(`on ${paidDate}`, stampX + 14, stampY + 54);
    if (quote.stripe_payment_intent) {
      doc.setFontSize(7);
      doc.setTextColor(MUTED);
      doc.text(`Ref: ${quote.stripe_payment_intent}`, stampX + 14, stampY + 64);
    } else if (quote.ref) {
      doc.setFontSize(7);
      doc.setTextColor(MUTED);
      doc.text(`Ref: ${quote.ref}`, stampX + 14, stampY + 64);
    }
  }

  footer(doc, profile);
  return doc;
}

export async function downloadPortalPdf(
  quote: PortalPdfQuote,
  client: PortalPdfClient,
  profile: PortalPdfProfile,
  variant: Variant = "quote",
) {
  const doc = generatePortalPdf(quote, client, profile, variant);
  const filename = `${variant === "invoice" ? "Invoice" : "Quote"}-${quote.ref ?? "Quottr"}.pdf`;
  const blob = doc.output("blob");
  const file = new File([blob], filename, { type: "application/pdf" });
  const nav =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { canShare?: (d: ShareData) => boolean })
      : undefined;
  if (nav?.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
