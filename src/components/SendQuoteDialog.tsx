import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles, Loader2, Copy, Check, CheckCircle2, Clock, BellOff, Bell, ArrowRight } from "lucide-react";
import { ensurePortalToken } from "@/lib/messages.functions";

import { toast } from "sonner";
import { feedback, playSample } from "@/lib/feedback";
import { getQuote, userProfile, setQuoteAutoChase, setQuoteStatus } from "@/lib/user-data";

type SentVia = "sms";
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
  /** Fired after the user confirms "Yes, sent" so the parent can sync local status to "sent". */
  onSent?: () => void;
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
  const [pendingChannel, setPendingChannel] = useState<SentVia | null>(null);
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
    setPendingChannel(null);
    onClose();
  };

  const confirmSent = async (channel: SentVia) => {
    try {
      const q = getQuote(quoteId);
      if (q && q.status === "pending") {
        await setQuoteStatus(quoteId, "sent");
      }
    } catch { /* non-fatal — UI still advances */ }
    toast.success(`Sent to ${customerName ?? firstName}`);
    feedback("success");
    playSample("whoosh");
    setSentVia(channel);
    setPendingChannel(null);
  };



// Always share via the branded short domain, keeps WhatsApp/email links tidy.
const SHARE_ORIGIN = "https://quottr.co.uk";
const shortQuotePortalUrl = (token: string) => `${SHARE_ORIGIN}/q/${token}`;




  if (!open) return null;

  const firstName = customerName?.split(" ")[0] ?? "there";

  const portalUrl = (token: string) => shortQuotePortalUrl(token);


  const handleQuottr = async () => {
    try {
      setBusy("sms");
      const { token } = await ensureToken({ data: { quoteId, channel: "sms" } });
      const url = portalUrl(token);
      const text = updatedLinkPortalCode
        ? `Hi ${firstName}, here's an updated link for your quote ${quoteRef}: ${url}`
        : `Hi ${firstName}, your quote ${quoteRef} for ${quoteTitle} is ready to view, approve and pay: ${url}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: `Quote ${quoteRef}`, text, url });
        } catch { /* user cancelled or unsupported - still ask to confirm */ }
      } else {
        try { await navigator.clipboard.writeText(`${text}`); toast.message("Message copied — paste it into your chat or email"); } catch { /* ignore */ }
      }
      if (updatedLinkPortalCode) onClose();
      else setPendingChannel("sms");
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

  const offsets = (userProfile.chase_offsets?.length ? userProfile.chase_offsets : [7, 14, 21]).slice(0, 3);
  const chaseLabels = ["Friendly nudge", "Follow-up", "Final reminder"];

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/60" onClick={handleClose}>
      <div className="w-full max-w-md mx-auto bg-paper rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="h-1 w-10 bg-ink/20 rounded-full mx-auto mb-4" />

        {pendingChannel && !sentVia ? (
          <div>
            <h3 className="text-2xl">Did you send the quote?</h3>
            <p className="text-xs text-muted-foreground mb-4 mt-1">
              Confirm once you've actually sent it to {customerName ?? firstName}. Opening the share menu isn't proof it was sent.
            </p>
            <div className="space-y-2.5">
              <button
                onClick={() => confirmSent(pendingChannel)}
                className="w-full rounded-2xl p-4 bg-lime text-ink font-bold text-sm"
              >
                Yes, sent
              </button>
              <button
                onClick={() => setPendingChannel(null)}
                className="w-full rounded-2xl p-4 bg-card border border-border text-ink font-bold text-sm"
              >
                Not yet, go back
              </button>
            </div>
            <button onClick={handleClose} className="w-full mt-2 text-sm text-muted-foreground py-2">Cancel</button>
          </div>
        ) : sentVia ? (
          <div>
            <div className="flex flex-col items-center text-center pt-1 pb-3">
              <div className="h-14 w-14 rounded-full bg-lime text-ink flex items-center justify-center mb-3">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-2xl">Quote sent</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Sent to {customerName ?? firstName}. We'll let you know when they open it.
              </p>
            </div>

            <div className="rounded-2xl bg-secondary p-4 mt-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-ink" />
                  <p className="text-sm font-bold">Auto-chaser is {autoChase ? "on" : "off"}</p>
                </div>
                <button
                  onClick={toggleAutoChase}
                  className={`text-[10px] uppercase tracking-widest font-bold rounded-full px-2.5 py-1 inline-flex items-center gap-1 ${
                    autoChase ? "bg-ink text-lime" : "bg-card border border-border text-muted-foreground"
                  }`}
                  aria-pressed={autoChase}
                >
                  {autoChase ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
                  {autoChase ? "On" : "Off"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {autoChase
                  ? "If they go quiet, Quottr will line up these nudges from the invoice due date. You always get to review before they send."
                  : "Quottr won't chase this quote. You can re-enable it any time from the quote screen."}
              </p>

              {autoChase && (
                <ol className="mt-3 space-y-1.5">
                  {offsets.map((d, i) => (
                    <li key={d} className="flex items-center gap-3 text-xs">
                      <span className="num text-[10px] uppercase tracking-widest font-bold text-ink/60 w-12 shrink-0">
                        Day {d}
                      </span>
                      <span className="text-ink font-semibold">{chaseLabels[i] ?? `${ORDINAL[i] ?? "next"} reminder`}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                to="/chaser"
                onClick={handleClose}
                className="bg-card border border-border text-ink rounded-full py-3 text-sm font-bold inline-flex items-center justify-center gap-1.5"
              >
                View chaser <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <button
                onClick={handleClose}
                className="bg-ink text-paper rounded-full py-3 text-sm font-bold"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
        <>
        <h3 className="text-2xl">Send quote</h3>
        <p className="text-xs text-muted-foreground mb-4">
          One tap to share with {firstName}.
        </p>

        <div className="space-y-2.5">
          {/* Single primary action — opens native share sheet */}
          <button
            onClick={handleQuottr}
            disabled={busy !== null}
            className="w-full text-left rounded-2xl p-4 bg-lime text-ink flex items-start gap-3 disabled:opacity-60"
          >
            <div className="h-10 w-10 rounded-full bg-ink text-lime flex items-center justify-center shrink-0">
              {busy === "sms" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Send to {firstName}</p>
              <p className="text-[11px] text-ink/70 mt-0.5">
                Opens your share menu — pick WhatsApp, Messages or email. Your customer gets a link to view, approve and pay.
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

        <button onClick={handleClose} className="w-full mt-2 text-sm text-muted-foreground py-2">Cancel</button>
        </>
        )}
      </div>
    </div>
  );
}
