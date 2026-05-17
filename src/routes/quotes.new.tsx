import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { TRADE_TYPES, mockProfile } from "@/lib/mock-data";
import { Mic, Sparkles } from "lucide-react";

export const Route = createFileRoute("/quotes/new")({
  component: NewQuotePage,
});

function NewQuotePage() {
  const [desc, setDesc] = useState("");
  const [trade, setTrade] = useState(mockProfile.trade_type);
  const [vat, setVat] = useState(mockProfile.vat_registered);
  const [recording, setRecording] = useState(false);

  return (
    <AppShell>
      <PageHeader title="New quote" subtitle="AI generator" back="/" />

      <form className="px-5 space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="card-surface p-4">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Describe the job
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="e.g. Replace 28kw combi boiler with new Worcester Greenstar, fit magnetic filter, power flush system…"
            rows={6}
            className="mt-2 w-full bg-transparent outline-none text-sm resize-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => setRecording((r) => !r)}
            className={`mt-2 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition ${
              recording ? "bg-status-overdue text-white animate-pulse" : "bg-secondary text-ink"
            }`}
          >
            <Mic className="h-4 w-4" />
            {recording ? "Recording… tap to stop" : "Voice to text"}
          </button>
        </div>

        <div className="card-surface p-4">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Trade type
          </label>
          <select
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            className="mt-2 w-full bg-transparent outline-none text-sm font-medium"
          >
            {TRADE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <label className="card-surface p-4 flex items-center justify-between cursor-pointer">
          <div>
            <p className="font-semibold text-sm">VAT registered</p>
            <p className="text-xs text-muted-foreground">Add 20% VAT to quote total</p>
          </div>
          <input
            type="checkbox"
            checked={vat}
            onChange={(e) => setVat(e.target.checked)}
            className="h-6 w-11 appearance-none rounded-full bg-secondary checked:bg-lime relative cursor-pointer transition
              before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition
              checked:before:translate-x-5"
          />
        </label>

        <div className="card-surface p-4 bg-ink text-paper">
          <p className="text-xs uppercase tracking-widest text-paper/60 font-semibold">Client</p>
          <input
            placeholder="Client name or pick existing"
            className="mt-2 w-full bg-transparent outline-none text-sm placeholder:text-paper/40"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-lime text-ink rounded-full py-4 font-bold inline-flex items-center justify-center gap-2 active:scale-[0.99] transition"
        >
          <Sparkles className="h-5 w-5" />
          Generate quote
        </button>

        <p className="text-[11px] text-center text-muted-foreground">
          AI generation uses 2026 UK trade pricing. Add your Claude API key in Settings to enable.
        </p>
      </form>
    </AppShell>
  );
}
