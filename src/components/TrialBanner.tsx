import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Sparkles } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { startSubscriptionCheckout, openBillingPortal } from "@/lib/subscription.functions";
import { toast } from "sonner";

export function TrialBanner() {
  const { sub, loading, showWarn, showExpired, trialDaysLeft } = useSubscription();
  const startCheckout = useServerFn(startSubscriptionCheckout);
  const openPortal = useServerFn(openBillingPortal);
  const [busy, setBusy] = useState(false);

  if (loading || !sub) return null;
  if (sub.has_payment_method && sub.status === "active") return null;
  if (!showWarn && !showExpired && sub.status === "trialing") return null;

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
      toast.error(e?.message ?? "Could not start checkout");
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
      toast.error(e?.message ?? "Could not open billing");
      setBusy(false);
    }
  };

  if (showExpired) {
    return (
      <div className="mx-4 my-3 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-red-900">Your trial has ended</p>
            <p className="text-red-800 mt-0.5">
              Add a card to keep using Quottr, £29/month.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={sub.stripe_customer_id ? manage : addCard}
                disabled={busy}
                className="rounded-full bg-red-600 text-white text-xs font-semibold px-4 py-2 disabled:opacity-60"
              >
                {busy ? "Opening…" : "Add payment method"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Amber warning: last 3 days, no card
  return (
    <div className="mx-4 my-3 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm">
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-amber-900">
            {trialDaysLeft === 1
              ? "Trial ends tomorrow"
              : `${trialDaysLeft} days left in trial`}
          </p>
          <p className="text-amber-800 mt-0.5">
            Add a card now, you won't be charged until the trial ends.
          </p>
          <div className="mt-3">
            <button
              onClick={addCard}
              disabled={busy}
              className="rounded-full bg-ink text-paper text-xs font-semibold px-4 py-2 disabled:opacity-60"
            >
              {busy ? "Opening…" : "Add payment method"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
