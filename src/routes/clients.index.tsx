import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { userClients, quotesForClient, formatGBP } from "@/lib/user-data";
import { Search, Phone, ArrowRight, UserPlus, Users, Inbox } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { useState } from "react";

function findDuplicateIds(clients: typeof userClients): Set<string> {
  const dupes = new Set<string>();
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  for (let i = 0; i < clients.length; i++) {
    for (let j = i + 1; j < clients.length; j++) {
      const a = norm(clients[i].name);
      const b = norm(clients[j].name);
      if (!a || !b) continue;
      const similar = a === b || a.startsWith(b + " ") || b.startsWith(a + " ");
      if (similar) {
        dupes.add(clients[i].id);
        dupes.add(clients[j].id);
      }
    }
  }
  return dupes;
}

export const Route = createFileRoute("/clients/")({
  component: ClientsPage,
});

function ClientsPage() {
  const [q, setQ] = useState("");
  const filtered = userClients.filter(
    (c) =>
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.address.toLowerCase().includes(q.toLowerCase()),
  );
  const duplicateIds = findDuplicateIds(userClients);

  return (
    <AppShell>
      <header className="px-5 pt-8 pb-4 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Customer book</p>
          <h1 className="text-4xl leading-none mt-1">Customers</h1>
        </div>
        <Link
          to="/clients/new"
          aria-label="Add new customer"
          className="h-11 px-4 rounded-full bg-lime text-ink inline-flex items-center gap-1.5 font-bold text-sm active:scale-95 transition"
        >
          <UserPlus className="h-4 w-4" />
          New
        </Link>
      </header>

      <div className="px-5">
        <div className="card-surface flex items-center gap-2 px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customers"
            className="bg-transparent flex-1 outline-none text-sm placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="px-5 mt-4 space-y-2.5">
        {filtered.length === 0 && (
          userClients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Customers you quote for will show here"
            />
          ) : (
            <EmptyState icon={Inbox} title="No matches" body={`No customers match "${q}".`} />
          )
        )}
        {filtered.map((c) => {
          const cQuotes = quotesForClient(c.id);
          const total = cQuotes.reduce((s, x) => s + x.total, 0);
          return (
            <Link
              to="/clients/$clientId"
              params={{ clientId: c.id }}
              key={c.id}
              className="card-surface p-4 flex items-center gap-3"
            >
              <div className="h-12 w-12 rounded-full bg-lime/30 flex items-center justify-center text-ink font-bold">
                {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">{c.address}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {c.phone}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {cQuotes.length} {cQuotes.length === 1 ? "quote" : "quotes"} · {formatGBP(total)}
                  </span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
