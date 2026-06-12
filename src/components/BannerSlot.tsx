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
 * Priority: SW update > PWA install > Trial > Offline.
 *
 * z-index map (keep in sync if banners are added):
 *   nav (BottomNav)      = 40
 *   sticky save bars     = 50
 *   floating banners     = 50 (PWA, Update)
 *   offline pill (top)   = 70
 */
export function BannerSlot() {
  const { sub, loading, showWarn, showExpired } = useSubscription();

  const [pwaActive, setPwaActive] = useState(false);
  const [offline, setOffline] = useState(
    typeof navigator === "undefined" ? false : !navigator.onLine,
  );
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    setPwaActive(pwaEligible());
    const up = () => setOffline(false);
    const down = () => setOffline(true);
    const onUpdate = () => setUpdateReady(true);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    window.addEventListener(SW_UPDATE_EVENT, onUpdate);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      window.removeEventListener(SW_UPDATE_EVENT, onUpdate);
    };
  }, []);

  if (updateReady) return <UpdateBanner />;

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
