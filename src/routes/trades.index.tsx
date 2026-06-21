import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/MarketingShell";
import { ArrowRight } from "lucide-react";
import tradespersonApp from "@/assets/tradesperson-app.jpg";
import { trades } from "@/lib/trades-data";

export const Route = createFileRoute("/trades/")({
  component: TradesPage,
  head: () => ({
    meta: [
      { title: "Trades, Quottr" },
      { name: "description", content: "Quottr is built for UK tradespeople: plumbers, gas engineers, electricians, builders, joiners, roofers, tilers and decorators. See how it works on your jobs." },
      { property: "og:title", content: "Trades, Quottr" },
      { property: "og:description", content: "Built for tradespeople. See which trades use Quottr day to day." },
      { property: "og:url", content: "https://www.quottr.co.uk/trades" },
    ],
    links: [{ rel: "canonical", href: "https://www.quottr.co.uk/trades" }],
  }),
});

function TradesPage() {
  return (
    <MarketingShell>
      {/* HERO */}
      <section className="bg-ink text-paper relative overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-lime/15 blur-[130px] pointer-events-none" />
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28 grid gap-12 md:grid-cols-2 md:items-center relative">
          <div>
            <h1 className="text-paper leading-[0.85] tracking-tight" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(3rem, 9vw, 7rem)" }}>
              Built for the trades.<br /><span className="text-lime">Whatever you fit, fix or build.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-paper/75 max-w-xl leading-relaxed">
              If you wear boots, lift tools and quote on the doorstep, Quottr was built for you. Pick your trade and see how it works on the jobs you do every day.
            </p>
          </div>
          <div className="relative">
            <img
              src={tradespersonApp}
              alt="Tradesperson using Quottr on a phone"
              width={1024}
              height={1024}
              className="rounded-[1.75rem] w-full h-auto object-cover ring-1 ring-paper/15"
            />
          </div>
        </div>
      </section>

      {/* TRADE GRID */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-24">
        <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-lime">Pick your trade</p>
        <h2 className="mt-3 text-4xl md:text-6xl leading-[0.95] max-w-2xl" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          Eight trades. <span className="text-ink/40">One way to quote.</span>
        </h2>

        <div className="mt-12 grid gap-px bg-ink/10 md:grid-cols-2 rounded-3xl overflow-hidden">
          {trades.map((t) => (
            <Link
              key={t.slug}
              to="/trades/$tradeSlug"
              params={{ tradeSlug: t.slug }}
              className="group bg-paper p-7 md:p-8 hover:bg-card transition block"
            >
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-3xl md:text-4xl text-ink leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{t.name}</h3>
                <ArrowRight className="h-5 w-5 text-ink/30 group-hover:text-ink group-hover:translate-x-1 transition shrink-0" />
              </div>
              <p className="mt-3 text-[15px] text-ink/70 leading-relaxed">{t.shortBody}</p>
            </Link>
          ))}
        </div>

        <div className="mt-12 flex flex-col sm:flex-row sm:items-center gap-4">
          <p className="text-ink/60 text-lg">Your trade not listed? Quottr works for any trade that sends quotes.</p>
          <Link to="/auth" className="inline-flex items-center gap-2 bg-ink text-paper font-semibold px-7 py-4 rounded-full hover:bg-ink/90 transition shrink-0">
            Start quoting free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
