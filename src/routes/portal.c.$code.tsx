import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getClientPortalData,
  respondQuoteFromPortal,
} from "@/lib/portal.functions";
import { downloadPortalPdf } from "@/lib/portal-pdf";
import { BusinessLogo } from "@/components/BusinessLogo";
import { QuottrLogo } from "@/components/QuottrLogo";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Bell,
  Sparkles,
  Check,
  X,
} from "lucide-react";

export const Route = createFileRoute("/portal/c/$code")({
  component: ClientPortalPage,
  head: ({ params }) => ({
    meta: [
      { title: "Your quote from Quottr" },
      {
        name: "description",
        content: "View, accept and pay your quote securely online.",
      },
      { property: "og:title", content: "Your quote is ready to view" },
      {
        property: "og:description",
        content: "Tap to view, accept and pay your quote securely online.",
      },
      { property: "og:image", content: "https://quottr.co.uk/og-quottr.jpg" },
      { name: "twitter:image", content: "https://quottr.co.uk/og-quottr.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      {
        property: "og:url",
        content: `https://quottr.co.uk/portal/c/${params.code}`,
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function formatGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
    Number(n) || 0,
  );
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Quoted",
  sent: "Quoted",
  accepted: "Accepted",
  declined: "Declined",
  paid: "Paid",
  overdue: "Overdue",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-status-pending/15 text-status-pending",
  sent: "bg-status-pending/15 text-status-pending",
  accepted: "bg-status-accepted/15 text-status-accepted",
  declined: "bg-muted text-muted-foreground",
  paid: "bg-lime/30 text-ink",
  overdue: "bg-status-overdue/15 text-status-overdue",
};

type Data = Awaited<ReturnType<typeof getClientPortalData>>;

function ClientPortalPage() {
  const { code } = Route.useParams();
  const fetchData = useServerFn(getClientPortalData);
  const postMsg = useServerFn(postClientPortalMessage);
  const respondQuote = useServerFn(respondQuoteFromPortal);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Data | null>(null);

  const nameKey = `quottr_portal_${code}_name`;
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(nameKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setFirstName(parsed.first ?? "");
        setLastName(parsed.last ?? "");
        setConfirmed(true);
      }
    } catch {}
  }, [nameKey]);

  const load = async () => {
    try {
      const r = await fetchData({ data: { code } });
      setData(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load portal");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // Poll every 15s so customer sees pro replies + status changes
    pollRef.current = window.setInterval(() => void load(), 15000) as unknown as number;
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const onRespond = async (quoteId: string, response: "accepted" | "declined") => {
    const confirmMsg =
      response === "accepted"
        ? "Accept this quote? Your tradesperson will be notified."
        : "Decline this quote?";
    if (!confirm(confirmMsg)) return;
    setRespondingId(quoteId);
    try {
      await respondQuote({ data: { code, quoteId, response } });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not update quote");
    } finally {
      setRespondingId(null);
    }
  };

  const confirmName = () => {
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first) return;
    localStorage.setItem(nameKey, JSON.stringify({ first, last }));
    setConfirmed(true);
  };



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper px-6 text-center">
        <div>
          <h1 className="text-2xl mb-2">Portal not available</h1>
          <p className="text-sm text-muted-foreground">
            {error ?? "This portal link is no longer active."}
          </p>
        </div>
      </div>
    );
  }

  const { profile, quotes, documents, messages, client } = data;
  const businessName = profile?.business_name ?? "Your tradesperson";

  if (!confirmed) {
    return (
      <div className="min-h-screen bg-paper flex flex-col">
        <header className="bg-ink text-paper px-5 pt-6 pb-5 flex items-center gap-3">
          <BusinessLogo
            logoUrl={(profile as any)?.logo_url}
            businessName={businessName}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate">{businessName}</p>
            <p className="text-[10px] text-paper/60">Customer Portal</p>
          </div>
        </header>
        <div className="flex-1 px-5 py-8 max-w-md mx-auto w-full">
          <h1 className="text-3xl leading-tight">Welcome</h1>
          <p className="text-sm text-muted-foreground mt-2">
            To access your quotes and service history, please confirm your name.
          </p>
          <div className="mt-6 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                First name
              </label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-lime/40"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Last name
              </label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full bg-secondary rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-lime/40"
              />
            </div>
            <button
              onClick={confirmName}
              disabled={!firstName.trim()}
              className="w-full bg-lime text-ink rounded-full py-3.5 font-bold disabled:opacity-50"
            >
              Confirm
            </button>
          </div>
        </div>
        <footer className="text-center py-4 text-[10px] text-muted-foreground">
          <a href="https://quottr.co.uk" className="inline-flex items-center gap-1">
            Powered by <QuottrLogo className="h-3 w-auto" />
          </a>
        </footer>
      </div>
    );
  }

  const daysUntilService = client.service_due_date
    ? Math.ceil(
        (new Date(client.service_due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      )
    : null;

  return (
    <div className="min-h-screen bg-paper pb-32">
      <header className="bg-ink text-paper px-5 pt-6 pb-5 flex items-center gap-3">
        <BusinessLogo
          logoUrl={(profile as any)?.logo_url}
          businessName={businessName}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">{businessName}</p>
          <p className="text-[10px] text-paper/60 truncate">Hi {firstName}</p>
        </div>
        <QuottrLogo className="h-5 w-auto opacity-60" />
      </header>

      {/* Service reminder */}
      {daysUntilService !== null && daysUntilService <= 60 && daysUntilService >= -30 && (
        <section className="px-5 mt-5">
          <div className="block rounded-2xl p-4 bg-gradient-to-br from-amber-300 to-amber-500 text-ink">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-ink/15 flex items-center justify-center shrink-0">
                <Bell className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">
                  Your {client.service_type ?? "annual service"} is{" "}
                  {daysUntilService > 0
                    ? `due in ${daysUntilService} day${daysUntilService === 1 ? "" : "s"}`
                    : daysUntilService === 0
                      ? "due today"
                      : `${Math.abs(daysUntilService)} day${Math.abs(daysUntilService) === 1 ? "" : "s"} overdue`}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}


      {/* Quotes */}
      <section className="px-5 mt-6">
        <h2 className="text-xl mb-3">Your quotes & jobs</h2>
        {quotes.length === 0 ? (
          <div className="card-surface p-6 text-center text-sm text-muted-foreground">
            No quotes yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {quotes.map((q: any) => {
              const expanded = expandedId === q.id;
              const lineItems = (q.line_items as any[]) ?? [];
              return (
                <div key={q.id} className="card-surface overflow-hidden">
                  <button
                    onClick={() => setExpandedId(expanded ? null : q.id)}
                    className="w-full text-left p-4 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                            STATUS_STYLE[q.status] ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {STATUS_LABEL[q.status] ?? q.status}
                        </span>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                          {new Date(q.created_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="font-semibold text-sm mt-1 truncate">{q.title}</p>
                    </div>
                    <div className="text-right">
                      <p className="num text-xl text-ink">{formatGBP(q.total)}</p>
                    </div>
                    <div className="text-muted-foreground">
                      {expanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </button>
                  {expanded && (
                    <div className="border-t border-border bg-secondary/30">
                      {q.job_description && (
                        <div className="px-4 py-3">
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                            Job description
                          </p>
                          <p className="text-sm mt-1 whitespace-pre-line">{q.job_description}</p>
                        </div>
                      )}
                      <ul className="border-t border-border">
                        {lineItems.map((li, i) => (
                          <li
                            key={i}
                            className="px-4 py-2.5 flex items-start gap-3 border-t border-border first:border-t-0"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{li.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {li.qty} × {formatGBP(li.unit_price)}
                              </p>
                            </div>
                            <p className="num text-sm">
                              {formatGBP((li.qty || 0) * (li.unit_price || 0))}
                            </p>
                          </li>
                        ))}
                      </ul>
                      <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total</span>
                        <span className="num text-lg">{formatGBP(q.total)}</span>
                      </div>
                      {(q.status === "pending" || q.status === "sent") && (
                        <div className="px-4 py-3 border-t border-border grid grid-cols-2 gap-2">
                          <button
                            onClick={() => onRespond(q.id, "declined")}
                            disabled={respondingId === q.id}
                            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border py-2.5 text-xs font-semibold disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            Decline
                          </button>
                          <button
                            onClick={() => onRespond(q.id, "accepted")}
                            disabled={respondingId === q.id}
                            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-lime text-ink py-2.5 text-xs font-bold disabled:opacity-50"
                          >
                            {respondingId === q.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Accept quote
                          </button>
                        </div>
                      )}
                      <div className="px-4 py-3 border-t border-border">
                        <button
                          onClick={() =>
                            void downloadPortalPdf(
                              {
                                ref: q.ref,
                                title: q.title,
                                job_description: q.job_description,
                                status: q.status,
                                subtotal: Number(q.subtotal) || 0,
                                vat_amount: Number(q.vat_amount) || 0,
                                total: Number(q.total) || 0,
                                vat_registered: q.vat_registered,
                                created_at: q.created_at,
                                line_items: lineItems,
                              },
                              {
                                name: client.name,
                                address: (client as any).address ?? null,
                              },
                              profile as any,
                              q.status === "paid" ? "invoice" : "quote",
                            )
                          }
                          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-ink text-paper py-2.5 text-xs font-semibold"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download PDF
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Documents */}
      {documents.length > 0 && (
        <section className="px-5 mt-6">
          <h2 className="text-xl mb-3">Your documents</h2>
          <div className="space-y-2">
            {documents.map((d: any) => (
              <a
                key={d.id}
                href={d.file_url}
                target="_blank"
                rel="noreferrer"
                className="card-surface p-3 flex items-center gap-3"
              >
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{d.title}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    {d.kind}
                  </p>
                </div>
                <Download className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </div>
        </section>
      )}




      {/* Request a new quote */}
      <section className="px-5 mt-6">
        {profile?.id && (
          <a
            href={`/request/${profile.id}`}
            className="block rounded-2xl bg-lime text-ink p-5 text-center"
          >
            <Sparkles className="h-5 w-5 mx-auto mb-1" />
            <p className="font-bold text-base">Need something else?</p>
            <p className="text-xs text-ink/70 mt-0.5">
              Request a quote from {businessName}
            </p>
          </a>
        )}
      </section>

      <footer className="text-center mt-8 mb-4 text-[10px] text-muted-foreground">
        <a href="https://quottr.co.uk" className="inline-flex items-center gap-1">
          Powered by <QuottrLogo className="h-3 w-auto" />
        </a>
      </footer>

    </div>
  );
}
