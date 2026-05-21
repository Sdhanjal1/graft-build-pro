import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MarketingShell } from "@/components/MarketingShell";
import { ArrowRight, Mic, Check } from "lucide-react";
import { getTradeBySlug, trades, type Trade } from "@/lib/trades-data";

export const Route = createFileRoute("/trades/$tradeSlug")({
  loader: ({ params }): { trade: Trade } => {
    const trade = getTradeBySlug(params.tradeSlug);
    if (!trade) throw notFound();
    return { trade };
  },

  head: ({ loaderData }) => {
    const trade = loaderData?.trade;
    if (!trade) {
      return { meta: [{ title: "Trade — Quottr" }] };
    }
    const title = `${trade.headline} — Quottr`;
    const description = trade.intro;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
      links: [{ rel: "canonical", href: `/trades/${trade.slug}` }],
    };
  },
  component: TradeDetailPage,
  notFoundComponent: () => (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-5 py-24 text-center">
        <h1 className="text-5xl">Trade not found</h1>
        <p className="mt-4 text-ink/70">We don't have a page for that trade yet.</p>
        <Link to="/trades" className="mt-6 inline-flex items-center gap-2 bg-ink text-paper font-semibold px-6 py-3 rounded-full">
          All trades
        </Link>
      </section>
    </MarketingShell>
  ),
  errorComponent: ({ error }) => (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-5 py-24 text-center">
        <h1 className="text-3xl">Something went wrong</h1>
        <p className="mt-3 text-ink/70">{error.message}</p>
      </section>
    </MarketingShell>
  ),
});

function TradeDetailPage() {
  const { trade } = Route.useLoaderData() as { trade: Trade };

  const others = trades.filter((t) => t.slug !== trade.slug).slice(0, 4);

  return (
    <MarketingShell>
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-5xl px-5 py-20 md:py-28">
          <p className="text-[11px] uppercase tracking-widest text-paper/50 font-semibold">For {trade.name.toLowerCase()}</p>
          <h1 className="mt-3 text-5xl md:text-7xl leading-[0.95] text-paper max-w-4xl">
            {trade.headline.replace(/\.$/, "")} <span className="text-lime">.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-paper/75 max-w-2xl">{trade.intro}</p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-2 bg-lime text-ink font-semibold px-7 py-4 rounded-full hover:brightness-95 transition"
            >
              Start free trial <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/trades"
              className="inline-flex items-center justify-center bg-paper/10 border border-paper/15 text-paper font-medium px-7 py-4 rounded-full hover:bg-paper/15 transition"
            >
              All trades
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-20">
        <h2 className="text-3xl md:text-5xl leading-tight max-w-3xl">
          How Quottr helps <span className="text-lime-ink bg-lime px-2">{trade.name.toLowerCase()}</span>.
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {trade.bullets.map((b) => (
            <div key={b.title} className="rounded-2xl border border-ink/10 bg-card p-7">
              <div className="h-10 w-10 rounded-xl bg-lime flex items-center justify-center">
                <Check className="h-5 w-5 text-ink" />
              </div>
              <h3 className="mt-5 text-xl md:text-2xl leading-tight">{b.title}</h3>
              <p className="mt-3 text-sm text-ink/70 leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-5xl px-5 py-20">
          <p className="text-[11px] uppercase tracking-widest text-paper/50 font-semibold">Try saying this</p>
          <h2 className="mt-3 text-3xl md:text-5xl leading-tight text-paper">
            Real voice prompts for {trade.name.toLowerCase()}.
          </h2>
          <ul className="mt-10 space-y-4">
            {trade.prompts.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-4 rounded-2xl border border-paper/10 bg-paper/[0.04] p-5"
              >
                <span className="h-10 w-10 rounded-full bg-lime flex items-center justify-center shrink-0">
                  <Mic className="h-5 w-5 text-ink" />
                </span>
                <p className="text-base md:text-lg text-paper/85 italic leading-relaxed">"{p}"</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-20 md:py-24">
        <div className="rounded-3xl bg-lime text-ink p-10 md:p-14 text-center">
          <h2 className="text-4xl md:text-6xl leading-[0.95]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            Stop quoting in the evenings.
          </h2>
          <p className="mt-3 text-ink/80 text-lg max-w-xl mx-auto">
            Try Quottr free for 14 days. No card. Cancel any time.
          </p>
          <div className="mt-6">
            <Link to="/auth" className="inline-flex items-center gap-2 bg-ink text-paper font-semibold px-7 py-4 rounded-full hover:bg-ink/90 transition">
              Start free trial <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-24">
        <p className="text-[11px] uppercase tracking-widest text-ink/50 font-semibold">Other trades</p>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          {others.map((o) => (
            <Link
              key={o.slug}
              to="/trades/$tradeSlug"
              params={{ tradeSlug: o.slug }}
              className="rounded-2xl border border-ink/10 bg-card p-5 hover:border-ink/30 transition"
            >
              <h3 className="text-xl">{o.name}</h3>
            </Link>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
