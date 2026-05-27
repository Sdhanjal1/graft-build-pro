import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { MessageCircle, Mail, Sparkles, Loader2, Copy, Check, CheckCircle2, Clock, BellOff, Bell, ArrowRight } from "lucide-react";
import { ensurePortalToken } from "@/lib/messages.functions";

import { toast } from "sonner";
import { feedback } from "@/lib/feedback";
import { buildQuoteWhatsAppMessage, getQuote, waLink, userProfile, setQuoteAutoChase } from "@/lib/user-data";

type SentVia = "sms" | "email" | "wa";
const CHANNEL_LABEL: Record<SentVia, string> = { sms: "SMS", email: "Email", wa: "WhatsApp" };
const ORDINAL = ["first", "second", "third", "fourth", "fifth"];

type Props = {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  quoteRef: string;
  quoteTitle: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  /** Optional fallback wa.me link kept for back-compat; the dialog now builds its own. */
  whatsappHref?: string;
  /** When set, dialog skips token creation and uses this client portal_code with "updated link" copy. */
  updatedLinkPortalCode?: string;
};

export function SendQuoteDialog({
  open, onClose, quoteId, quoteRef, quoteTitle,
  customerName, customerPhone, customerEmail,
  updatedLinkPortalCode,
}: Props) {

  const ensureToken = useServerFn(ensurePortalToken);
  const [busy, setBusy] = useState<null | "sms" | "email" | "wa">(null);
  const [copied, setCopied] = useState(false);
  const [sentVia, setSentVia] = useState<SentVia | null>(null);
  const initialAutoChase = (() => {
    const q = getQuote(quoteId);
    return q?.auto_chase_enabled ?? userProfile.auto_chase_enabled ?? true;
  })();
  const [autoChase, setAutoChase] = useState<boolean>(initialAutoChase);

  const toggleAutoChase = () => {
    const next = !autoChase;
    setAutoChase(next);
    setQuoteAutoChase(quoteId, next);
    feedback("tap");
  };

  const handleClose = () => {
    setSentVia(null);
    onClose();
  };



// Always share via the branded short domain, keeps WhatsApp/email links tidy.
const SHARE_ORIGIN = "https://quottr.co.uk";
const shortClientPortalUrl = (portal_code: string) => `${SHARE_ORIGIN}/q/${portal_code}`;
const shortQuotePortalUrl = (token: string) => `${SHARE_ORIGIN}/q/${token}`;



  if (!open) return null;

  const firstName = customerName?.split(" ")[0] ?? "there";

  const portalUrl = (token: string) => shortQuotePortalUrl(token);


  const handleQuottr = async () => {
    try {
      setBusy("sms");
      let url: string;
      let text: string;
      if (updatedLinkPortalCode) {
        url = shortClientPortalUrl(updatedLinkPortalCode);
        text = `Hi ${firstName}, here's an updated link for your quote: ${url}`;
      } else {
        const { token } = await ensureToken({ data: { quoteId, channel: "sms" } });
        url = portalUrl(token);
        text = `Hi ${firstName}, your quote ${quoteRef} for ${quoteTitle} is ready. View, ask questions and approve here: ${url}`;

      }
      const digits = (customerPhone ?? "").replace(/\D/g, "");
      const smsHref = digits
        ? `sms:${digits}?&body=${encodeURIComponent(text)}`
        : `sms:?&body=${encodeURIComponent(text)}`;
      // Try native share first (better on iOS where sms: works inconsistently from web)
      if (navigator.share) {
        try {
          await navigator.share({ title: `Quote ${quoteRef}`, text, url });
          feedback("success");
          if (updatedLinkPortalCode) onClose();
          else setSentVia("sms");
          return;
        } catch { /* user cancelled or unsupported - fall through */ }
      }
      window.location.href = smsHref;
      toast.success(`Sent to ${customerName ?? firstName} via SMS`);
      feedback("success");
      if (updatedLinkPortalCode) onClose();
      else setSentVia("sms");
    } catch (e) {
      feedback("error");
      toast.error(e instanceof Error ? e.message : "Could not create portal link");
    } finally {
      setBusy(null);
    }
  };

  const handleEmail = async () => {
    try {
      setBusy("email");
      let url: string;
      let subject: string;
      let body: string;
      if (updatedLinkPortalCode) {
        url = shortClientPortalUrl(updatedLinkPortalCode);
        subject = `Updated link for quote ${quoteRef}`;
        body = `Hi ${firstName}, here's an updated link for your quote: ${url}`;
      } else {
        const { token } = await ensureToken({ data: { quoteId, channel: "email" } });
        url = portalUrl(token);
        subject = `Your quote ${quoteRef}, ${quoteTitle}`;
        body = `Hi ${firstName},\n\nYour quote is ready to view. You can review it, ask questions and approve from your secure portal:\n\n${url}\n\nThanks.`;

      }
      const mailHref = `mailto:${customerEmail ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailHref;
      toast.success(`Sent to ${customerName ?? firstName} via Email`);
      feedback("success");
      if (updatedLinkPortalCode) onClose();
      else setSentVia("email");
    } catch (e) {
      feedback("error");
      toast.error(e instanceof Error ? e.message : "Could not create portal link");
    } finally {
      setBusy(null);
    }
  };

  const copyPortalLink = async () => {
    try {
      const { token } = await ensureToken({ data: { quoteId, channel: "manual" } });
      const url = portalUrl(token);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      feedback("success");
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      feedback("error");
      toast.error(e instanceof Error ? e.message : "Could not copy link");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/60" onClick={onClose}>
      <div className="w-full max-w-md mx-auto bg-paper rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="h-1 w-10 bg-ink/20 rounded-full mx-auto mb-4" />
        <h3 className="text-2xl">Send quote</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Choose how to send the quote to {firstName}.
        </p>

        <div className="space-y-2.5">
          {/* Option 1, Quottr (recommended) */}
          <button
            onClick={handleQuottr}
            disabled={busy !== null}
            className="w-full text-left rounded-2xl p-4 bg-lime text-ink flex items-start gap-3 disabled:opacity-60"
          >
            <div className="h-10 w-10 rounded-full bg-ink text-lime flex items-center justify-center shrink-0">
              {busy === "sms" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm">Send via Quottr</p>
                <span className="text-[9px] uppercase tracking-widest font-bold bg-ink text-lime rounded-full px-2 py-0.5">
                  Recommended
                </span>
              </div>
              <p className="text-[11px] text-ink/70 mt-0.5">
                Customer gets an SMS with a portal link. They approve, ask questions and you reply inside Quottr, separate from your personal WhatsApp.
              </p>
            </div>
          </button>

          {/* Option 2, Email */}
          <button
            onClick={handleEmail}
            disabled={busy !== null || !customerEmail}
            className="w-full text-left rounded-2xl p-4 bg-ink text-paper flex items-start gap-3 disabled:opacity-50"
          >
            <div className="h-10 w-10 rounded-full bg-paper/10 text-paper flex items-center justify-center shrink-0">
              {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Send via Email</p>
              <p className="text-[11px] text-paper/60 mt-0.5">
                {customerEmail
                  ? "Professional email with the same portal link and experience."
                  : "Add a customer email to enable this option."}
              </p>
            </div>
          </button>

          {/* Option 3, WhatsApp deep-link (pre-filled message, one tap to send) */}
          <button
            onClick={async () => {
              try {
                setBusy("wa");
                let portalUrl = "";
                let text: string;
                if (updatedLinkPortalCode) {
                  portalUrl = shortClientPortalUrl(updatedLinkPortalCode);
                  text = `Hi ${firstName}, here's an updated link for your quote: ${portalUrl}`;
                } else {
                  const q = getQuote(quoteId);
                  if (!q) throw new Error("Quote not found");
                  const { token } = await ensureToken({ data: { quoteId, channel: "whatsapp" } });
                  portalUrl = shortQuotePortalUrl(token);
                  text = buildQuoteWhatsAppMessage(q, { name: customerName ?? "" }, portalUrl);

                }
                window.open(waLink(customerPhone, text), "_blank");
                toast.success(`Sent to ${customerName ?? firstName} via WhatsApp`);
                feedback("success");
                onClose();
              } catch (e) {
                feedback("error");
                toast.error(e instanceof Error ? e.message : "Could not open WhatsApp");
              } finally {
                setBusy(null);
              }
            }}
            disabled={busy !== null}
            className="w-full text-left rounded-2xl p-4 bg-card border border-border text-ink flex items-start gap-3 disabled:opacity-60"
          >
            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
              {busy === "wa" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Send via WhatsApp</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Opens WhatsApp with the full message pre-filled, portal link, total and your details. One tap to send.
              </p>
              <p className="text-[10px] text-muted-foreground/80 mt-1.5 italic">
                Tip, using Quottr keeps your business communication separate from your personal WhatsApp.
              </p>
            </div>
          </button>


          {/* Copy portal link helper */}
          <button
            onClick={copyPortalLink}
            className="w-full text-xs text-muted-foreground py-2 inline-flex items-center justify-center gap-1.5"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Portal link copied" : "Copy portal link"}
          </button>
        </div>

        <button onClick={onClose} className="w-full mt-2 text-sm text-muted-foreground py-2">Cancel</button>
      </div>
    </div>
  );
}
