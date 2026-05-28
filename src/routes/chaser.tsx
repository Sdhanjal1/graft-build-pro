import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  mockQuotes, getClient, userProfile, formatGBP, buildChaserMessage,
  buildChaseMessageForOffset, chasesDueNow, upcomingChases, markChaseSent, skipChase,
  setQuoteAutoChase, waLink,
} from "@/lib/user-data";
import { MessageCircle, Phone, Mail, Clock, Check, X as XIcon, ThumbsUp, Pause, Play } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { feedback } from "@/lib/feedback";

/** Tone label + colour for an escalation step. */
function chaseTone(offset: number, offsets: number[]) {
  if (offset === offsets[0]) return { label: "Polite reminder", chip: "bg-lime text-ink" };
  if (offset === offsets[1]) return { label: "Firm follow-up", chip: "bg-status-completed/20 text-status-completed" };
  return { label: "Final notice", chip: "bg-status-overdue text-paper" };
}


export const Route = createFileRoute("/chaser")({
  component: ChaserPage,
});

function daysOverdue(due?: string) {
  if (!due) return 0;
  const ms = Date.now() - new Date(due).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function ChaserPage() {
  // Include both completed (job done, awaiting payment) and overdue invoices —
  // these are the unpaid jobs the trader is waiting on.
  const overdue = mockQuotes.filter((q) => q.status === "completed" || q.status === "overdue");
  const total = overdue.reduce((s, q) => s + q.total, 0);
  const [, force] = useState(0);
  const due = chasesDueNow();
  const upcoming = upcomingChases().slice(0, 4);

  return (
    <AppShell>
      <PageHeader title="Invoice chaser" subtitle="Awaiting payment" back="/" />

      <section className="px-5">
        <div className="rounded-2xl bg-status-overdue/10 border border-status-overdue/30 p-5">
          <p className="text-xs uppercase tracking-widest text-status-overdue font-semibold">You are owed</p>
          <p className="num text-4xl mt-1 text-status-overdue">{formatGBP(total)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {overdue.length} {overdue.length === 1 ? "invoice" : "invoices"} awaiting payment
          </p>
        </div>
      </section>

      {/* Auto-chase queue */}
      {(due.length > 0 || upcoming.length > 0) && (
        <section className="px-5 mt-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-ink" />
            <h2 className="text-lg">Auto-chase queue</h2>
          </div>

          {due.length > 0 && (
            <div className="space-y-2 mb-3">
              {due.map(({ chase, quote }) => {
                const c = getClient(quote.client_id);
                const first = c?.name.split(" ")[0] ?? "there";
                const text = buildChaseMessageForOffset(quote, first, chase.day_offset);
                const wa = waLink(c?.phone, text);
                const autoIn = chase.auto_send_at
                  ? Math.max(0, Math.round((new Date(chase.auto_send_at).getTime() - Date.now()) / 60000))
                  : null;
                const offsets = userProfile.chase_offsets ?? [7, 14, 21];
                const tone = chaseTone(chase.day_offset, offsets);
                return (
                  <div key={chase.id} className="rounded-2xl bg-lime/15 border border-lime/40 p-3.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] uppercase tracking-widest font-bold rounded-full px-2 py-0.5 ${tone.chip}`}>
                        Day {chase.day_offset} · {tone.label}
                      </span>
                      <p className="text-xs font-semibold text-ink truncate">{quote.ref} · {c?.name}</p>
                    </div>
                    <p className="text-xs text-ink/70 truncate mt-1">
                      Chase ready to send to {c?.name}, {formatGBP(quote.total)}, {chase.day_offset} days overdue
                    </p>
                    {autoIn !== null && (
                      <p className="text-[10px] text-ink/60 mt-1">
                        Auto-sends in {autoIn >= 60 ? `${Math.floor(autoIn / 60)}h ${autoIn % 60}m` : `${autoIn}m`} if no action
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => { feedback("success"); markChaseSent(chase.id); force((n) => n + 1); }}
                        className="bg-ink text-paper rounded-full py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5"
                      >
                        <Check className="h-3.5 w-3.5" /> Send now
                      </a>
                      <button
                        onClick={() => { feedback("tap"); skipChase(chase.id); force((n) => n + 1); }}
                        className="bg-card border border-border text-ink rounded-full py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5"
                      >
                        <XIcon className="h-3.5 w-3.5" /> Skip this chase
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}


          {upcoming.length > 0 && (
            <div className="card-surface divide-y divide-border">
              {upcoming.map(({ chase, quote }) => {
                const c = getClient(quote.client_id);
                const when = new Date(chase.due_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                return (
                  <div key={chase.id} className="px-4 py-2.5 flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground w-12 shrink-0">
                      Day {chase.day_offset}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{quote.ref} · {c?.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">Auto on {when}</p>
                    </div>
                    <span className="num text-sm text-ink">{formatGBP(quote.total)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section className="px-5 mt-5 space-y-3">
        {overdue.map((q) => {
          const c = getClient(q.client_id);
          const firstName = c?.name.split(" ")[0] ?? "there";
          const chase = encodeURIComponent(buildChaserMessage(q, firstName));
          const digits = c?.phone.replace(/\D/g, "");
          const wa = `https://wa.me/${digits ? "44" + digits.replace(/^0/, "") : ""}?text=${chase}`;
          const isOverdue = q.status === "overdue";
          const subjectLabel = isOverdue ? `Overdue invoice ${q.ref}` : `Invoice ${q.ref}`;
          const subject = encodeURIComponent(`${subjectLabel}, ${userProfile.business_name}`);
          const mail = `mailto:${c?.email}?subject=${subject}&body=${chase}`;
          const days = daysOverdue(q.due_date);
          const toneText = isOverdue ? "text-status-overdue" : "text-status-completed";
          const toneBg = isOverdue ? "bg-status-overdue/15 text-status-overdue" : "bg-status-completed/15 text-status-completed";
          const paused = q.auto_chase_enabled === false;
          return (
            <div key={q.id} className="card-surface p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{q.ref}</p>
                    <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${toneBg}`}>
                      {isOverdue ? `${days} day${days === 1 ? "" : "s"} overdue` : "Awaiting payment"}
                    </span>
                    {paused && (
                      <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        Auto-chase paused
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-sm mt-0.5 truncate">{q.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {c?.name} · {isOverdue ? `due ${q.due_date}` : "job complete"}
                  </p>
                </div>
                <p className={`num text-2xl ${toneText}`}>{formatGBP(q.total)}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <a href={wa} target="_blank" rel="noreferrer" className="bg-lime text-ink rounded-full py-2.5 text-xs font-bold inline-flex items-center justify-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
                <a href={`tel:${c?.phone}`} className="bg-ink text-paper rounded-full py-2.5 text-xs font-bold inline-flex items-center justify-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  Call
                </a>
                <a href={mail} className="bg-card border border-border text-ink rounded-full py-2.5 text-xs font-bold inline-flex items-center justify-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </a>
              </div>
              <button
                onClick={() => { feedback("tap"); setQuoteAutoChase(q.id, paused); force((n) => n + 1); }}
                className="mt-2 w-full bg-card border border-border text-muted-foreground rounded-full py-2 text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:text-ink"
              >
                {paused ? <><Play className="h-3.5 w-3.5" /> Resume auto-chase</> : <><Pause className="h-3.5 w-3.5" /> Pause auto-chase for this invoice</>}
              </button>
            </div>
          );
        })}
        {overdue.length === 0 && (
          <EmptyState
            icon={ThumbsUp}
            tone="celebrate"
            title="Nothing to chase"
            body="Nice work."
          />
        )}
      </section>
    </AppShell>
  );
}
