import { createFileRoute, redirect, isRedirect, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getStackHealth,
  getIsAdmin,
  type StackHealth,
  type StackProbe,
} from "@/lib/ops.functions";

const stackQueryOptions = (fn: () => Promise<StackHealth>) =>
  queryOptions({
    queryKey: ["ops-stack-health"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/ops/stack")({
  ssr: false,
  beforeLoad: async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
    try {
      const { isAdmin } = await getIsAdmin();
      if (!isAdmin) throw redirect({ to: "/app" });
    } catch (e) {
      if (isRedirect(e)) throw e;
      throw redirect({ to: "/app" });
    }
  },
  component: StackPage,
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[var(--paper)] text-ink">
      <div className="card-surface p-6 max-w-md">
        <h1 className="font-display text-2xl mb-2">Stack error</h1>
        <p className="text-sm text-ink/70">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] text-ink">
      Not found
    </div>
  ),
});

function statusTone(s: StackProbe["status"]) {
  switch (s) {
    case "ok":
      return "bg-lime/40 text-ink";
    case "degraded":
      return "bg-amber-100 text-amber-900";
    case "down":
      return "bg-red-100 text-red-800";
    default:
      return "bg-ink/5 text-ink/60";
  }
}

function statusLabel(s: StackProbe["status"]) {
  return s === "ok" ? "OK" : s === "degraded" ? "Degraded" : s === "down" ? "Down" : "Unknown";
}

function StackPage() {
  const fn = useServerFn(getStackHealth);
  const { data } = useSuspenseQuery(stackQueryOptions(() => fn()));
  const qc = useQueryClient();

  const categories: StackProbe["category"][] = ["AI", "Payments", "Email", "Push", "Infra"];

  return (
    <div className="min-h-screen bg-[var(--paper)] text-ink">
      <header className="border-b border-ink/10">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl tracking-wide">Stack health</h1>
            <p className="text-xs text-ink/50 mt-1">
              Every external service this app depends on · live probes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/ops"
              className="text-xs px-3 py-1.5 rounded-full border border-ink/20 hover:bg-ink/5"
            >
              ← Ops
            </Link>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ["ops-stack-health"] })}
              className="text-xs px-3 py-1.5 rounded-full border border-ink/20 hover:bg-ink/5"
            >
              Recheck
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {categories.map((cat) => {
          const rows = data.probes.filter((p) => p.category === cat);
          if (rows.length === 0) return null;
          return (
            <section key={cat} className="space-y-3">
              <h2 className="text-xs uppercase tracking-[0.15em] text-ink/50 font-medium">
                {cat}
              </h2>
              <div className="card-surface divide-y divide-ink/5">
                {rows.map((p) => (
                  <div key={p.id} className="p-4 flex items-start gap-4">
                    <span
                      className={`text-[11px] font-medium px-2 py-1 rounded-full shrink-0 ${statusTone(p.status)}`}
                    >
                      {statusLabel(p.status)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="font-medium">{p.service}</div>
                        <div className="text-[11px] text-ink/40 shrink-0">
                          {p.latencyMs != null ? `${p.latencyMs}ms` : ""}
                          {p.httpStatus ? ` · HTTP ${p.httpStatus}` : ""}
                        </div>
                      </div>
                      <p className="text-sm text-ink/70 mt-0.5 break-words">{p.message}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-ink/50">
                        {p.secretName && <span className="font-mono">{p.secretName}</span>}
                        {p.topUpUrl && (
                          <a
                            href={p.topUpUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="underline hover:text-ink"
                          >
                            Top up ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <footer className="text-center text-[11px] text-ink/40 pt-2 pb-12">
          Full inventory: <code>docs/STACK.md</code> · refreshed{" "}
          {new Date(data.generatedAt).toLocaleTimeString("en-GB")}
        </footer>
      </main>
    </div>
  );
}
