import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MarketingShell } from "@/components/MarketingShell";
import { ArrowRight, Mic, Check } from "lucide-react";
import { getTradeBySlug, trades, quoteTotal, type Trade } from "@/lib/trades-data";

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export const Route = createFileRoute("/trades/$tradeSlug")({
  loader: ({ params }): { trade: Trade } => {
    const trade = getTradeBySlug(params.tradeSlug);
    if (!trade) throw notFound();
    return { trade };
  },

  head: ({ loaderData }) => {
    const trade = loaderData?.trade;
    if (!trade) {
      return { meta: [{ title: "Trade, Quottr" }] };
    }
    const url = `https://www.quottr.co.uk/trades/${trade.slug}`;
    const faqJsonLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: trade.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };
    return {
      meta: [
        { title: trade.seoTitle },
        { name: "description", content: trade.seoDescription },
        { property: "og:title", content: trade.seoTitle },
        { property: "og:description", content: trade.seoDescription },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(faqJsonLd),
        },
      ],
    };
  },
  component: TradeDetailPage,
  notFoundComponent: () => (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-5 py-24 text-center">
        <h1 className="text-5xl" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Trade not found</h1>
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
        <h1 className="text-3xl" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Something went wrong</h1>
        <p className="mt-3 text-ink/70">{error.message}</p>
      </section>
    </MarketingShell>
  ),
});

function TradeDetailPage() {
  const { trade } = Route.useLoaderData() as { trade: Trade };
  const others = trades.filter((t) => t.slug !== trade.slug).slice(0, 4);
  const total = quoteTotal(trade.exampleQuote);

  return (
    <MarketingShell>
      {/* HERO */}
      <section className="bg-ink text-paper relative overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-lime/15 blur-[130px] pointer-events-none" />
        <div className="mx-auto max-w-5xl px-5 py-20 md:py-28 relative">
          <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-lime">For {trade.name.toLowerCase()}</p>
          <h1 className="mt-4 text-paper leading-[0.85] tracking-tight max-w-4xl" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(3rem, 9vw, 7rem)" }}>
            {trade.headline.replace(/\.$/, "")}<span className="text-lime">.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-paper/75 max-w-2xl leading-relaxed">{trade.intro}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link to="/auth" className="inline-flex items-center justify-center gap-2 bg-lime text-ink font-semibold px-7 py-4 rounded-full hover:brightness-95 transition">
              Start quoting free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/trades" className="inline-flex items-center justify-center bg-paper/10 border border-paper/15 text-paper font-medium px-7 py-4 rounded-full hover:bg-paper/15 transition">
              All trades
            </Link>
          </div>
        </div>
      </section>

      {/* WHAT WE QUOTE FOR */}
      <section className="mx-auto max-w-5xl px-5 py-16 md:py-20">
        <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-lime">What you quote for</p>
        <h2 className="mt-3 text-3xl md:text-5xl leading-[0.95] max-w-3xl" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          Built for the jobs <span className="text-ink bg-lime px-2 box-decoration-clone">{trade.name.toLowerCase()}</span> actually do.
        </h2>
        <ul className="mt-8 flex flex-wrap gap-2">
          {trade.jobTypes.map((j) => (
            <li
              key={j}
              className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-card px-4 py-2 text-sm md:text-base text-ink"
            >
              <Check className="h-4 w-4 text-lime shrink-0" />
              {j}
            </li>
          ))}
        </ul>
      </section>

      {/* HOW IT HELPS */}
      <section className="mx-auto max-w-5xl px-5 py-16 md:py-20">
        <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-lime">On the tools</p>
        <h2 className="mt-3 text-4xl md:text-6xl leading-[0.95] max-w-3xl" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          How Quottr helps <span className="text-ink bg-lime px-2 box-decoration-clone">{trade.name.toLowerCase()}</span>.
        </h2>
        <div className="mt-12 grid gap-px bg-ink/10 md:grid-cols-3 rounded-3xl overflow-hidden">
          {trade.bullets.map((b) => (
            <div key={b.title} className="bg-paper p-7 md:p-8">
              <h3 className="text-xl md:text-2xl text-ink leading-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{b.title}</h3>
              <p className="mt-3 text-[15px] text-ink/70 leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* EXAMPLE QUOTE */}
      <section className="bg-card">
        <div className="mx-auto max-w-5xl px-5 py-20 md:py-24">
          <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-lime">Example quote</p>
          <h2 className="mt-3 text-4xl md:text-6xl leading-[0.95] max-w-3xl" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            A real {trade.name.toLowerCase().replace(/s$/, "")} quote, in 60 seconds.
          </h2>
          <p className="mt-4 text-ink/70 max-w-2xl">
            This is what your customer sees on their phone after you voice-note the job.
          </p>

          <div className="mt-10 rounded-3xl bg-paper border border-ink/10 overflow-hidden shadow-sm">
            <div className="px-6 md:px-8 py-5 border-b border-ink/10 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-ink/50">Quote</p>
                <p className="mt-1 text-lg md:text-xl text-ink" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  {trade.exampleQuote.customer}
                </p>
                <p className="text-sm text-ink/60">{trade.exampleQuote.jobSummary}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-ink/50">Total</p>
                <p className="mt-1 text-2xl md:text-3xl text-ink" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  {GBP.format(total)}
                </p>
              </div>
            </div>

            <ul className="divide-y divide-ink/5">
              {trade.exampleQuote.lines.map((l, i) => (
                <li key={i} className="px-6 md:px-8 py-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[15px] text-ink leading-snug">{l.description}</p>
                    {l.qty > 1 && (
                      <p className="text-xs text-ink/50 mt-0.5">
                        {l.qty} × {GBP.format(l.unitPrice)}
                      </p>
                    )}
                  </div>
                  <p className="text-[15px] text-ink shrink-0 tabular-nums">
                    {GBP.format(l.qty * l.unitPrice)}
                  </p>
                </li>
              ))}
            </ul>

            <div className="px-6 md:px-8 py-5 bg-lime/15 border-t border-ink/10 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-ink/60">Deposit to confirm</p>
                <p className="text-sm text-ink/70">Paid by card or Apple Pay on approval</p>
              </div>
              <p className="text-xl md:text-2xl text-ink shrink-0" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                {GBP.format(trade.exampleQuote.deposit)}
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs text-ink/50">
            Illustrative pricing only. Your rates are yours — Quottr learns them as you quote.
          </p>
        </div>
      </section>

      {/* VOICE PROMPTS */}
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-5xl px-5 py-20 md:py-24">
          <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-lime">Try saying this</p>
          <h2 className="mt-3 text-4xl md:text-6xl leading-[0.95] text-paper max-w-3xl" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            Real voice prompts for {trade.name.toLowerCase()}.
          </h2>
          <ul className="mt-10 grid gap-px bg-paper/10 rounded-3xl overflow-hidden">
            {trade.prompts.map((p, i) => (
              <li key={i} className="flex items-start gap-4 bg-ink p-6">
                <span className="h-9 w-9 rounded-full bg-lime flex items-center justify-center shrink-0">
                  <Mic className="h-4 w-4 text-ink" />
                </span>
                <p className="text-base md:text-lg text-paper/85 italic leading-relaxed">"{p}"</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-4xl px-5 py-20 md:py-24">
        <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-lime">Questions {trade.name.toLowerCase()} ask</p>
        <h2 className="mt-3 text-4xl md:text-6xl leading-[0.95]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          Straight answers.
        </h2>
        <div className="mt-10 divide-y divide-ink/10 border-t border-b border-ink/10">
          {trade.faqs.map((f, i) => (
            <details key={i} className="group py-5">
              <summary className="flex cursor-pointer items-start justify-between gap-4 list-none">
                <h3 className="text-lg md:text-xl text-ink leading-snug pr-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  {f.q}
                </h3>
                <span className="mt-1 h-6 w-6 rounded-full bg-ink/5 flex items-center justify-center text-ink/60 shrink-0 transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-[15px] md:text-base text-ink/75 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-5 pb-20 md:pb-24">
        <div className="rounded-3xl bg-lime text-ink p-10 md:p-14">
          <h2 className="text-5xl md:text-7xl leading-[0.9]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            Speak it. Send it. Get paid.
          </h2>
          <p className="mt-4 text-ink/80 text-lg max-w-xl">
            Try Quottr free for 14 days. No card. Cancel any time.
          </p>
          <Link to="/auth" className="mt-8 inline-flex items-center gap-2 bg-ink text-paper font-semibold px-7 py-4 rounded-full hover:bg-ink/90 transition">
            Start quoting free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* OTHER TRADES */}
      <section className="mx-auto max-w-5xl px-5 pb-24">
        <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-lime">Other trades</p>
        <div className="mt-4 grid gap-px bg-ink/10 md:grid-cols-4 rounded-3xl overflow-hidden">
          {others.map((o) => (
            <Link
              key={o.slug}
              to="/trades/$tradeSlug"
              params={{ tradeSlug: o.slug }}
              className="group bg-paper p-6 hover:bg-card transition flex items-center justify-between gap-2"
            >
              <h3 className="text-xl md:text-2xl text-ink leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{o.name}</h3>
              <ArrowRight className="h-4 w-4 text-ink/30 group-hover:text-ink group-hover:translate-x-0.5 transition shrink-0" />
            </Link>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
