import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const INK = "#0E0E0E";
const MUTED = "#6B6B66";
const LIME = "#C6F33A";
const BORDER = "#E5E4DD";

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
  registration_number?: string | null;
  vat_registered?: boolean | null;
  vat_number?: string | null;
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
};

type Variant = "quote" | "invoice";

function header(doc: jsPDF, variant: Variant, quote: PortalPdfQuote, profile: PortalPdfProfile) {
  doc.setFillColor(INK);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 80, "F");

  doc.setFillColor(LIME);
  doc.roundedRect(40, 22, 38, 38, 8, 8, "F");
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Q", 52, 49);

  const businessName = profile?.business_name ?? profile?.full_name ?? "Your tradesperson";
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(businessName, 92, 38);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#BBBBBB");
  const meta = [
    profile?.registration_number,
    profile?.vat_registered && profile?.vat_number ? `VAT ${profile.vat_number}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  if (meta) doc.text(meta, 92, 54);

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
  doc.text("Generated with Quottr", w - 40, h - 32, { align: "right" });
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
  doc.text("BILL TO", 40, y);
  doc.text(variant === "invoice" ? "INVOICE DATE" : "QUOTE DATE", w - 40, y, { align: "right" });

  y += 14;
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(client?.name ?? "-", 40, y);
  const issueDate = new Date(quote.created_at);
  doc.setFont("helvetica", "normal");
  doc.text(
    issueDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    w - 40,
    y,
    { align: "right" },
  );

  if (client?.address) {
    y += 13;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    doc.text(client.address, 40, y);
  }
  if (client?.phone || client?.email) {
    y += 12;
    doc.text([client?.phone, client?.email].filter(Boolean).join("  ·  "), 40, y);
  }

  y += 28;
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
    body: quote.line_items.map((li) => [
      li.description,
      String(li.qty),
      formatGBP(li.unit_price),
      formatGBP(li.qty * li.unit_price),
    ]),
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
  if (showVat) rows.push(["VAT (20%)", formatGBP(quote.vat_amount)]);
  rows.push([variant === "invoice" ? "Amount due" : "Total", formatGBP(quote.total)]);

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
