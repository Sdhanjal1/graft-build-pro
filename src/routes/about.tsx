import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/MarketingShell";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About — Quottr" },
      { name: "description", content: "Quottr is built by tradespeople, for tradespeople. Our mission: kill the evening admin." },
      { property: "og:title", content: "About — Quottr" },
      { property: "og:description", content: "Built by tradespeople, for tradespeople." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.quottr.co.uk/about" },
      { property: "og:image", content: "https://quottr.co.uk/og-quottr.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://www.quottr.co.uk/about" }],
  }),
});

function AboutPage() {
  return (
    <MarketingShell>
      {/* HERO */}
      <section className="bg-ink text-paper relative overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-lime/15 blur-[130px] pointer-events-none" />
        <div className="mx-auto max-w-6xl px-5 py-24 md:py-32 relative">
          <h1
            className="text-paper leading-[0.82] tracking-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(3.5rem, 12vw, 11rem)" }}
          >
            Built in a van. <br />
            <span className="text-lime">Not a boardroom.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg md:text-xl text-paper/75 leading-relaxed">
            Quottr exists because the trades deserve software that respects their time,
            not another platform designed in an office by people who've never held a spanner.
          </p>
        </div>
      </section>

      {/* STORY, pull quotes */}
      <section className="mx-auto max-w-5xl px-5 py-20 md:py-28">
        <div className="grid gap-16 md:gap-20">
          <div className="grid md:grid-cols-12 gap-8 items-start">
            <p className="md:col-span-3 text-[11px] uppercase tracking-widest text-ink/50 font-semibold pt-2">The problem</p>
            <div className="md:col-span-9 space-y-5 text-lg md:text-xl text-ink/80 leading-relaxed">
              <p>
                A plumber finishes a 10-hour day on the tools. He gets home, eats,
                and then sits at the kitchen table for two more hours, writing
                quotes on his phone, tapping in line items, guessing at material
                prices, hoping the customer doesn't ghost him.
              </p>
              <p className="text-ink">
                That's the trades tax. Every evening, every weekend, every holiday.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-12 gap-8 items-start">
            <p className="md:col-span-3 text-[11px] uppercase tracking-widest text-ink/50 font-semibold pt-2">The fix</p>
            <div className="md:col-span-9">
              <p
                className="text-3xl md:text-5xl leading-[1.05] text-ink"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                One voice note from the van.<br />
                <span className="text-ink/50">A professional quote, sent before the kettle boils.</span>
              </p>
              <p className="mt-6 text-lg text-ink/70 leading-relaxed max-w-2xl">
                We built Quottr around a single rule: if it can't be done in
                under a minute, between jobs, with one hand, it isn't trade software.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <section className="bg-card border-y border-ink/10">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <h2 className="text-4xl md:text-6xl leading-[0.95] max-w-3xl" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            Four promises. <span className="text-ink/40">No small print.</span>
          </h2>

          <div className="mt-14 grid gap-px bg-ink/10 md:grid-cols-2 rounded-3xl overflow-hidden">
            {[
              { kicker: "Time", title: "Your evenings back", body: "Every feature we ship is judged by one question: does it give a tradesperson their night back? If not, it doesn't go in." },
              { kicker: "Built for the job", title: "Built for muddy hands", body: "Voice-first, one-thumb operation. Works under a sink, in a loft, in the rain. No 40-click onboarding, no menus inside menus." },
              { kicker: "Pricing", title: "Honest pricing", body: "One price. No per-quote fees. No 'upgrade to unlock'. No surprise enterprise tier you didn't ask for." },
              { kicker: "Trades-first", title: "Trades-first, always", body: "We talk to plumbers, sparkies and gas engineers every week. Their problems write our roadmap, not investors." },
            ].map((p) => (
              <div key={p.title} className="bg-paper p-8">
                <span className="text-[11px] uppercase tracking-[0.2em] font-bold text-lime">{p.kicker}</span>
                <h3 className="mt-4 text-2xl md:text-3xl text-ink leading-[0.95]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{p.title}</h3>
                <p className="mt-3 text-[15px] text-ink/70 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NUMBERS */}
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
          <div className="grid gap-10 md:grid-cols-3 text-center md:text-left">
            {[
              { n: "Secs", l: "Voice note to professional quote" },
              { n: "£0", l: "Per-quote fees. Ever." },
              { n: "14d", l: "Free trial. No card required." },
            ].map((s) => (
              <div key={s.n} className="border-t border-paper/15 pt-6 md:pt-8">
                <div
                  className="text-lime leading-none"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(4rem, 10vw, 7rem)" }}
                >
                  {s.n}
                </div>
                <p className="mt-3 text-sm uppercase tracking-widest text-paper/60 font-semibold">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WON'T DO */}
      <section className="mx-auto max-w-5xl px-5 py-20 md:py-24">
        <h2 className="text-4xl md:text-6xl leading-[0.95] max-w-3xl" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          What we'll <span className="text-lime">never do.</span>
        </h2>
        <ul className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
          {[
            "Charge you per quote.",
            "Lock essential features behind an 'enterprise' tier.",
            "Make you sit through a sales demo to use the product.",
            "Sell your data to suppliers, lenders, or anyone else.",
            "Ship features the trades didn't ask for.",
          ].map((line, i) => (
            <li key={i} className="flex items-baseline gap-6 py-5 md:py-6">
              <span className="text-lime text-sm font-semibold tracking-widest w-8 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-xl md:text-3xl text-ink leading-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                {line}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="rounded-3xl bg-lime text-ink p-10 md:p-16 relative overflow-hidden">
          <h2
            className="text-5xl md:text-7xl leading-[0.9]"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            Get your evenings back.
          </h2>
          <p className="mt-4 text-ink/80 text-lg max-w-xl">
            14 days free. No card required. Cancel any time.
          </p>
          <Link
            to="/auth"
            className="mt-8 inline-flex items-center gap-2 bg-ink text-paper font-semibold px-7 py-4 rounded-full hover:bg-ink/90 transition"
          >
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
