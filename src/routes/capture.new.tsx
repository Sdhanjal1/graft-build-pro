import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { createSiteCapture } from "@/lib/site-captures";
import { userProfile } from "@/lib/user-data";

export const Route = createFileRoute("/capture/new")({
  component: NewCapturePage,
});

function NewCapturePage() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async (withName: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const v = value.trim();
    try {
      // Heuristic: if it looks like a postcode/address (has digit) use address, else customer name.
      const looksLikeAddress = withName && /\d/.test(v);
      const c = await createSiteCapture({
        customerName: withName && !looksLikeAddress ? v : undefined,
        address: withName && looksLikeAddress ? v : undefined,
        tradeType: userProfile.trade_type,
        vatRegistered: userProfile.vat_registered,
      });
      navigate({ to: "/capture/$captureId", params: { captureId: c.id }, replace: true });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Could not start capture");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-ink text-paper flex flex-col">
      <header className="px-4 pt-5 pb-3 safe-top flex items-center">
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          aria-label="Back"
          className="h-9 w-9 rounded-full bg-paper/10 flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </header>

      <main className="flex-1 flex flex-col justify-center px-6 pb-10 max-w-md mx-auto w-full">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="h-5 w-5 text-lime" />
          <p className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">
            New site capture
          </p>
        </div>
        <h1 className="text-3xl leading-tight mb-2">What is this job?</h1>
        <p className="text-sm text-paper/60 mb-5">
          Enter customer name, address, or postcode.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(true);
          }}
          className="space-y-3"
        >
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. Sarah Patel · 22 Oak Rd · SW1A 1AA"
            className="w-full bg-paper/10 rounded-2xl px-4 py-3.5 text-sm outline-none placeholder:text-paper/40 focus:bg-paper/15"
          />
          {error && <p className="text-[12px] text-status-overdue font-medium">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 bg-lime text-ink rounded-full py-3.5 text-sm font-bold active:scale-[0.99] transition disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start capturing"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => start(false)}
            className="w-full text-center text-xs font-semibold text-paper/60 py-2 active:text-paper transition disabled:opacity-60"
          >
            Skip, use date & time as title
          </button>
        </form>
      </main>
    </div>
  );
}
