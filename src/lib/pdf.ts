import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatGBP, formatLineQty, unitPriceSuffix, userProfile, type Quote, type Client } from "./user-data";

type Variant = "quote" | "invoice";

const INK = "#0E0E0E";
const MUTED = "#6B6B66";
const LIME = "#C6F33A";
const BORDER = "#E5E4DD";

function header(doc: jsPDF, variant: Variant, quote: Quote) {
  // Black bar
  doc.setFillColor(INK);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 80, "F");

  // Brand badge (Q monogram)
  doc.setFillColor(LIME);
  doc.roundedRect(40, 22, 38, 38, 8, 8, "F");
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Q", 52, 49);

  // Business name + meta
  doc.setTextColor("#FFFFFF");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(userProfile.business_name, 92, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#BBBBBB");
  const meta = [userProfile.registration_number, userProfile.vat_registered ? `VAT ${userProfile.vat_number}` : null]
    .filter(Boolean)
    .join("  ·  ");
  doc.text(meta, 92, 54);

  // Doc type + ref on the right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor("#FFFFFF");
  const right = doc.internal.pageSize.getWidth() - 40;
  doc.text(variant === "invoice" ? "INVOICE" : "QUOTE", right, 38, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#BBBBBB");
  doc.text(quote.ref, right, 54, { align: "right" });
}

function footer(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(BORDER);
  doc.line(40, h - 50, w - 40, h - 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text(`${userProfile.business_name} · ${userProfile.phone} · ${userProfile.email}`, 40, h - 32);
  doc.text("Generated with Quottr", w - 40, h - 32, { align: "right" });
}

export function generateQuotePdf(quote: Quote, client: Client | undefined, variant: Variant = "quote"): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  header(doc, variant, quote);

  // Client + dates
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
  const issueDate = new Date(variant === "invoice" ? (quote.invoiced_at ?? quote.created_at) : quote.created_at);
  doc.setFont("helvetica", "normal");
  doc.text(issueDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), w - 40, y, { align: "right" });

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

  // Job title
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

  // Line items table
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

  // Totals box
  // @ts-ignore
  let afterTable = (doc as any).lastAutoTable.finalY + 16;
  const boxX = w - 240;
  const boxW = 200;
  const showVat = userProfile.vat_registered && quote.vat_amount > 0;
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

  afterTable += boxH + 24;

  // Payment / terms
  if (afterTable > doc.internal.pageSize.getHeight() - 160) {
    doc.addPage();
    afterTable = 60;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(MUTED);
  doc.text("PAYMENT", 40, afterTable);
  afterTable += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(INK);
  const payLines = [
    `Bank: ${userProfile.bank_name}`,
    `Account name: ${userProfile.bank_account_name}`,
    `Sort code: ${userProfile.sort_code}   Account no: ${userProfile.account_number}`,
    `Reference: ${quote.ref}`,
    userProfile.payment_terms,
  ];
  payLines.forEach((l) => {
    doc.text(l, 40, afterTable);
    afterTable += 13;
  });

  footer(doc);
  return doc;
}

export async function downloadOrShareQuotePdf(quote: Quote, client: Client | undefined, variant: Variant = "quote") {
  const doc = generateQuotePdf(quote, client, variant);
  const filename = `${variant === "invoice" ? "Invoice" : "Quote"}-${quote.ref}.pdf`;
  const blob = doc.output("blob");

  // Try native share with file (iOS Safari, Android Chrome)
  const file = new File([blob], filename, { type: "application/pdf" });
  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { canShare?: (d: ShareData) => boolean }) : undefined;
  if (nav?.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({
        files: [file],
        title: filename,
        text: `${variant === "invoice" ? "Invoice" : "Quote"} ${quote.ref} from ${userProfile.business_name}`,
      });
      return { shared: true };
    } catch (e) {
      // user cancelled or share failed, fall through to download
      if ((e as DOMException)?.name === "AbortError") return { shared: false, cancelled: true };
    }
  }

  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { shared: false };
}
