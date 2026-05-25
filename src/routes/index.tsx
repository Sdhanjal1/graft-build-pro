import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/MarketingShell";
import { ArrowRight, Check, Mic, FileCheck, Bell, MapPin } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Quottr: stop quoting in the evenings" },
      { name: "description", content: "Voice to professional quote in 18 seconds. Sent via WhatsApp. Customer pays the deposit before you leave the drive." },
      { property: "og:title", content: "Quottr: stop quoting in the evenings" },
      { property: "og:description", content: "Voice to professional quote in 18 seconds. Sent via WhatsApp. Customer pays the deposit before you leave the drive." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.quottr.co.uk/" },
    ],
    links: [{ rel: "canonical", href: "https://www.quottr.co.uk/" }],
  }),
});

function HomePage() {
  return (
    <MarketingShell>
      {/* HERO */}
      <section className="bg-ink text-paper relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: "radial-gradient(circle at 50% 0%, color-mix(in oklab, var(--lime) 35%, transparent), transparent 55%)" }}
        />
        <div className="mx-auto max-w-7xl px-5 pt-16 md:pt-24 pb-12 md:pb-16 relative text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-paper/10 border border-paper/15 text-[11px] uppercase tracking-widest font-semibold text-paper/80">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" /> Voice-first for trades
          </span>

          <h1
            className="mt-8 text-lime leading-[0.8] tracking-tight"
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(5rem, 22vw, 18rem)" }}
          >
            Quottr.
          </h1>

          <h2
            className="mt-6 text-paper text-4xl md:text-6xl leading-[0.95] max-w-4xl mx-auto"
            style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.01em" }}
          >
            Speak it. <span className="text-lime">Quote it.</span> Send it. <span className="text-lime">Get paid.</span>
          </h2>

          <p className="mt-6 text-base md:text-lg text-paper/75 max-w-2xl mx-auto">
            Voice to professional quote in 18 seconds. Sent via WhatsApp. Customer pays the deposit before you leave the drive.
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
                aria-label="One tap. Money in. Voice to quote to paid in 18 seconds."
              />
            </div>
            <p className="mt-3 text-xs text-paper/50 uppercase tracking-widest font-semibold">
              Voice → Quote → Paid · 18 seconds
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-5xl px-5 py-20 md:py-28 text-center">
        <p className="text-[11px] uppercase tracking-widest text-ink/50 font-semibold">How it works</p>
        <h2 className="mt-3 text-5xl md:text-7xl leading-[0.95]">
          18 seconds from <span className="text-lime-ink bg-lime px-2">van to paid</span>.
        </h2>
        <ol className="mt-14 grid gap-8 md:grid-cols-3 text-left">
          {[
            {
              n: "01",
              t: "Speak the job",
              b: "One voice note from the van. No typing. No forms. Just talk.",
            },
            {
              n: "02",
              t: "Quote ready",
              b: "Claude AI generates a fully itemised professional quote with 2026 UK trade pricing. Branded with your logo.",
            },
            {
              n: "03",
              t: "WhatsApp it",
              b: "Customer gets a link. They view, approve, and pay the deposit. You get a notification. Money in before you start.",
            },
          ].map((s) => (
            <li key={s.n} className="rounded-2xl border border-ink/10 bg-card p-7">
              <div className="text-lime text-sm font-semibold tracking-widest">{s.n}</div>
              <h3 className="mt-3 text-2xl md:text-3xl leading-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{s.t}</h3>
              <p className="mt-3 text-sm text-ink/70 leading-relaxed">{s.b}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 bg-ink text-paper font-semibold px-7 py-4 rounded-full hover:bg-ink/90 transition"
          >
            Start for free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* FEATURE CARDS */}
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <div className="max-w-3xl">
            <p className="text-[11px] uppercase tracking-widest text-paper/50 font-semibold">Built for the trades, not the office</p>
            <h2 className="mt-3 text-4xl md:text-6xl leading-[0.95] text-paper">
              Quottr does the bits <span className="text-lime">other software won't.</span>
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {[
              {
                icon: Mic,
                title: "Built for dirty hands",
                body: "One voice note from a muddy van, a dusty loft, or under a sink. Quottr turns it into a professional quote while you drive to the next job.",
              },
              {
                icon: FileCheck,
                title: "Your customer gets a portal",
                body: "Every customer gets a private link. They see every quote, every invoice, every Gas Safe cert. They approve jobs and pay deposits without you making a single call.",
              },
              {
                icon: Bell,
                title: "Chases money while you sleep",
                body: "Unpaid invoice? Quottr sends polite escalating reminders at 7, 14 and 21 days. Automatically. You stay on the tools. The money comes to you.",
              },
              {
                icon: MapPin,
                title: "Site capture mode",
                body: "Walk around a property tapping items as you find them. Boiler. Radiators. Pipework. Get back to the van and generate one complete quote from everything you captured.",
              },
            ].map((p) => (
              <div key={p.title} className="rounded-2xl border border-paper/10 bg-paper/[0.03] p-7 hover:bg-paper/[0.06] transition">
                <div className="h-11 w-11 rounded-xl bg-lime flex items-center justify-center">
                  <p.icon className="h-5 w-5 text-ink" />
                </div>
                <h3 className="mt-5 text-2xl md:text-3xl text-paper uppercase" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{p.title}</h3>
                <p className="mt-3 text-sm text-paper/70 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ACCOUNTING / MTD */}
      <section className="mx-auto max-w-6xl px-5 py-20 md:py-24">
        <p className="text-[11px] uppercase tracking-widest text-ink/50 font-semibold">Accounting, sorted</p>
        <h2 className="mt-3 text-4xl md:text-6xl leading-[1.0] max-w-4xl" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          Making Tax Digital ready.
        </h2>
        <p className="mt-5 text-lg text-ink/70 max-w-3xl">
          Every invoice you raise in Quottr feeds straight into Xero, QuickBooks, FreeAgent and Sage. No double entry. No spreadsheets. HMRC happy.
        </p>
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          {["Xero", "QuickBooks", "FreeAgent", "Sage"].map((name) => (
            <div key={name} className="h-24 rounded-2xl border border-ink/10 bg-card flex flex-col items-center justify-center">
              <span className="text-xl font-semibold text-ink/75">{name}</span>
              <span className="mt-1 text-[10px] uppercase tracking-widest text-ink/45 font-semibold">Coming soon</span>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-card border-y border-ink/10">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="text-[11px] uppercase tracking-widest text-ink/50 font-semibold">Straight from the van</p>
          <h2 className="mt-3 text-3xl md:text-5xl leading-[1.05] max-w-3xl">
            The trades are loving Quottr.
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { q: "Quoted a full bathroom refit from the van in 40 seconds. Customer approved it before I got home. Deposit paid same day.", who: "Ryan T., Gas engineer, Leeds" },
              { q: "The site capture mode is the one. Walk round, tap what needs doing, quote it all at once. Game changer for bigger jobs.", who: "Sam R., Plumber, Bristol" },
              { q: "Had £3,200 outstanding for months. Quottr chased it all automatically. Got paid within two weeks without a single awkward call.", who: "Dani O., Electrician, Glasgow" },
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
