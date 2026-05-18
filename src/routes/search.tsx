import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { globalSearch, type SearchResult } from "@/lib/mock-data";
import { Search as SearchIcon, User, FileText, Calendar as CalendarIcon, X, Inbox } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/search")({
  component: SearchPage,
  head: () => ({
    meta: [
      { title: "Search — Quottr" },
      { name: "description", content: "Search across clients, quotes and jobs." },
    ],
  }),
});

function SearchPage() {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results: SearchResult[] = globalSearch(q);

  return (
    <AppShell>
      <PageHeader title="Search" subtitle="Find anything" back="/" />

      <section className="px-5">
        <div className="card-surface flex items-center gap-2 px-4 py-3">
          <SearchIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Client, postcode, QTR ref, job title…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Clear">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </section>

      <section className="px-5 mt-4 space-y-2">
        {q.trim() === "" && (
          <p className="text-center text-xs text-muted-foreground py-12">
            Start typing to search clients, quotes and scheduled jobs.
          </p>
        )}
        {q.trim() !== "" && results.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-12">No matches for “{q}”.</p>
        )}
        {results.map((r) => {
          const Icon = r.kind === "client" ? User : r.kind === "quote" ? FileText : CalendarIcon;
          const onClick = () => {
            if (r.kind === "client") navigate({ to: "/clients/$clientId", params: { clientId: r.id } });
            else if (r.kind === "quote") navigate({ to: "/quotes/$quoteId", params: { quoteId: r.id } });
            else navigate({ to: "/quotes/$quoteId", params: { quoteId: r.quoteId } });
          };
          return (
            <button
              key={`${r.kind}_${r.id}`}
              onClick={onClick}
              className="card-surface w-full p-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition"
            >
              <div className="h-10 w-10 rounded-full bg-lime/30 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-ink" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{r.kind}</p>
                <p className="text-sm font-semibold truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
              </div>
            </button>
          );
        })}
      </section>
    </AppShell>
  );
}
