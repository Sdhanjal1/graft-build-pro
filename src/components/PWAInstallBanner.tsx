import { useEffect, useState } from "react";

const KEY = "quottr.pwa-dismissed-until";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function detectDevice(): "ios" | "android" | "other" {
  if (typeof window === "undefined") return "other";
  const ua = window.navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export function PWAInstallBanner() {
  const [show, setShow] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const device = detectDevice();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (device === "other") return;
    const until = Number(window.localStorage.getItem(KEY) ?? 0);
    if (until && Date.now() < until) return;
    // Small delay so it doesn't fight with splash
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, [device]);

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, String(Date.now() + 7 * 86400000));
    }
    setShow(false);
    setShowHow(false);
  };

  if (!show) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-nav z-50 px-3 pointer-events-none">
        <div className="mx-auto max-w-md pointer-events-auto">
          <div className="rounded-2xl bg-ink text-paper p-4 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.4)] flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-lime flex items-center justify-center shrink-0">
              <span className="text-ink font-bold">Q</span>
            </div>
            <p className="flex-1 text-xs leading-snug">
              Add Quottr to your home screen for the best experience.
            </p>
            <button
              onClick={() => setShowHow(true)}
              className="bg-lime text-ink rounded-full px-4 py-2 text-xs font-bold"
            >
              Add
            </button>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="h-8 w-8 -mr-1 flex items-center justify-center text-paper/60"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {showHow && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-3"
          onClick={dismiss}
        >
          <div
            className="bg-paper rounded-2xl max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl">Add to Home Screen</h3>
            {device === "ios" ? (
              <ol className="mt-3 space-y-2 text-sm">
                <li>1. Tap the <strong>Share</strong> button at the bottom of Safari.</li>
                <li>2. Scroll and tap <strong>Add to Home Screen</strong>.</li>
                <li>3. Tap <strong>Add</strong> in the top-right.</li>
              </ol>
            ) : (
              <ol className="mt-3 space-y-2 text-sm">
                <li>1. Tap the <strong>⋮ menu</strong> in your browser.</li>
                <li>2. Tap <strong>Add to Home Screen</strong> (or <strong>Install app</strong>).</li>
                <li>3. Confirm by tapping <strong>Add</strong>.</li>
              </ol>
            )}
            <button
              onClick={dismiss}
              className="mt-5 w-full bg-ink text-paper rounded-full py-3 text-sm font-semibold"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
