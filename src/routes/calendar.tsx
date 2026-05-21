import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  mockJobs, getQuote, getClient, jobsForDay, jobsForRange,
  setJobStatus, toggleMaterial, setAnnualReminder, estimateTravelMinutes,
  formatTime, formatDayLabel, formatGBP,
  buildReviewRequestMessage, markReviewRequested, waLink, mockProfile,
  type ScheduledJob, type JobStatus,
} from "@/lib/mock-data";
import {
  ChevronLeft, ChevronRight, MessageCircle, Phone, Mail,
  Play, CheckCircle2, Bell, Hammer, Car, MapPin, Package, Check, CalendarOff, Star,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";


export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
  validateSearch: (s: Record<string, unknown>) => ({
    jobId: typeof s.jobId === "string" ? s.jobId : undefined,
  }),
});

type View = "week" | "month" | "day";

function CalendarPage() {
  const { jobId: initialJobId } = Route.useSearch();
  const [view, setView] = useState<View>("week");
  const initialJob = initialJobId ? mockJobs.find((j) => j.id === initialJobId) : null;
  const [anchor, setAnchor] = useState<Date>(() => {
    if (initialJob) { const d = new Date(initialJob.starts_at); d.setHours(0,0,0,0); return d; }
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const [openJobId, setOpenJobId] = useState<string | null>(initialJobId ?? null);
  // Force re-render when mock state changes from inside the sheet.
  const [, bump] = useState(0);
  const refresh = () => bump((n) => n + 1);

  const shift = (delta: number) => {
    const d = new Date(anchor);
    if (view === "month") d.setMonth(d.getMonth() + delta);
    else if (view === "week") d.setDate(d.getDate() + 7 * delta);
    else d.setDate(d.getDate() + delta);
    setAnchor(d);
  };

  const title = useMemo(() => {
    if (view === "month") return anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    if (view === "week") {
      const start = startOfWeek(anchor);
      const end = new Date(start); end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    }
    return anchor.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  }, [view, anchor]);

  const openJob = openJobId ? mockJobs.find((j) => j.id === openJobId) ?? null : null;

  return (
    <AppShell>
      <PageHeader title="Calendar" subtitle="Jobs & schedule" />

      {/* Tomorrow reminder banner */}
      <TomorrowReminder onOpen={(id) => setOpenJobId(id)} />

      {/* View switcher */}
      <section className="px-5 mt-2">
        <div className="card-surface p-1 grid grid-cols-3 gap-1">
          {(["day", "week", "month"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`py-2 text-xs uppercase tracking-widest font-bold rounded-full transition ${view === v ? "bg-ink text-paper" : "text-muted-foreground"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </section>

      {/* Title + nav */}
      <section className="px-5 mt-4 flex items-center justify-between">
        <button onClick={() => shift(-1)} className="h-9 w-9 rounded-full bg-card border border-border flex items-center justify-center">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <p className="text-xl">{title}</p>
          <button
            onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setAnchor(d); }}
            className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground"
          >
            Jump to today
          </button>
        </div>
        <button onClick={() => shift(1)} className="h-9 w-9 rounded-full bg-card border border-border flex items-center justify-center">
          <ChevronRight className="h-4 w-4" />
        </button>
      </section>

      {view === "month" && <MonthView anchor={anchor} onPickDay={(d) => { setAnchor(d); setView("day"); }} />}
      {view === "week"  && <WeekView  anchor={anchor} onOpenJob={(id) => setOpenJobId(id)} onPickDay={(d) => { setAnchor(d); setView("day"); }} />}
      {view === "day"   && <DayView   anchor={anchor} onOpenJob={(id) => setOpenJobId(id)} />}

      {openJob && (
        <JobSheet
          job={openJob}
          onClose={() => setOpenJobId(null)}
          onChange={refresh}
        />
      )}
    </AppShell>
  );
}

// ---------- Tomorrow reminder ----------

function TomorrowReminder({ onOpen }: { onOpen: (id: string) => void }) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0,0,0,0);
  const jobs = jobsForDay(tomorrow);
  if (jobs.length === 0) return null;
  const j = jobs[0];
  const q = getQuote(j.quote_id);
  const c = q ? getClient(q.client_id) : undefined;
  if (!q || !c) return null;
  return (
    <section className="px-5 mt-1">
      <button
        onClick={() => onOpen(j.id)}
        className="w-full text-left rounded-2xl bg-ink text-paper p-4 flex items-center gap-3"
      >
        <div className="h-10 w-10 rounded-full bg-lime text-ink flex items-center justify-center shrink-0">
          <Bell className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-lime font-bold">Tomorrow · {formatTime(j.starts_at)}</p>
          <p className="text-sm font-semibold truncate">{q.title} — {c.name}</p>
          <p className="text-[11px] text-paper/60 truncate">{c.address}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-paper/60 shrink-0" />
      </button>
    </section>
  );
}

// ---------- Month view ----------

function MonthView({ anchor, onPickDay }: { anchor: Date; onPickDay: (d: Date) => void }) {
  const cells = useMemo(() => buildMonthGrid(anchor), [anchor]);
  const today = new Date(); today.setHours(0,0,0,0);
  return (
    <section className="px-5 mt-4">
      <div className="grid grid-cols-7 text-center text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="card-surface p-2 grid grid-cols-7 gap-1">
        {cells.map(({ date, inMonth }, i) => {
          const dayJobs = jobsForDay(date);
          const isToday = sameDay(date, today);
          return (
            <button
              key={i}
              onClick={() => onPickDay(new Date(date))}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-xs transition ${
                isToday ? "bg-lime text-ink font-bold"
                : inMonth ? "hover:bg-secondary text-ink"
                : "text-muted-foreground/50"
              }`}
            >
              <span className={`num ${isToday ? "text-base" : ""}`}>{date.getDate()}</span>
              <div className="flex gap-0.5 h-1.5">
                {dayJobs.slice(0, 3).map((j) => (
                  <span key={j.id} className={`h-1.5 w-1.5 rounded-full ${dotColor(j.status, isToday)}`} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function dotColor(status: JobStatus, onLime: boolean) {
  if (status === "complete") return onLime ? "bg-ink/50" : "bg-status-paid";
  if (status === "in_progress") return onLime ? "bg-ink" : "bg-status-pending";
  return onLime ? "bg-ink" : "bg-lime";
}

// ---------- Week view ----------

function WeekView({
  anchor, onOpenJob, onPickDay,
}: { anchor: Date; onOpenJob: (id: string) => void; onPickDay: (d: Date) => void }) {
  const start = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i); return d;
  });
  const end = new Date(start); end.setDate(start.getDate() + 7);
  const total = jobsForRange(start, end).length;
  return (
    <>
      <section className="px-5 mt-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          {total} job{total === 1 ? "" : "s"} this week
        </p>
      </section>
      <section className="px-5 mt-3 space-y-2.5 pb-4">
        {days.map((day) => {
          const dayJobs = jobsForDay(day);
          const today = new Date(); today.setHours(0,0,0,0);
          const isToday = sameDay(day, today);
          return (
            <div key={day.toISOString()} className={`card-surface overflow-hidden ${isToday ? "ring-2 ring-lime" : ""}`}>
              <button
                onClick={() => onPickDay(day)}
                className="w-full px-5 py-3 flex items-center justify-between bg-secondary/40 text-left"
              >
                <div>
                  <p className={`text-sm font-bold ${isToday ? "text-ink" : ""}`}>{formatDayLabel(day)} {isToday && <span className="text-lime">·  Today</span>}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                    {dayJobs.length === 0 ? "No jobs" : `${dayJobs.length} job${dayJobs.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              {dayJobs.length > 0 && (
                <ul>
                  {dayJobs.map((j) => (
                    <JobRow key={j.id} job={j} onOpen={() => onOpenJob(j.id)} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}

// ---------- Day view ----------

function DayView({ anchor, onOpenJob }: { anchor: Date; onOpenJob: (id: string) => void }) {
  const jobs = jobsForDay(anchor);
  return (
    <section className="px-5 mt-3 pb-4">
      {jobs.length === 0 ? (
        <EmptyState
          icon={CalendarOff}
          title="Nothing in the diary"
          body="Accept a quote and the job lands here automatically."
          cta={{ label: "Browse quotes", to: "/quotes" }}
        />
      ) : (
        <ol className="space-y-3">
          {jobs.map((j, i) => {
            const prev = jobs[i - 1];
            let travel: number | null = null;
            if (prev) {
              const prevQ = getQuote(prev.quote_id);
              const thisQ = getQuote(j.quote_id);
              travel = estimateTravelMinutes(
                getClient(prevQ?.client_id ?? "")?.address,
                getClient(thisQ?.client_id ?? "")?.address,
              );
            }
            return (
              <div key={j.id}>
                {travel != null && (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground ml-3 mb-1">
                    <Car className="h-3 w-3" />
                    ~{travel} min travel
                  </div>
                )}
                <div className="card-surface overflow-hidden">
                  <JobRow job={j} onOpen={() => onOpenJob(j.id)} />
                </div>
              </div>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ---------- Job row ----------

function JobRow({ job, onOpen }: { job: ScheduledJob; onOpen: () => void }) {
  const q = getQuote(job.quote_id);
  const c = q ? getClient(q.client_id) : undefined;
  if (!q || !c) return null;
  return (
    <button onClick={onOpen} className="w-full text-left px-5 py-3 flex items-center gap-3 border-t border-border first:border-t-0">
      <div className="w-14 text-center shrink-0">
        <p className="num text-lg leading-none">{formatTime(job.starts_at)}</p>
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold mt-0.5">
          {Math.floor(job.duration_minutes / 60)}h{job.duration_minutes % 60 ? ` ${job.duration_minutes % 60}m` : ""}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{q.title}</p>
        <p className="text-[11px] text-muted-foreground truncate">{c.name} · {c.address.split(",")[0]}</p>
      </div>
      <JobStatusBadge status={job.status} />
    </button>
  );
}

function JobStatusBadge({ status }: { status: JobStatus }) {
  const map: Record<JobStatus, { label: string; cls: string }> = {
    scheduled:   { label: "Scheduled",   cls: "bg-lime text-ink" },
    in_progress: { label: "In progress", cls: "bg-status-pending text-ink" },
    complete:    { label: "Complete",    cls: "bg-status-paid text-ink" },
  };
  const m = map[status];
  return <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full ${m.cls}`}>{m.label}</span>;
}

// ---------- Job sheet (full details) ----------

function JobSheet({ job, onClose, onChange }: { job: ScheduledJob; onClose: () => void; onChange: () => void }) {
  const q = getQuote(job.quote_id);
  const c = q ? getClient(q.client_id) : undefined;
  const [askAnnual, setAskAnnual] = useState(false);
  if (!q || !c) return null;

  const phoneDigits = c.phone.replace(/\D/g, "");
  const waHref = `https://wa.me/${phoneDigits ? "44" + phoneDigits.replace(/^0/, "") : ""}?text=${encodeURIComponent(`Hi ${c.name.split(" ")[0]}, just confirming our visit ${formatDayLabel(new Date(job.starts_at))} at ${formatTime(job.starts_at)}. — Quottr`)}`;

  const advance = () => {
    if (job.status === "scheduled") { setJobStatus(job.id, "in_progress"); onChange(); }
    else if (job.status === "in_progress") {
      setJobStatus(job.id, "complete");
      setAskAnnual(true);
      onChange();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/60" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-paper rounded-t-3xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-3 pb-2 sticky top-0 bg-paper z-10">
          <div className="h-1 w-10 bg-ink/20 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <JobStatusBadge status={job.status} />
            <button onClick={onClose} className="text-xs text-muted-foreground">Close</button>
          </div>
          <h3 className="text-2xl mt-2 leading-tight">{q.title}</h3>
          <p className="text-xs text-muted-foreground">
            {formatDayLabel(new Date(job.starts_at))} · {formatTime(job.starts_at)} ·
            {" "}{Math.floor(job.duration_minutes / 60)}h{job.duration_minutes % 60 ? ` ${job.duration_minutes % 60}m` : ""}
          </p>
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* Customer */}
          <div className="card-surface p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-lime/30 text-ink flex items-center justify-center font-bold">
                {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm">{c.name}</p>
                <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {c.address}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <a href={waHref} target="_blank" rel="noreferrer" className="bg-lime text-ink rounded-full py-2.5 text-xs font-bold inline-flex items-center justify-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" /> WA
              </a>
              <a href={`tel:${c.phone}`} className="bg-ink text-paper rounded-full py-2.5 text-xs font-bold inline-flex items-center justify-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Call
              </a>
              <a href={`mailto:${c.email}`} className="bg-card border border-border rounded-full py-2.5 text-xs font-bold inline-flex items-center justify-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> Email
              </a>
            </div>
          </div>

          {/* Job description + value */}
          <div className="card-surface p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Job description</p>
            <p className="text-sm mt-1.5 leading-relaxed">{q.job_description}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-secondary p-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Quote value</p>
                <p className="num text-xl">{formatGBP(q.total)}</p>
              </div>
              <div className={`rounded-2xl p-3 ${q.payment_request ? "bg-lime text-ink" : "bg-secondary"}`}>
                <p className="text-[10px] uppercase tracking-widest font-bold opacity-70">Deposit</p>
                <p className="num text-xl">
                  {q.payment_request ? formatGBP(q.payment_request.amount) : "—"}
                </p>
              </div>
            </div>
            <Link
              to="/quotes/$quoteId"
              params={{ quoteId: q.id }}
              className="block mt-3 text-center w-full bg-card border border-border rounded-full py-2.5 text-xs font-bold"
            >
              Open full quote
            </Link>
          </div>

          {/* Materials checklist */}
          <div className="card-surface p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4" />
              <p className="text-sm font-bold">Materials checklist</p>
              <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                {job.materials_checked.length}/{q.line_items.length}
              </span>
            </div>
            <ul className="space-y-1.5">
              {q.line_items.map((li, idx) => {
                const checked = job.materials_checked.includes(idx);
                return (
                  <li key={idx}>
                    <button
                      onClick={() => { toggleMaterial(job.id, idx); onChange(); }}
                      className={`w-full text-left rounded-2xl px-3 py-2.5 flex items-center gap-3 transition ${checked ? "bg-lime/30" : "bg-secondary"}`}
                    >
                      <span className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 ${checked ? "bg-ink border-ink" : "border-ink/30 bg-paper"}`}>
                        {checked && <Check className="h-3 w-3 text-lime" strokeWidth={4} />}
                      </span>
                      <span className={`text-sm flex-1 ${checked ? "line-through opacity-60" : ""}`}>
                        {li.qty} × {li.description}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Status action */}
          {job.status !== "complete" && (
            <button
              onClick={advance}
              className="w-full bg-lime text-ink rounded-full py-4 font-bold inline-flex items-center justify-center gap-2"
            >
              {job.status === "scheduled" ? (
                <><Play className="h-4 w-4" /> I'm on site — start job</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Mark job complete</>
              )}
            </button>
          )}

          {job.status === "complete" && (
            <div className="rounded-2xl bg-status-paid/15 border border-status-paid/40 p-4 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto text-ink" />
              <p className="text-sm font-bold mt-1">Job complete</p>
              {job.annual_reminder_at && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Annual reminder set for {new Date(job.annual_reminder_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Bottom sheet over sheet — annual reminder + payment prompt */}
        {askAnnual && (
          <CompletePrompt
            job={job}
            quoteId={q.id}
            onClose={() => { setAskAnnual(false); onChange(); }}
          />
        )}
      </div>
    </div>
  );
}

function CompletePrompt({
  job, quoteId, onClose,
}: { job: ScheduledJob; quoteId: string; onClose: () => void }) {
  const q = getQuote(quoteId);
  const c = q ? getClient(q.client_id) : undefined;
  const requestReview = () => {
    if (!c) return;
    const first = c.name.split(" ")[0];
    const text = buildReviewRequestMessage(first);
    window.open(waLink(c.phone, text), "_blank");
    markReviewRequested(c.id);
    if (!mockProfile.google_review_url) {
      toast.info("Add your Google review link in Settings for a one-tap link");
    } else {
      toast.success(`Review request sent to ${first}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-ink/70" onClick={onClose}>
      <div className="w-full max-w-md mx-auto bg-paper rounded-t-3xl p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="h-1 w-10 bg-ink/20 rounded-full mx-auto mb-4" />
        <h3 className="text-2xl">Job marked complete</h3>
        <p className="text-xs text-muted-foreground mb-4">Take payment now and set an annual reminder so you stay on the customer's radar.</p>

        <Link
          to="/quotes/$quoteId"
          params={{ quoteId }}
          className="w-full bg-lime text-ink rounded-full py-3.5 font-bold inline-flex items-center justify-center gap-2 text-sm"
        >
          Take payment now
        </Link>

        <div className="mt-3 card-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-4 w-4" />
            <p className="text-sm font-bold">Set annual reminder?</p>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">
            We'll remind you in 11 months to contact the customer about their annual service.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setAnnualReminder(job.id, 11); onClose(); }}
              className="bg-ink text-paper rounded-full py-2.5 text-xs font-bold"
            >
              Yes, remind me
            </button>
            <button onClick={onClose} className="bg-card border border-border rounded-full py-2.5 text-xs font-bold">
              No thanks
            </button>
          </div>
        </div>

        {c && (
          <div className="mt-3 card-surface p-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-lime" />
              <p className="text-sm font-bold">Request a Google review from {c.name.split(" ")[0]}?</p>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">
              Opens WhatsApp with a ready-to-send review request{c.review_requested_at ? ` · last sent ${new Date(c.review_requested_at).toLocaleDateString("en-GB")}` : ""}.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { requestReview(); onClose(); }} className="bg-lime text-ink rounded-full py-2.5 text-xs font-bold">
                Yes — send review request
              </button>
              <button onClick={onClose} className="bg-card border border-border rounded-full py-2.5 text-xs font-bold">
                Not now
              </button>
            </div>
          </div>
        )}


        <button onClick={onClose} className="w-full mt-3 text-xs text-muted-foreground py-2">Done</button>
      </div>
    </div>
  );
}

// ---------- date helpers ----------

function startOfWeek(d: Date) {
  const date = new Date(d); date.setHours(0,0,0,0);
  const day = (date.getDay() + 6) % 7; // Monday=0
  date.setDate(date.getDate() - day);
  return date;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function buildMonthGrid(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === anchor.getMonth() });
  }
  return cells;
}
