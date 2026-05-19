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
      { property: "og:url", content: "https://graft-build-pro.lovable.app/about" },
    ],
    links: [{ rel: "canonical", href: "https://graft-build-pro.lovable.app/about" }],
  }),
});

function AboutPage() {
  return (
    <MarketingShell>
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-4xl px-5 py-20">
          <p className="text-[11px] uppercase tracking-widest text-paper/60 font-semibold">Our story</p>
          <h1 className="mt-3 text-5xl md:text-6xl text-paper">Built for the van, not the desk.</h1>
          <p className="mt-6 text-lg text-paper/75 max-w-2xl">
            Quottr started in a Transit Custom with a half-eaten sandwich and a stack of unsent quotes.
            We're a small team of engineers and ex-tradespeople on a mission to kill the evening admin
            so you can be home for tea.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-20 grid gap-12 md:grid-cols-2">
        <div>
          <h2 className="text-3xl">What we believe</h2>
          <p className="mt-4 text-ink/70 leading-relaxed">
            Tradespeople deserve software that respects their time. No 40-click onboarding,
            no enterprise jargon, no "upgrade to unlock". Just the fastest path from job-on-site
            to money-in-bank.
          </p>
        </div>
        <div>
          <h2 className="text-3xl">What we won't do</h2>
          <p className="mt-4 text-ink/70 leading-relaxed">
            We won't charge per quote. We won't lock features behind enterprise plans you don't need.
            And we'll never make you sit through a sales demo to use the product.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-24">
        <div className="rounded-3xl bg-card border border-ink/10 p-10 text-center">
          <h2 className="text-3xl md:text-4xl">Ready to give it a go?</h2>
          <p className="mt-3 text-ink/70">14 days free. No card. Cancel any time.</p>
          <Link
            to="/auth"
            className="mt-6 inline-flex items-center gap-2 bg-ink text-paper font-semibold px-6 py-3.5 rounded-full hover:bg-ink/90"
          >
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
