import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Mail, MessageSquare, Sparkles, Loader2, Copy, Check } from "lucide-react";
import { ensurePortalToken } from "@/lib/messages.functions";
import { toast } from "sonner";
import { feedback } from "@/lib/feedback";

type Props = {
  open: boolean;
  onClose: () => void;
  quoteId: string;
  quoteRef: string;
  quoteTitle: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  whatsappHref: string; // pre-built wa.me link, keeps existing behaviour
};

export function SendQuoteDialog({
  open, onClose, quoteId, quoteRef, quoteTitle,
  customerName, customerPhone, customerEmail, whatsappHref,
}: Props) {
  const ensureToken = useServerFn(ensurePortalToken);
  const [busy, setBusy] = useState<null | "sms" | "email">(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const firstName = customerName?.split(" ")[0] ?? "there";

  const portalUrl = (token: string) =>
    `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${token}`;

  const handleQuottr = async () => {
    try {
      setBusy("sms");
      const { token } = await ensureToken({ data: { quoteId, channel: "sms" } });
      const url = portalUrl(token);
      const text = `Hi ${firstName}, your quote ${quoteRef} for ${quoteTitle} is ready. View, ask questions and approve here: ${url}`;
      const digits = (customerPhone ?? "").replace(/\D/g, "");
      const smsHref = digits
        ? `sms:${digits}?&body=${encodeURIComponent(text)}`
        : `sms:?&body=${encodeURIComponent(text)}`;
      // Try native share first (better on iOS where sms: works inconsistently from web)
      if (navigator.share) {
        try {
          await navigator.share({ title: `Quote ${quoteRef}`, text, url });
          feedback("success");
          onClose();
          return;
        } catch { /* user cancelled or unsupported – fall through */ }
      }
      window.location.href = smsHref;
      toast.success("Opening Messages…");
      feedback("success");
      onClose();
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
      const { token } = await ensureToken({ data: { quoteId, channel: "email" } });
      const url = portalUrl(token);
      const subject = `Your quote ${quoteRef} — ${quoteTitle}`;
      const body =
        `Hi ${firstName},\n\nYour quote is ready to view. You can review it, ask questions and approve from your secure portal:\n\n${url}\n\nThanks.`;
      const mailHref = `mailto:${customerEmail ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailHref;
      feedback("success");
      onClose();
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
          {/* Option 1 — Quottr (recommended) */}
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
                Customer gets an SMS with a portal link. They approve, ask questions and you reply inside Quottr — separate from your personal WhatsApp.
              </p>
            </div>
          </button>

          {/* Option 2 — Email */}
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

          {/* Option 3 — WhatsApp (unchanged) */}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            onClick={() => { feedback("tap"); setTimeout(onClose, 50); }}
            className="w-full text-left rounded-2xl p-4 bg-card border border-border text-ink flex items-start gap-3"
          >
            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Send via WhatsApp</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Quote sent directly in WhatsApp — no portal. Best for customers who prefer WhatsApp or don't have email.
              </p>
              <p className="text-[10px] text-muted-foreground/80 mt-1.5 italic">
                Tip — using Quottr keeps your business communication separate from your personal WhatsApp.
              </p>
            </div>
          </a>

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
