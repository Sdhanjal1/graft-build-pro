import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/MarketingShell";
import { Mic, MapPin, Zap, FileText, CreditCard, BellRing, ArrowRight, Check } from "lucide-react";

export const Route = createFileRoute("/welcome")({
  component: WelcomePage,
  head: () => ({
    meta: [
      { title: "Quottr — Quote in seconds. Get paid faster." },
      { name: "description", content: "Voice-powered quoting, site capture and instant payments for tradespeople. Built by trades, for trades." },
      { property: "og:title", content: "Quottr — Quote in seconds. Get paid faster." },
      { property: "og:description", content: "Voice-powered quoting, site capture and instant payments for tradespeople." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://graft-build-pro.lovable.app/welcome" },
    ],
    links: [{ rel: "canonical", href: "https://graft-build-pro.lovable.app/welcome" }],
  }),
});

function WelcomePage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="bg-ink text-paper relative overflow-hidden">
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: "radial-gradient(circle at 80% 20%, color-mix(in oklab, var(--lime) 50%, transparent), transparent 60%)" }} />
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28 relative">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-paper/10 border border-paper/15 text-[11px] uppercase tracking-widest font-semibold text-paper/80">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" /> Now in beta
          </span>
          <h1 className="mt-6 text-5xl md:text-7xl leading-[0.95] text-paper max-w-3xl">
            Quote in seconds.<br />
            <span className="text-lime">Get paid faster.</span>
          </h1>
          <p className="mt-6 text-lg text-paper/75 max-w-xl">
            Voice-powered quotes, walk-around site capture and one-tap invoicing. Built for plumbers, sparks, gas engineers and every trade in between.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-2 bg-lime text-ink font-semibold px-6 py-3.5 rounded-full hover:brightness-95 transition"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center justify-center bg-paper/10 border border-paper/15 text-paper font-medium px-6 py-3.5 rounded-full hover:bg-paper/15 transition"
            >
              See how it works
            </a>
          </div>
          <div className="mt-10 flex items-center gap-6 text-xs text-paper/60">
            <span>No card required</span>
            <span className="h-1 w-1 rounded-full bg-paper/30" />
            <span>14-day free trial</span>
            <span className="h-1 w-1 rounded-full bg-paper/30" />
            <span>Cancel any time</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-20">
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-widest text-ink/50 font-semibold">Why Quottr</p>
          <h2 className="mt-2 text-4xl md:text-5xl">Built for the way you actually work.</h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { icon: Mic, title: "Voice to quote", body: "Mumble line items into your phone, get a priced, branded quote in seconds." },
            { icon: MapPin, title: "Site capture mode", body: "Walk the property, tap or speak items as you go, generate the quote after." },
            { icon: FileText, title: "Branded PDFs", body: "Your logo, your colours. Sent to the client by email or SMS in one tap." },
            { icon: CreditCard, title: "Get paid in-app", body: "Card, bank transfer, Apple Pay. Money lands in your account, not next month." },
            { icon: BellRing, title: "Auto chasers", body: "Polite reminders go out so you never have to ask twice for an overdue invoice." },
            { icon: Zap, title: "Annual reminders", body: "Boiler services, gas certs, water tests — Quottr tells you when to call the customer back." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-ink/10 bg-card p-6 hover:border-ink/20 transition">
              <div className="h-10 w-10 rounded-xl bg-lime/30 flex items-center justify-center">
                <f.icon className="h-5 w-5 text-ink" />
              </div>
              <h3 className="mt-4 text-2xl">{f.title}</h3>
              <p className="mt-2 text-sm text-ink/65 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-widest text-paper/50 font-semibold">How it works</p>
            <h2 className="mt-2 text-4xl md:text-5xl text-paper">From van to invoice in under a minute.</h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              { step: "01", title: "Capture on site", body: "Tap chips, talk into the mic, or snap photos. One hand, work gloves on." },
              { step: "02", title: "Quottr does the maths", body: "We price the job, add VAT if needed, and draft a professional quote." },
              { step: "03", title: "Send and get paid", body: "Client signs, pays, and you move on. No paperwork in the kitchen at 10pm." },
            ].map((s) => (
              <div key={s.step}>
                <p className="text-lime text-5xl">{s.step}</p>
                <h3 className="mt-3 text-2xl text-paper">{s.title}</h3>
                <p className="mt-2 text-sm text-paper/70 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { q: "I quoted three jobs from the van between calls. Used to take me a full evening.", who: "Nav P. — Gas engineer, Leeds" },
            { q: "The site capture mode is a game-changer. I just walk and tap.", who: "Sam R. — Plumber, Bristol" },
            { q: "Money lands the same day now. That alone paid for the subscription twice over.", who: "Dani O. — Electrician, Glasgow" },
          ].map((t) => (
            <figure key={t.who} className="rounded-2xl border border-ink/10 bg-card p-6">
              <blockquote className="text-lg leading-snug">“{t.q}”</blockquote>
              <figcaption className="mt-4 text-xs uppercase tracking-widest text-ink/55 font-semibold">{t.who}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="rounded-3xl bg-lime text-ink p-10 md:p-16 relative overflow-hidden">
          <div className="max-w-2xl">
            <h2 className="text-4xl md:text-5xl">Stop quoting in the evenings.</h2>
            <p className="mt-3 text-ink/80 text-lg">Try Quottr free for 14 days. No card, no contract, no hassle.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/auth" className="inline-flex items-center gap-2 bg-ink text-paper font-semibold px-6 py-3.5 rounded-full hover:bg-ink/90 transition">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/pricing" className="inline-flex items-center bg-paper/40 text-ink font-medium px-6 py-3.5 rounded-full hover:bg-paper/60 transition">
                See pricing
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/80">
              {["Free 14-day trial", "No card required", "Cancel any time"].map((p) => (
                <li key={p} className="inline-flex items-center gap-2"><Check className="h-4 w-4" />{p}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
