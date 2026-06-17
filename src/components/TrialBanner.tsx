import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CreditCard, Sparkles } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { startSubscriptionCheckout, openBillingPortal } from "@/lib/subscription.functions";
import { toast } from "sonner";

type Variant = "past_due" | "expired" | "warn";

export function TrialBanner() {
  const { sub, loading, showWarn, showExpired, showPastDue, trialDaysLeft } = useSubscription();
  const startCheckout = useServerFn(startSubscriptionCheckout);
  const openPortal = useServerFn(openBillingPortal);
  const [busy, setBusy] = useState(false);

  if (loading || !sub) return null;
  if (sub.has_payment_method && sub.status === "active") return null;
  if (!showWarn && !showExpired && !showPastDue) return null;

  const variant: Variant = showPastDue ? "past_due" : showExpired ? "expired" : "warn";

  const addCard = async () => {
    setBusy(true);
    try {
      const origin = window.location.origin;
      const { url } = await startCheckout({
        data: {
          successUrl: `${origin}/settings?sub=ok`,
          cancelUrl: `${origin}/settings?sub=cancel`,
        },
      });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't open checkout — try again in a moment.");
      setBusy(false);
    }
  };

  const manage = async () => {
    setBusy(true);
    try {
      const { url } = await openPortal({
        data: { returnUrl: window.location.origin + "/settings" },
      });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't open billing — try again in a moment.");
      setBusy(false);
    }
  };

  const copy = {
    past_due: {
      title: "Payment failed",
      body: "Your last payment didn't go through. Update your card to keep using Quottr.",
      action: "Update card",
      onClick: manage,
      tone: "destructive" as const,
      Icon: CreditCard,
    },
    expired: {
      title: "Your trial has ended",
      body: "Add a card to keep using Quottr — £29/month.",
      action: "Add payment method",
      onClick: sub.stripe_customer_id ? manage : addCard,
      tone: "destructive" as const,
      Icon: AlertTriangle,
    },
    warn: {
      title: trialDaysLeft === 1 ? "Trial ends tomorrow" : `${trialDaysLeft} days left in trial`,
      body: "Add a card now — you won't be charged until your trial ends.",
      action: "Add payment method",
      onClick: addCard,
      tone: "warn" as const,
      Icon: Sparkles,
    },
  }[variant];

  // High-urgency states (expired / past_due) lock to bottom as a sticky action sheet.
  // Warn stays inline so it doesn't crowd the thumb zone on day 12.
  const isSticky = variant !== "warn";

  const wrapper = isSticky
    ? "fixed inset-x-0 bottom-0 z-[55] px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 pointer-events-none"
    : "mx-4 my-3";

  const panelTone =
    copy.tone === "destructive"
      ? "bg-destructive text-destructive-foreground border-destructive"
      : "bg-status-pending/10 border-status-pending/30 text-ink";

  const buttonTone =
    copy.tone === "destructive"
      ? "bg-paper text-ink hover:bg-paper/90"
      : "bg-ink text-paper hover:bg-ink/90";

  return (
    <div className={wrapper}>
      <div
        className={`pointer-events-auto rounded-2xl border p-4 text-sm shadow-lg ${panelTone}`}
      >
        <div className="flex items-start gap-3">
          <copy.Icon
            className={`h-5 w-5 shrink-0 mt-0.5 ${
              copy.tone === "destructive" ? "text-destructive-foreground" : "text-status-pending"
            }`}
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{copy.title}</p>
            <p
              className={`mt-0.5 ${
                copy.tone === "destructive"
                  ? "text-destructive-foreground/85"
                  : "text-muted-foreground"
              }`}
            >
              {copy.body}
            </p>
            <button
              onClick={copy.onClick}
              disabled={busy}
              className={`mt-3 w-full sm:w-auto rounded-full text-xs font-semibold px-4 py-2.5 disabled:opacity-60 ${buttonTone}`}
            >
              {busy ? "Opening…" : copy.action}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
