import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/MarketingShell";
import { ArrowRight, Check } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Quottr: stop quoting in the evenings" },
      { name: "description", content: "Voice to professional quote in seconds. Sent via WhatsApp. Customer can accept and pay on the spot." },
      { property: "og:title", content: "Quottr: stop quoting in the evenings" },
      { property: "og:description", content: "Voice to professional quote in seconds. Sent via WhatsApp. Customer can accept and pay on the spot." },
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
        {/* off-centre glow, not the templated centred radial */}
        <div className="absolute -top-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-lime/15 blur-[130px] pointer-events-none" />

        <div className="mx-auto max-w-7xl px-5 md:px-8 pt-14 md:pt-24 pb-14 md:pb-20 relative">
          <div className="grid md:grid-cols-[1.05fr_0.95fr] gap-10 md:gap-14 items-center">

            {/* LEFT — thesis, left-aligned, no eyebrow pill */}
            <div className="max-w-xl">
              <h1
                className="text-paper leading-[0.82]"
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(3.25rem, 8.5vw, 7rem)", letterSpacing: "0.005em" }}
              >
                Speak it. <span className="text-lime">Quote it.</span><br />
                Send it. <span className="text-lime">Get paid.</span>
              </h1>

              <p className="mt-5 text-lg md:text-xl text-paper/75 leading-snug max-w-md">
                Talk through the job on site. Quottr writes the quote, sends it on WhatsApp, and takes the payment. No more quoting in the evenings.
              </p>

              <div className="mt-8 flex items-center gap-4 flex-wrap">
                <Link
                  to="/auth"
                  className="inline-flex items-center justify-center gap-2 bg-lime text-ink font-bold px-7 py-4 rounded-full hover:brightness-95 transition text-base"
                >
                  Start quoting free <ArrowRight className="h-4 w-4" />
                </Link>
                <span className="text-sm text-paper/55">14-day trial · no card</span>
              </div>
            </div>

            {/* RIGHT — the real product moment, promoted to co-hero */}
            <div className="relative">
              <div className="relative mx-auto max-w-sm md:max-w-none rounded-[2rem] overflow-hidden border border-paper/10 bg-ink shadow-2xl ring-1 ring-lime/25">
                <video
                  src="/quottr-how-it-works.mp4"
                  autoPlay muted loop playsInline preload="metadata"
                  className="w-full h-auto block"
                  aria-label="Voice to quote to paid in seconds"
                />
              </div>
              <p className="mt-3 text-center md:text-left text-[11px] text-paper/50 uppercase tracking-widest font-semibold">
                From voice to paid, in seconds
              </p>
            </div>

          </div>
        </div>
      </section>


      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-5xl px-5 md:px-8 py-20 md:py-28">
        <h2 className="text-5xl md:text-7xl leading-[0.95] max-w-3xl" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          From <span className="text-ink bg-lime px-2 box-decoration-clone">van to paid</span>, in seconds.
        </h2>

        <ol className="mt-12 md:mt-16 max-w-3xl">
          {[
            { n: "01", t: "Speak the job", b: "One voice note from the van. No typing, no forms, just talk." },
            { n: "02", t: "Quote's ready", b: "Quottr writes a fully itemised, professional quote with up-to-date UK trade pricing, branded with your logo." },
            { n: "03", t: "Send and get paid", b: "Your customer gets a WhatsApp link, approves the job, and pays on the spot. You get a notification. Money in before you start." },
          ].map((s, i, arr) => (
            <li key={s.n} className="relative grid grid-cols-[auto_1fr] gap-5 md:gap-8 pb-10 last:pb-0">
              <div className="flex flex-col items-center">
                <span className="text-lime leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(2.75rem, 7vw, 4.5rem)" }}>{s.n}</span>
                {i < arr.length - 1 && <span className="mt-2 w-px flex-1 bg-lime/30" />}
              </div>
              <div className="pt-1 md:pt-2">
                <h3 className="text-2xl md:text-3xl leading-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{s.t}</h3>
                <p className="mt-2 text-base md:text-lg text-ink/70 leading-relaxed max-w-md">{s.b}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12">
          <Link to="/auth" className="inline-flex items-center gap-2 bg-ink text-paper font-bold px-7 py-4 rounded-full hover:bg-ink/90 transition">
            Start quoting free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* WHAT IT DOES */}
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-5 md:px-8 py-20 md:py-28">
          <h2 className="text-4xl md:text-6xl leading-[0.95] text-paper max-w-3xl" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            Quottr does the bits <span className="text-lime">other software won't.</span>
          </h2>

          <div className="mt-14 grid gap-px bg-paper/10 md:grid-cols-2 rounded-3xl overflow-hidden">
            {[
              {
                kicker: "Voice",
                title: "Built for dirty hands",
                body: "One voice note from a muddy van, a dusty loft, or under a sink. Quottr turns it into a professional quote while you drive to the next job.",
              },
              {
                kicker: "Customer portal",
                title: "Every customer gets a portal",
                body: "A private link where they see every quote, every invoice, every certificate. They approve jobs and pay without you making a single call.",
              },
              {
                kicker: "Auto-chase",
                title: "Chases money while you sleep",
                body: "Unpaid invoice? Quottr sends polite, escalating reminders at 7, 14 and 21 days. Automatically. You stay on the tools, the money comes to you.",
              },
              {
                kicker: "Payments",
                title: "Get paid on the spot",
                body: "Take card payments on site with tap-to-pay, or let customers pay the second they approve the quote. Money in your account, no awkward calls.",
              },
            ].map((f) => (
              <div key={f.title} className="bg-ink p-8 md:p-10">
                <span className="text-[11px] uppercase tracking-[0.2em] font-bold text-lime">{f.kicker}</span>
                <h3 className="mt-4 text-3xl md:text-4xl text-paper leading-[0.95]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{f.title}</h3>
                <p className="mt-3 text-paper/70 leading-relaxed max-w-md">{f.body}</p>
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
          Export your records to Xero, QuickBooks, FreeAgent and Sage — formatted to import cleanly. No double entry. No spreadsheets. HMRC happy.
        </p>
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          {["Xero", "QuickBooks", "FreeAgent", "Sage"].map((name) => (
            <div key={name} className="h-24 rounded-2xl border border-ink/10 bg-card flex flex-col items-center justify-center">
              <span className="text-xl font-semibold text-ink/75">{name}</span>
              <span className="mt-1 text-[10px] uppercase tracking-widest text-ink/45 font-semibold">CSV export</span>
            </div>
          ))}
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
