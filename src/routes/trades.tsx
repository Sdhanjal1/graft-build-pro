import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/MarketingShell";
import { ArrowRight } from "lucide-react";
import tradespersonApp from "@/assets/tradesperson-app.jpg";
import { trades } from "@/lib/trades-data";

export const Route = createFileRoute("/trades")({
  component: TradesPage,
  head: () => ({
    meta: [
      { title: "Trades, Quottr" },
      { name: "description", content: "Built for plumbers, gas engineers, electricians, joiners, roofers, decorators and every trade in between." },
      { property: "og:title", content: "Trades, Quottr" },
      { property: "og:description", content: "Quottr is built for tradespeople. See which trades use it day-to-day." },
      { property: "og:url", content: "https://www.quottr.co.uk/trades" },
    ],
    links: [{ rel: "canonical", href: "https://www.quottr.co.uk/trades" }],
  }),
});

function TradesPage() {
  return (
    <MarketingShell>
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28 grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-paper/50 font-semibold">Trades</p>
            <h1 className="mt-3 text-5xl md:text-7xl leading-[0.95] text-paper">
              Built by trades. <span className="text-lime">For trades.</span>
            </h1>
            <p className="mt-5 text-lg text-paper/75 max-w-xl">
              If you wear boots, lift tools, or quote on the doorstep, Quottr was built for you.
            </p>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 rounded-3xl bg-lime/20 blur-2xl pointer-events-none" aria-hidden="true" />
            <img
              src={tradespersonApp}
              alt="Tradesperson holding a phone running the Quottr app"
              width={1024}
              height={1024}
              className="relative rounded-3xl border border-paper/10 shadow-2xl w-full h-auto object-cover ring-1 ring-lime/20"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-5 md:grid-cols-2">
          {trades.map((t) => (
            <Link
              key={t.slug}
              to="/trades/$tradeSlug"
              params={{ tradeSlug: t.slug }}
              className="group rounded-2xl border border-ink/10 bg-card p-7 hover:border-ink/30 hover:bg-paper transition block"
            >
              <h3 className="text-3xl flex items-center justify-between">
                <span>{t.name}</span>
                <ArrowRight className="h-5 w-5 text-ink/40 group-hover:text-lime-ink group-hover:translate-x-1 transition" />
              </h3>
              <p className="mt-2 text-base text-ink/70 leading-relaxed">{t.shortBody}</p>
            </Link>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-ink/60 mb-4">Your trade not listed? Quottr works for any trade that sends quotes.</p>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 bg-ink text-paper font-semibold px-7 py-4 rounded-full hover:bg-ink/90 transition"
          >
            Try it free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
