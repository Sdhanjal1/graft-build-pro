import { useEffect, useState } from "react";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { TrialBanner } from "@/components/TrialBanner";
import { UpdateBanner } from "@/components/UpdateBanner";
import { SW_UPDATE_EVENT } from "@/lib/sw-register";
import { useSubscription } from "@/hooks/useSubscription";

const PWA_KEY = "quottr.pwa-dismissed-until";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function pwaEligible() {
  if (typeof window === "undefined") return false;
  if (isStandalone()) return false;
  const ua = window.navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  if (!isMobile) return false;
  const until = Number(window.localStorage.getItem(PWA_KEY) ?? 0);
  if (until && Date.now() < until) return false;
  return true;
}

/**
 * Renders at most one banner at a time.
 * Priority: PWA install > Trial banner > Offline banner.
 */
export function BannerSlot() {
  const { sub, loading, showWarn, showExpired } = useSubscription();

  const [pwaActive, setPwaActive] = useState(false);
  const [offline, setOffline] = useState(
    typeof navigator === "undefined" ? false : !navigator.onLine,
  );

  useEffect(() => {
    setPwaActive(pwaEligible());
    const up = () => setOffline(false);
    const down = () => setOffline(true);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (pwaActive) return <PWAInstallBanner />;

  const trialActive =
    !loading &&
    !!sub &&
    !(sub.has_payment_method && sub.status === "active") &&
    (showWarn || showExpired);

  if (trialActive) return <TrialBanner />;

  if (offline) return <OfflineBanner />;

  return null;
}
