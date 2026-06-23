import { createFileRoute, Link } from "@tanstack/react-router";
import { RouteError, RouteNotFound } from "@/components/RouteBoundary";
import { AppShell, PageHeader } from "@/components/AppShell";
import { userClients, quotesForClient, formatGBP, useHasHydrated } from "@/lib/user-data";
import { Search, ArrowRight, UserPlus, Users, Inbox, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { useState } from "react";

function findDuplicatesMap(clients: typeof userClients): Map<string, string> {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const matches = new Map<string, string>();
  for (let i = 0; i < clients.length; i++) {
    for (let j = i + 1; j < clients.length; j++) {
      const a = norm(clients[i].name);
      const b = norm(clients[j].name);
      if (!a || !b) continue;
      const similar = a === b || a.startsWith(b + " ") || b.startsWith(a + " ");
      if (similar) {
        if (!matches.has(clients[i].id)) matches.set(clients[i].id, clients[j].name);
        if (!matches.has(clients[j].id)) matches.set(clients[j].id, clients[i].name);
      }
    }
  }
  return matches;
}

export const Route = createFileRoute("/clients/")({
  component: ClientsPage,
  errorComponent: RouteError,
  notFoundComponent: () => <RouteNotFound />,
});

function ClientsPage() {
  const [q, setQ] = useState("");
  const hydrated = useHasHydrated();
  const filtered = userClients.filter(
    (c) =>
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.address.toLowerCase().includes(q.toLowerCase()),
  );
  const duplicates = findDuplicatesMap(userClients);

  const newCustomerPill = (
    <Link
      to="/clients/new"
      aria-label="Add new customer"
      className="h-9 px-3.5 rounded-full bg-lime text-ink inline-flex items-center gap-1.5 font-bold text-xs active:scale-95 transition"
    >
      <UserPlus className="h-3.5 w-3.5" />
      New
    </Link>
  );

  return (
    <AppShell>
      <PageHeader title="Customers" subtitle="Customer book" right={newCustomerPill} />

      <div className="px-5 mt-5">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customers"
            className="w-full h-11 pl-10 pr-3 rounded-full bg-card border border-border text-[15px] placeholder:text-muted-foreground focus:outline-none focus:border-ink/30 transition-colors"
          />
        </div>
      </div>

      <div className="px-5 mt-4 space-y-2">
        {!hydrated && (
          <>
            <Skeleton className="h-16 w-full rounded-2xl bg-ink/5" />
            <Skeleton className="h-16 w-full rounded-2xl bg-ink/5" />
            <Skeleton className="h-16 w-full rounded-2xl bg-ink/5" />
          </>
        )}
        {hydrated && filtered.length === 0 && (
          userClients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No customers yet."
              body="They land here when you quote."
              cta={{ label: "Add customer", to: "/clients/new" }}
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title="Nothing matches."
              body={`No customers match "${q}".`}
              cta={{ label: `Add "${q}" as a customer`, to: "/clients/new", search: { name: q } }}
            />
          )
        )}
        {hydrated && filtered.map((c) => {
          const cQuotes = quotesForClient(c.id);
          const total = cQuotes.reduce((s, x) => s + x.total, 0);
          const paidTotal = cQuotes
            .filter((x) => x.status === "paid")
            .reduce((s, x) => s + x.total, 0);
          const dupOf = duplicates.get(c.id);
          return (
            <Link
              to="/clients/$clientId"
              params={{ clientId: c.id }}
              key={c.id}
              className={`card-surface p-3 flex items-center gap-3 relative ${dupOf ? "border-l-2 border-l-amber-400" : ""}`}
            >
              <div className="h-10 w-10 rounded-full bg-lime/30 flex items-center justify-center text-ink text-sm font-bold shrink-0">
                {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{c.name}</p>
                {c.address && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{c.address}</p>
                )}
                {dupOf && (
                  <span
                    className="inline-flex items-center gap-1 mt-1 rounded-full bg-amber-400/15 text-amber-700 px-1.5 py-0.5 text-[10px] font-semibold max-w-full"
                    title={`Looks similar to ${dupOf}`}
                  >
                    <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">Possible duplicate</span>
                  </span>
                )}
              </div>
              <div className="text-right shrink-0">
                {total > 0 ? (
                  <>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Quoted</p>
                    <p className="num text-sm text-ink tabular-nums leading-tight">{formatGBP(total)}</p>
                    {paidTotal > 0 ? (
                      <p className="text-[11px] text-status-accepted mt-0.5 tabular-nums">
                        {formatGBP(paidTotal)} paid
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {cQuotes.length} {cQuotes.length === 1 ? "quote" : "quotes"}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground">No quotes</p>
                )}
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/60 ml-1 shrink-0" />
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
