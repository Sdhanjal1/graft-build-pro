import { useEffect, useState } from "react";
import { SW_UPDATE_EVENT } from "@/lib/sw-register";

export function UpdateBanner() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onReady = (e: Event) => {
      const detail = (e as CustomEvent<{ waiting: ServiceWorker }>).detail;
      if (detail?.waiting) setWaiting(detail.waiting);
    };
    window.addEventListener(SW_UPDATE_EVENT, onReady as EventListener);

    // Pick up a worker that was already waiting before mount.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting && navigator.serviceWorker.controller) {
          setWaiting(reg.waiting);
        }
      }).catch(() => {});
    }

    return () => window.removeEventListener(SW_UPDATE_EVENT, onReady as EventListener);
  }, []);

  if (!waiting || dismissed) return null;

  const refresh = () => {
    try {
      waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-nav z-50 px-3 pointer-events-none">
      <div className="mx-auto max-w-md pointer-events-auto">
        <div className="rounded-2xl bg-ink text-paper p-4 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.4)] flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-lime flex items-center justify-center shrink-0">
            <span className="text-ink font-bold">↻</span>
          </div>
          <p className="flex-1 text-xs leading-snug">
            A new version of Quottr is ready.
          </p>
          <button
            onClick={refresh}
            className="bg-lime text-ink rounded-full px-4 py-2 text-xs font-bold"
          >
            Refresh
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="h-8 w-8 -mr-1 flex items-center justify-center text-paper/85"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
