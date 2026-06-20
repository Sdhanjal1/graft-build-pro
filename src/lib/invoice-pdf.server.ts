import {
  generatePortalPdf,
  fetchLogoDataUrl,
  type PortalPdfQuote,
  type PortalPdfClient,
  type PortalPdfProfile,
} from "./portal-pdf";

/**
 * Generate a branded invoice PDF on the server and return it as a Uint8Array
 * suitable for emailing as an attachment. Best-effort embeds the trader's
 * uploaded logo when profile.logo_url is set.
 */
export async function generateInvoicePdfBytes(
  quote: PortalPdfQuote,
  client: PortalPdfClient,
  profile: PortalPdfProfile,
): Promise<Uint8Array> {
  const logoDataUrl = profile?.logoDataUrl ?? (await fetchLogoDataUrl(profile?.logo_url));
  const profileWithLogo: PortalPdfProfile = profile ? { ...profile, logoDataUrl } : profile;
  const doc = generatePortalPdf(quote, client, profileWithLogo, "invoice");
  const ab = doc.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(ab);
}
