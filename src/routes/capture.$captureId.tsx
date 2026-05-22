import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Mic, Square, Loader2, Plus, Trash2, Sparkles, Type, X, Check } from "lucide-react";
import {
  addCaptureItem,
  createSiteCapture,
  deleteCaptureItem,
  getCapture,
  listCaptureItems,
  QUICK_CHIPS,
  updateCapture,
  updateCaptureItem,
  type SiteCapture,
  type SiteCaptureItem,
} from "@/lib/site-captures";
import { transcribeAudio } from "@/lib/transcribe.functions";
import { extractJobsFromTranscript } from "@/lib/extract-jobs.functions";
import { generateCaptureQuote } from "@/lib/ai-capture-quote.functions";
import { saveGeneratedQuote, TRADE_TYPES, userProfile } from "@/lib/mock-data";
import { feedback } from "@/lib/feedback";
import { IOSStandaloneRecordingNotice } from "@/components/IOSStandaloneRecordingNotice";

export const Route = createFileRoute("/capture/$captureId")({
  component: SiteCapturePage,
});

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  for (const t of candidates) if (MediaRecorder.isTypeSupported(t)) return t;
  return "";
}
async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}
function fmtTimer(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}
function fmtClock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function SiteCapturePage() {
  const { captureId } = Route.useParams();
  const navigate = useNavigate();
  const transcribeFn = useServerFn(transcribeAudio);
  const extractJobsFn = useServerFn(extractJobsFromTranscript);
  const generateFn = useServerFn(generateCaptureQuote);

  const [capture, setCapture] = useState<SiteCapture | null>(null);
  const [items, setItems] = useState<SiteCaptureItem[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [loadingInit, setLoadingInit] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textOpen, setTextOpen] = useState(false);
  const [textValue, setTextValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, list] = await Promise.all([getCapture(captureId), listCaptureItems(captureId)]);
        if (cancelled) return;
        if (!c) {
          setError("Capture not found");
          setLoadingInit(false);
          return;
        }
        setCapture(c);
        setItems(list);
        setLoadingInit(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setLoadingInit(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [captureId]);

  // Timer only ticks while voice recording is active
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  useEffect(
    () => () => {
      if (tickRef.current) clearInterval(tickRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const addItem = async (description: string, source: "manual" | "voice" | "chip") => {
    const desc = description.trim();
    if (!desc) return;
    try {
      const next = items.length;
      const item = await addCaptureItem({ captureId, description: desc, source, position: next });
      setItems((prev) => [...prev, item]);
      feedback("success");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Could not save item");
      feedback("error");
    }
  };

  const removeItem = async (id: string) => {
    const prev = items;
    setItems((p) => p.filter((i) => i.id !== id));
    try {
      await deleteCaptureItem(id);
      feedback("warn");
    } catch (e) {
      console.error(e);
      setItems(prev);
      setError("Could not delete");
    }
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const v = editingValue.trim();
    if (!v) {
      setEditingId(null);
      return;
    }
    const id = editingId;
    setItems((p) => p.map((i) => (i.id === id ? { ...i, description: v } : i)));
    setEditingId(null);
    try {
      await updateCaptureItem(id, v);
    } catch (e) {
      console.error(e);
      setError("Could not save edit");
    }
  };

  const startRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone not supported");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setError("Microphone permission denied");
      return;
    }
    streamRef.current = stream;
    const mimeType = pickMimeType();
    const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    mrRef.current = mr;
    chunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = async () => {
      setRecording(false);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const blobType = mr.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: blobType });
      chunksRef.current = [];
      if (blob.size < 400) {
        setError("Hold the mic a moment longer and speak clearly.");
        return;
      }
      setTranscribing(true);
      try {
        const audioBase64 = await blobToBase64(blob);
        const { text } = await transcribeFn({ data: { audioBase64, mimeType: blobType } });
        let jobs: string[] = [];
        try {
          const res = await extractJobsFn({
            data: { transcript: text, trade: capture?.trade_type || undefined },
          });
          jobs = res.jobs.map((j) => j.trim()).filter(Boolean);
        } catch (err) {
          console.error("extractJobs failed, falling back to raw transcript", err);
        }
        if (jobs.length === 0) jobs = [text];
        for (const j of jobs) {
          await addItem(j, "voice");
        }
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Could not transcribe");
        feedback("error");
      } finally {
        setTranscribing(false);
      }
    };
    mr.start();
    setRecording(true);
    feedback("tap");
  };

  const stopRecording = () => {
    const mr = mrRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
  };

  const toggleRecord = () => {
    if (transcribing) return;
    if (recording) stopRecording();
    else startRecording();
  };

  // ----- review / generate -----
  const updateField = async (patch: Partial<SiteCapture>) => {
    if (!capture) return;
    const next = { ...capture, ...patch };
    setCapture(next);
    try {
      await updateCapture(captureId, patch);
    } catch (e) {
      console.error(e);
    }
  };

  const generate = async () => {
    if (!capture || items.length < 2 || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const draft = await generateFn({
        data: {
          items: items.map((i) => i.description),
          trade: capture.trade_type || userProfile.trade_type,
          vatRegistered: capture.vat_registered,
          customerName: capture.customer_name ?? undefined,
          address: capture.address ?? undefined,
        },
      });
      const q = await saveGeneratedQuote({
        clientName: capture.customer_name || capture.address || "Site capture client",
        description: items.map((i, idx) => `${idx + 1}. ${i.description}`).join("\n"),
        title: draft.title,
        line_items: draft.line_items,
        vatRegistered: capture.vat_registered,
      });
      await updateCapture(captureId, { status: "generated", generated_quote_id: q.id });
      feedback("success");
      navigate({ to: "/quotes/$quoteId", params: { quoteId: q.id } });
    } catch (e) {
      console.error(e);
      feedback("error");
      setError(e instanceof Error ? e.message : "Could not generate quote");
    } finally {
      setGenerating(false);
    }
  };

  if (loadingInit) {
    return (
      <div className="min-h-dvh bg-ink text-paper flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-lime" />
      </div>
    );
  }
  if (!capture) {
    return (
      <div className="min-h-dvh bg-ink text-paper flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-paper/70">{error || "Capture not found"}</p>
        <Link to="/" className="rounded-full bg-lime text-ink px-5 py-2.5 font-semibold text-sm">
          Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-ink text-paper flex flex-col">
      {/* Top bar */}
      <header className="px-4 pt-5 pb-3 safe-top">
        <div className="flex items-center justify-between mb-3">
          <Link
            to="/"
            aria-label="Back"
            className="h-9 w-9 rounded-full bg-paper/10 flex items-center justify-center"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">
              Site capture
            </p>
            <p className="num text-lg text-lime leading-none mt-0.5">{fmtTimer(elapsed)}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (items.length < 2) {
                setError("Capture at least 2 items first.");
                return;
              }
              setReviewOpen(true);
            }}
            disabled={items.length < 2}
            className={`rounded-full px-3.5 py-2 text-[11px] font-bold inline-flex items-center gap-1.5 transition ${
              items.length >= 2 ? "bg-lime text-ink" : "bg-paper/10 text-paper/40"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input
            value={capture.customer_name ?? ""}
            onChange={(e) => setCapture({ ...capture, customer_name: e.target.value })}
            onBlur={(e) => updateField({ customer_name: e.target.value || null })}
            placeholder="Customer (optional)"
            className="bg-paper/10 rounded-full px-3.5 py-2 text-xs outline-none placeholder:text-paper/40"
          />
          <input
            value={capture.address ?? ""}
            onChange={(e) => setCapture({ ...capture, address: e.target.value })}
            onBlur={(e) => updateField({ address: e.target.value || null })}
            placeholder="Address (optional)"
            className="bg-paper/10 rounded-full px-3.5 py-2 text-xs outline-none placeholder:text-paper/40"
          />
        </div>
      </header>

      {/* Quick chips */}
      <div className="px-4 py-2 border-y border-paper/10">
        <div className="overflow-x-auto -mx-1">
          <div className="flex items-center gap-1.5 px-1 pb-0.5">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => addItem(chip, "chip")}
                className="shrink-0 rounded-full bg-paper/10 text-paper text-[11px] font-semibold px-3 py-1.5 active:scale-95 transition"
              >
                + {chip}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Items list */}
      <main className="flex-1 overflow-y-auto px-4 py-3 pb-40">
        {items.length === 0 ? (
          <div className="text-center py-12 text-paper/50 text-sm">
            <p className="font-semibold text-paper/80 mb-1">No items yet</p>
            <p className="text-xs">Tap the mic, type, or pick a chip above.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((it, idx) => (
              <li
                key={it.id}
                className="rounded-2xl bg-paper/5 border border-paper/10 px-3.5 py-3 flex items-start gap-3"
              >
                <span className="num text-sm text-lime font-bold w-6 shrink-0 mt-0.5">
                  {idx + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  {editingId === it.id ? (
                    <input
                      autoFocus
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={saveEdit}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full bg-paper/10 rounded-md px-2 py-1 text-sm outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(it.id);
                        setEditingValue(it.description);
                      }}
                      className="text-left w-full"
                    >
                      <p className="text-sm font-medium text-paper">{it.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-paper/40 num">
                          {fmtClock(it.created_at)}
                        </span>
                        {it.source === "voice" && (
                          <span className="text-[10px] text-lime font-semibold inline-flex items-center gap-0.5">
                            <Mic className="h-2.5 w-2.5" /> voice
                          </span>
                        )}
                        {it.source === "chip" && (
                          <span className="text-[10px] text-paper/50">chip</span>
                        )}
                      </div>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(it.id)}
                  className="text-paper/40 hover:text-status-overdue p-1 -mr-1 shrink-0"
                  aria-label="Delete item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="mt-3 text-center text-[12px] text-status-overdue font-medium">{error}</p>
        )}
      </main>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 inset-x-0 safe-bottom px-4 pb-4 pt-3 bg-gradient-to-t from-ink via-ink to-transparent">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleRecord}
            disabled={transcribing}
            className={`flex-1 h-16 rounded-full flex items-center justify-center gap-2 font-bold text-ink shadow-[0_10px_24px_-6px_rgba(200,224,74,0.6)] active:scale-95 transition disabled:opacity-60 ${
              recording ? "bg-status-overdue text-white" : "bg-lime"
            }`}
          >
            {transcribing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Transcribing…
              </>
            ) : recording ? (
              <>
                <Square className="h-5 w-5" fill="currentColor" />
                Stop
              </>
            ) : (
              <>
                <Mic className="h-6 w-6" />
                Voice
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setTextOpen(true);
              setTextValue("");
            }}
            className="h-16 w-16 rounded-full bg-paper/10 text-paper flex items-center justify-center active:scale-95 transition"
            aria-label="Type item"
          >
            <Type className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-2 flex justify-center">
          <IOSStandaloneRecordingNotice active={recording} />
        </div>
      </div>

      {/* Type-item sheet */}
      {textOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end"
          onClick={() => setTextOpen(false)}
        >
          <div
            className="w-full bg-paper text-ink rounded-t-3xl p-5 safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-base">Add item</p>
              <button onClick={() => setTextOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              autoFocus
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!textValue.trim()) return;
                  await addItem(textValue, "manual");
                  setTextValue("");
                  setTextOpen(false);
                }
              }}
              placeholder="e.g. Replace kitchen stopcock"
              className="w-full bg-secondary rounded-2xl px-4 py-3 text-sm outline-none"
            />
            <button
              type="button"
              onClick={async () => {
                if (!textValue.trim()) return;
                await addItem(textValue, "manual");
                setTextValue("");
                setTextOpen(false);
              }}
              disabled={!textValue.trim()}
              className="mt-3 w-full bg-lime text-ink rounded-full py-3.5 font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add to capture
            </button>
          </div>
        </div>
      )}

      {/* Review / generate sheet */}
      {reviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end">
          <div className="w-full max-h-[92dvh] bg-paper text-ink rounded-t-3xl flex flex-col safe-bottom">
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
              <p className="font-bold text-base">Review & generate</p>
              <button onClick={() => setReviewOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4 flex-1">
              <div className="card-surface p-4 space-y-3">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    Customer
                  </label>
                  <input
                    value={capture.customer_name ?? ""}
                    onChange={(e) => setCapture({ ...capture, customer_name: e.target.value })}
                    onBlur={(e) => updateField({ customer_name: e.target.value || null })}
                    placeholder="Customer name"
                    className="mt-1 w-full bg-transparent outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    Address
                  </label>
                  <input
                    value={capture.address ?? ""}
                    onChange={(e) => setCapture({ ...capture, address: e.target.value })}
                    onBlur={(e) => updateField({ address: e.target.value || null })}
                    placeholder="Address"
                    className="mt-1 w-full bg-transparent outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    Trade type
                  </label>
                  <select
                    value={capture.trade_type ?? userProfile.trade_type}
                    onChange={(e) => updateField({ trade_type: e.target.value })}
                    className="mt-1 w-full bg-transparent outline-none text-sm font-medium"
                  >
                    {TRADE_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="font-semibold text-sm">VAT registered</p>
                    <p className="text-xs text-muted-foreground">Add 20% VAT</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={capture.vat_registered}
                    onChange={(e) => updateField({ vat_registered: e.target.checked })}
                    className="h-6 w-11 appearance-none rounded-full bg-secondary checked:bg-lime relative cursor-pointer transition
                      before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition
                      checked:before:translate-x-5"
                  />
                </label>
              </div>

              <div className="card-surface overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-secondary/40">
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                    {items.length} items captured
                  </p>
                </div>
                <ul>
                  {items.map((it, i) => (
                    <li
                      key={it.id}
                      className="px-4 py-3 border-t border-border first:border-t-0 flex items-start gap-2"
                    >
                      <span className="num text-xs text-muted-foreground w-5 shrink-0 mt-1.5">
                        {i + 1}.
                      </span>
                      <input
                        value={it.description}
                        onChange={(e) =>
                          setItems((p) =>
                            p.map((x) => (x.id === it.id ? { ...x, description: e.target.value } : x)),
                          )
                        }
                        onBlur={(e) => updateCaptureItem(it.id, e.target.value).catch(console.error)}
                        className="flex-1 bg-transparent outline-none text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        className="text-muted-foreground hover:text-status-overdue p-1 -mr-1"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {error && (
                <p className="text-center text-[12px] text-status-overdue font-medium">{error}</p>
              )}
            </div>
            <div className="p-5 border-t border-border">
              <button
                type="button"
                onClick={generate}
                disabled={generating || items.length < 2}
                className="w-full bg-lime text-ink rounded-full py-4 font-bold inline-flex items-center justify-center gap-2 active:scale-[0.99] transition disabled:opacity-60"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Generating with Claude…
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" /> Generate quote
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
