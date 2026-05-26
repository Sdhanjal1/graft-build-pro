import {
  generatePortalPdf,
  type PortalPdfQuote,
  type PortalPdfClient,
  type PortalPdfProfile,
} from "./portal-pdf";

/**
 * Generate a branded invoice PDF on the server and return it as a Uint8Array
 * suitable for emailing as an attachment.
 */
export function generateInvoicePdfBytes(
  quote: PortalPdfQuote,
  client: PortalPdfClient,
  profile: PortalPdfProfile,
): Uint8Array {
  const doc = generatePortalPdf(quote, client, profile, "invoice");
  // jsPDF returns an ArrayBuffer when asked for "arraybuffer"
  const ab = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(ab);
}
