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
        <div className="mx-auto max-w-4xl px-5 py-20 md:py-28">
          <p className="text-[11px] uppercase tracking-widest text-paper/60 font-semibold">Our story</p>
          <h1 className="mt-3 text-5xl md:text-7xl leading-[0.95] text-paper">
            Built for a plumber <span className="text-lime">called Nav.</span>
          </h1>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-20">
        <div className="space-y-6 text-lg md:text-xl text-ink/80 leading-relaxed">
          <p>
            Quottr started because my brother <strong>Nav</strong> — a plumber with 15 years
            experience — was spending every evening writing quotes on his phone.
          </p>
          <p>He hated it.</p>
          <p>
            We built Quottr in a <strong>week</strong>. He sent his first AI-generated quote
            before leaving a customer's drive.
          </p>
          <p className="text-2xl md:text-3xl text-ink" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            That was the moment we knew this was real.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-20 grid gap-12 md:grid-cols-2">
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

