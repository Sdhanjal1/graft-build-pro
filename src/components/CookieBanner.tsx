import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const STORAGE_KEY = "quottr.cookie-consent.v1";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // ignore
    }
  }, []);

  const choose = (choice: "accept" | "reject") => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, ts: Date.now() }));
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-5 sm:pb-5 pointer-events-none">
      <div className="mx-auto max-w-3xl rounded-2xl bg-ink text-paper shadow-2xl border border-paper/10 p-4 sm:p-5 pointer-events-auto">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <p className="text-sm text-paper/80 leading-relaxed flex-1">
            We use strictly-necessary cookies to keep you signed in, and optional analytics cookies to improve Quottr.
            See our <Link to="/privacy" className="underline text-paper hover:text-lime">Privacy Policy</Link>.
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => choose("reject")}
              className="text-sm font-medium px-4 py-2.5 rounded-full bg-paper/10 hover:bg-paper/15 text-paper"
            >
              Reject
            </button>
            <button
              onClick={() => choose("accept")}
              className="text-sm font-semibold px-4 py-2.5 rounded-full bg-lime text-ink hover:bg-lime/90"
            >
              Accept all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
