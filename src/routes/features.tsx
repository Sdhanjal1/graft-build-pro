import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/MarketingShell";
import { Mic, MapPin, FileText, CreditCard, BellRing, Zap, MessageSquare, Calendar, Star, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/features")({
  component: FeaturesPage,
  head: () => ({
    meta: [
      { title: "Features, Quottr" },
      { name: "description", content: "Voice quoting, site capture, WhatsApp send, auto chasers and more. Everything Quottr does for tradespeople." },
      { property: "og:title", content: "Features, Quottr" },
      { property: "og:description", content: "Everything Quottr does, voice quoting, WhatsApp send, auto chasers, Google review requests, and more." },
      { property: "og:url", content: "https://www.quottr.co.uk/features" },
    ],
    links: [{ rel: "canonical", href: "https://www.quottr.co.uk/features" }],
  }),
});

const features = [
  { icon: Mic, title: "Voice to quote", body: "Mumble line items into your phone. Get a priced, branded quote in seconds." },
  { icon: MapPin, title: "Site capture mode", body: "Walk the property, tap or talk items as you go. Quottr drafts the quote after." },
  { icon: MessageSquare, title: "WhatsApp send", body: "One tap opens WhatsApp with a pre-written message and your customer portal link." },
  { icon: FileText, title: "Branded PDFs", body: "Your logo, your colours. Looks like you spent £2k on a brand designer." },
  { icon: CreditCard, title: "Get paid in-app", body: "Card, bank transfer, Apple Pay. Deposits land in your account, not next month." },
  { icon: BellRing, title: "Auto chasers", body: "Polite reminders go out at day 7, 14 and 21. You never have to ask twice." },
  { icon: Calendar, title: "Job diary", body: "Accepted quotes drop straight into your calendar. No double-bookings." },
  { icon: Star, title: "Google review requests", body: "When a job is marked complete, Quottr asks for a review. Your ranking does the rest." },
  { icon: Zap, title: "Annual reminders", body: "Boiler services, gas certs, water tests, Quottr tells you when to call them back." },
];

function FeaturesPage() {
  return (
    <MarketingShell>
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <p className="text-[11px] uppercase tracking-widest text-paper/50 font-semibold">Features</p>
          <h1 className="mt-3 text-5xl md:text-7xl leading-[0.95] text-paper max-w-3xl">
            Everything you need. <span className="text-lime">Nothing you don't.</span>
          </h1>
          <p className="mt-5 text-lg text-paper/75 max-w-2xl">
            Quottr replaces three apps, a notebook and a stack of Post-its. Here's the lot.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-5 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-ink/10 bg-card p-6 hover:border-ink/20 transition">
              <div className="h-11 w-11 rounded-xl bg-lime/30 flex items-center justify-center">
                <f.icon className="h-5 w-5 text-ink" />
              </div>
              <h3 className="mt-4 text-2xl">{f.title}</h3>
              <p className="mt-2 text-sm text-ink/65 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
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
