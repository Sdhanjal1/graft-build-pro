import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  mockProfile, stats, formatGBP, getClient,
  todaysJobs, formatTime, getQuote,
} from "@/lib/mock-data";
import { Mic, ArrowRight, Sparkles } from "lucide-react";
import { QuottrWordmark } from "@/components/QuottrLogo";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Quottr — Home" },
      { name: "description", content: "Tap to start a quote. See what you're owed at a glance." },
    ],
  }),
});

function HomePage() {
  const s = stats();
  const today = todaysJobs();
  const firstName = mockProfile.full_name.split(" ")[0];
  const owedColor = s.outstanding > 0 ? "text-status-overdue" : "text-lime";

  return (
    <AppShell>
      <header className="bg-ink text-paper rounded-b-3xl px-5 pt-7 pb-8">
        <QuottrWordmark className="text-4xl" />
        <p className="mt-6 text-[10px] uppercase tracking-widest text-paper/60 font-semibold">
          Good morning
        </p>
        <h1 className="text-3xl leading-none mt-1 text-paper">{firstName}</h1>
        <p className="mt-1.5 text-sm text-paper/60">{mockProfile.business_name}</p>
      </header>

      {/* Big voice button */}
      <section className="px-5 mt-8 flex flex-col items-center">
        <Link
          to="/quotes/new"
          search={{ voice: 1 }}
          aria-label="Tap to start a quote"
          className="relative h-40 w-40 rounded-full bg-lime flex items-center justify-center shadow-[0_20px_50px_-12px_rgba(200,224,74,0.55)] active:scale-95 transition"
        >
          <span className="absolute inset-0 rounded-full bg-lime/30 animate-ping" />
          <Mic className="relative h-16 w-16 text-ink" strokeWidth={2.25} />
        </Link>
        <p className="mt-5 text-base font-semibold text-ink">Tap to start a quote</p>
        <p className="text-xs text-muted-foreground">Speak the job — we'll do the rest</p>
      </section>

      {/* You are owed */}
      <section className="px-5 mt-8">
        <div className="card-surface p-5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            You are owed
          </p>
          <p className={`num text-5xl mt-1 leading-none ${owedColor}`}>
            {formatGBP(s.outstanding)}
          </p>
          {s.outstanding > 0 ? (
            <Link
              to="/chaser"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink"
            >
              Chase unpaid invoices
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">All paid up — nice work.</p>
          )}
        </div>
      </section>

      {/* Today's jobs - only if any */}
      {today.length > 0 && (
        <section className="px-5 mt-4">
          <div className="card-surface p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-lime" />
              <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                Today's jobs
              </p>
            </div>
            <div className="space-y-2">
              {today.map((j) => {
                const q = getQuote(j.quote_id);
                const c = q ? getClient(q.client_id) : undefined;
                if (!q) return null;
                return (
                  <Link
                    key={j.id}
                    to="/quotes/$quoteId"
                    params={{ quoteId: q.id }}
                    className="flex items-center gap-3 active:scale-[0.99] transition"
                  >
                    <div className="num text-lg text-ink leading-none w-14 shrink-0">
                      {formatTime(j.starts_at)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{q.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c?.name} · {c?.address}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}
