import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, ExternalLink, ShieldCheck, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { useConnectStatus } from "@/hooks/useConnectStatus";
import {
  startSubscriptionCheckout,
  openBillingPortal,
} from "@/lib/subscription.functions";
import {
  startConnectOnboarding,
  openConnectDashboard,
  refreshConnectStatus,
} from "@/lib/connect.functions";

export function BillingSection() {
  const { sub, trialDaysLeft, canUse, showWarn, showExpired } = useSubscription();
  const connect = useConnectStatus();
  const startCheckout = useServerFn(startSubscriptionCheckout);
  const openPortal = useServerFn(openBillingPortal);
  const startOnboarding = useServerFn(startConnectOnboarding);
  const openDashboard = useServerFn(openConnectDashboard);
  const refresh = useServerFn(refreshConnectStatus);
  const [busy, setBusy] = useState<string | null>(null);

  const status = sub?.status ?? "trialing";
  const hasPm = !!sub?.has_payment_method;

  const subLabel = (() => {
    if (status === "active") return "Active subscription — £29 / month";
    if (status === "trialing") {
      return hasPm
        ? `Trial — ${trialDaysLeft} days left · billing starts after`
        : `Trial — ${trialDaysLeft} days left · no card yet`;
    }
    if (status === "past_due") return "Payment failed — please update card";
    if (status === "canceled") return "Subscription canceled";
    return status;
  })();

  const handleAddCard = async () => {
    setBusy("checkout");
    try {
      const url = window.location.origin;
      const { url: checkoutUrl } = await startCheckout({
        data: { successUrl: `${url}/settings?billing=ok`, cancelUrl: `${url}/settings` },
      });
      window.location.href = checkoutUrl;
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't open Stripe");
      setBusy(null);
    }
  };

  const handlePortal = async () => {
    setBusy("portal");
    try {
      const { url } = await openPortal({ data: { returnUrl: window.location.href } });
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't open billing portal");
    } finally {
      setBusy(null);
    }
  };

  const handleStartConnect = async () => {
    setBusy("connect");
    try {
      const origin = window.location.origin;
      const { url } = await startOnboarding({
        data: {
          returnUrl: `${origin}/settings?connect=ok`,
          refreshUrl: `${origin}/settings?connect=refresh`,
        },
      });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't start Stripe onboarding");
      setBusy(null);
    }
  };

  const handleOpenDashboard = async () => {
    setBusy("dash");
    try {
      const { url } = await openDashboard({ data: undefined as any });
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't open Stripe dashboard");
    } finally {
      setBusy(null);
    }
  };

  const handleRefresh = async () => {
    setBusy("refresh");
    try {
      const r = await refresh({ data: undefined as any });
      if (r.chargesEnabled) toast.success("Stripe ready — you can take card payments");
      else toast("Onboarding not complete yet", { description: "Finish the steps in Stripe" });
      await connect.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Quottr subscription */}
      <div className="card-surface p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-lime text-ink flex items-center justify-center shrink-0">
            <CreditCard className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Quottr subscription</p>
            <p className="text-[11px] text-muted-foreground">{subLabel}</p>
          </div>
        </div>

        {(showWarn || showExpired || !canUse) && !hasPm && (
          <div className="rounded-2xl bg-amber-100 text-amber-900 p-3 text-xs flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {showExpired
                ? "Your trial has ended. Add a card to keep using Quottr."
                : `Only ${trialDaysLeft} day(s) of trial left. Add a card so you don't lose access.`}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!hasPm && (
            <button
              type="button"
              onClick={handleAddCard}
              disabled={busy === "checkout"}
              className="text-xs font-bold bg-ink text-paper px-4 py-2 rounded-full disabled:opacity-50"
            >
              {busy === "checkout" ? "Opening Stripe…" : "Add payment method"}
            </button>
          )}
          {sub?.stripe_customer_id && (
            <button
              type="button"
              onClick={handlePortal}
              disabled={busy === "portal"}
              className="text-xs font-bold bg-secondary text-ink px-4 py-2 rounded-full flex items-center gap-1.5 disabled:opacity-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {busy === "portal" ? "Opening…" : "Manage billing"}
            </button>
          )}
        </div>
      </div>

      {/* Stripe Connect — take card payments from clients */}
      <div className="card-surface p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-lime text-ink flex items-center justify-center shrink-0">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Take card payments</p>
            <p className="text-[11px] text-muted-foreground">
              {connect.ready
                ? "Connected — clients can pay quotes by card"
                : connect.accountId
                  ? "Stripe onboarding not complete"
                  : "Connect a Stripe account to accept cards on invoices"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!connect.accountId && (
            <button
              type="button"
              onClick={handleStartConnect}
              disabled={busy === "connect"}
              className="text-xs font-bold bg-ink text-paper px-4 py-2 rounded-full disabled:opacity-50"
            >
              {busy === "connect" ? "Opening Stripe…" : "Connect Stripe"}
            </button>
          )}
          {connect.accountId && !connect.ready && (
            <button
              type="button"
              onClick={handleStartConnect}
              disabled={busy === "connect"}
              className="text-xs font-bold bg-ink text-paper px-4 py-2 rounded-full disabled:opacity-50"
            >
              {busy === "connect" ? "Opening…" : "Finish onboarding"}
            </button>
          )}
          {connect.accountId && (
            <>
              <button
                type="button"
                onClick={handleOpenDashboard}
                disabled={busy === "dash"}
                className="text-xs font-bold bg-secondary text-ink px-4 py-2 rounded-full flex items-center gap-1.5 disabled:opacity-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Stripe dashboard
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={busy === "refresh"}
                className="text-xs font-bold bg-secondary text-ink px-4 py-2 rounded-full flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh status
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
