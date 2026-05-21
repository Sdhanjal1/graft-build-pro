import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/MarketingShell";
import { ArrowRight, Check, Mic, Wrench, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/welcome")({
  component: WelcomePage,
  head: () => ({
    meta: [
      { title: "Quottr — You talk. Quottr quotes." },
      { name: "description", content: "Job management for trades. As easy as sending a voice note. Quottr handles quotes, invoices, customers and chasing for you." },
      { property: "og:title", content: "Quottr — You talk. Quottr quotes." },
      { property: "og:description", content: "Voice-first job management for tradespeople. Quotes, invoices and customers, sorted." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/welcome" }],
  }),
});

function WelcomePage() {
  return (
    <MarketingShell>
      {/* HERO — Mucka-style oversized wordmark on dark */}
      <section className="bg-ink text-paper relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: "radial-gradient(circle at 50% 0%, color-mix(in oklab, var(--lime) 35%, transparent), transparent 55%)" }}
        />
        <div className="mx-auto max-w-7xl px-5 pt-16 md:pt-24 pb-12 md:pb-16 relative text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-paper/10 border border-paper/15 text-[11px] uppercase tracking-widest font-semibold text-paper/80">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" /> Voice-first for trades
          </span>

          {/* MASSIVE wordmark */}
          <h1
            className="mt-8 text-lime leading-[0.8] tracking-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(5rem, 22vw, 18rem)" }}
          >
            Quottr.
          </h1>

          <p
            className="mt-6 text-paper text-3xl md:text-5xl leading-[1.05] max-w-4xl mx-auto"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.01em" }}
          >
            Job management for trades.<br />
            <span className="text-lime">You talk. Quottr quotes.</span>
          </p>

          <p className="mt-6 text-base md:text-lg text-paper/75 max-w-2xl mx-auto">
            As easy as sending a voice note. Quottr is job management software that handles quotes, invoices, customers and chasing for you.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-2 bg-lime text-ink font-semibold px-7 py-4 rounded-full hover:brightness-95 transition text-base"
            >
              Create free account <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center justify-center bg-paper/10 border border-paper/15 text-paper font-medium px-7 py-4 rounded-full hover:bg-paper/15 transition text-base"
            >
              See how it works
            </a>
          </div>

          <div className="mt-6 flex items-center gap-4 text-xs text-paper/55 justify-center flex-wrap">
            <span>No card required</span>
            <span className="h-1 w-1 rounded-full bg-paper/30" />
            <span>14-day free trial</span>
            <span className="h-1 w-1 rounded-full bg-paper/30" />
            <span>Cancel any time</span>
          </div>

          {/* Inline video — see it in action */}
          <div className="mt-12 md:mt-16 mx-auto max-w-4xl">
            <div className="rounded-2xl md:rounded-3xl overflow-hidden border border-paper/10 bg-ink shadow-2xl ring-1 ring-lime/20">
              <video
                src="/quottr-how-it-works.mp4"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="w-full h-auto block"
                aria-label="See how Quottr works — voice to quote to paid in under a minute"
              />


            </div>
            <p className="mt-3 text-xs text-paper/50 uppercase tracking-widest font-semibold">
              Voice → Quote → Paid · 18 seconds
            </p>
          </div>
        </div>
      </section>

      {/* YOU TALK, QUOTTR SORTS — Mucka 3-line section */}
      <section id="how" className="mx-auto max-w-5xl px-5 py-20 md:py-28 text-center">
        <p className="text-[11px] uppercase tracking-widest text-ink/50 font-semibold">How it works</p>
        <h2 className="mt-3 text-5xl md:text-7xl leading-[0.95]">
          You talk, <span className="text-lime-ink bg-lime px-2">Quottr sorts</span>.
        </h2>
        <ul className="mt-12 space-y-6 text-left md:text-center max-w-3xl mx-auto">
          {[
            <>Just tell Quottr what needs doing — <em>“Quote Mrs Jones for a new combi.”</em></>,
            <>Your quote is priced, branded and ready to review in seconds.</>,
            <>Send by WhatsApp. Customer signs and pays the deposit. You get your evenings back.</>,
          ].map((line, i) => (
            <li key={i} className="flex items-start gap-4 md:justify-center text-lg md:text-2xl text-ink/85">
              <span className="mt-2 h-2 w-2 rounded-full bg-lime shrink-0" />
              <span className="max-w-2xl">{line}</span>
            </li>
          ))}
        </ul>
        <div className="mt-10">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 bg-ink text-paper font-semibold px-7 py-4 rounded-full hover:bg-ink/90 transition"
          >
            Start for free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* THREE PILLARS — Van, Site, Sofa */}
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-widest text-paper/50 font-semibold">Built for the van, site and sofa</p>
            <h2 className="mt-3 text-4xl md:text-6xl leading-[0.95] text-paper">
              Get your evenings and weekends back. <span className="text-lime">Admin sorted on the go.</span>
            </h2>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: MessageSquare,
                title: "So easy your Nan could use it",
                body: "Send a voice note or message and Quottr creates quotes, sends invoices and keeps jobs moving. Hours of admin gone, every week.",
              },
              {
                icon: Wrench,
                title: "Job management on the move",
                body: "Voice-first means you can manage jobs in your gloves, in a loft, or in a room filled with dust. One hand, no typing.",
              },
              {
                icon: Mic,
                title: "A mate in your pocket",
                body: "Quottr gets to know you and helps you run your business. Polite chases, smart reminders, and the odd dad joke.",
              },
            ].map((p) => (
              <div key={p.title} className="rounded-2xl border border-paper/10 bg-paper/[0.03] p-7 hover:bg-paper/[0.06] transition">
                <div className="h-11 w-11 rounded-xl bg-lime flex items-center justify-center">
                  <p.icon className="h-5 w-5 text-ink" />
                </div>
                <h3 className="mt-5 text-2xl md:text-3xl text-paper">{p.title}</h3>
                <p className="mt-3 text-sm text-paper/70 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MTD / INTEGRATIONS */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-24">
        <p className="text-[11px] uppercase tracking-widest text-ink/50 font-semibold">Are you ready for Making Tax Digital?</p>
        <h2 className="mt-3 text-3xl md:text-5xl leading-[1.05] max-w-4xl">
          Skip the complicated bookkeeping software. <span className="text-ink/55">Plug in Quottr and it handles it for you. Connects with Xero, QuickBooks and more.</span>
        </h2>
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          {["Xero", "QuickBooks", "FreeAgent", "Sage"].map((name) => (
            <div key={name} className="h-20 rounded-2xl border border-ink/10 bg-card flex items-center justify-center text-xl font-semibold text-ink/70">
              {name}
            </div>
          ))}
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="bg-card border-y border-ink/10">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="text-[11px] uppercase tracking-widest text-ink/50 font-semibold">AI built for the trades</p>
          <h2 className="mt-3 text-3xl md:text-5xl leading-[1.05] max-w-3xl">
            The trades are loving Quottr.
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { q: "I quoted three jobs from the van between calls. Used to take me a full evening.", who: "Nav P. — Gas engineer, Leeds" },
              { q: "Site capture mode is a game-changer. I just walk and tap.", who: "Sam R. — Plumber, Bristol" },
              { q: "Money lands the same day now. Paid for the subscription twice over.", who: "Dani O. — Sparks, Glasgow" },
            ].map((t) => (
              <figure key={t.who} className="rounded-2xl border border-ink/10 bg-paper p-6">
                <blockquote className="text-lg leading-snug">“{t.q}”</blockquote>
                <figcaption className="mt-4 text-xs uppercase tracking-widest text-ink/55 font-semibold">{t.who}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-28">
        <div className="rounded-3xl bg-lime text-ink p-10 md:p-16 relative overflow-hidden text-center">
          <h2
            className="text-5xl md:text-8xl leading-[0.9]"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            Stop quoting in the evenings.
          </h2>
          <p className="mt-4 text-ink/80 text-lg md:text-xl max-w-2xl mx-auto">
            Try Quottr free for 14 days. No card, no contract, no hassle.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 justify-center">
            <Link to="/auth" className="inline-flex items-center gap-2 bg-ink text-paper font-semibold px-7 py-4 rounded-full hover:bg-ink/90 transition">
              Get Quottr <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/pricing" className="inline-flex items-center bg-paper/40 text-ink font-medium px-7 py-4 rounded-full hover:bg-paper/60 transition">
              See pricing
            </Link>
          </div>
          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/80 justify-center">
            {["Free 14-day trial", "No card required", "Cancel any time"].map((p) => (
              <li key={p} className="inline-flex items-center gap-2"><Check className="h-4 w-4" />{p}</li>
            ))}
          </ul>
        </div>
      </section>
    </MarketingShell>
  );
}
