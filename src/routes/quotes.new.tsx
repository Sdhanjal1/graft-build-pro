import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  TRADE_TYPES,
  userProfile,
  userClients,
  saveGeneratedQuote,
  formatGBP,
  QUOTE_TEMPLATES,
  type LineItem,
} from "@/lib/user-data";
import { generateAIQuote } from "@/lib/ai-quote.functions";
import { useSubscription } from "@/hooks/useSubscription";
import { transcribeAudio } from "@/lib/transcribe.functions";
import { Mic, Sparkles, Square, Save, RefreshCw, Loader2, Plus, Trash2, MapPin } from "lucide-react";
import { RotatingStatus, QUOTE_GEN_MESSAGES } from "@/components/RotatingStatus";
import { feedback } from "@/lib/feedback";
import { RotatingPrompts } from "@/components/RotatingPrompts";
import { IOSStandaloneRecordingNotice } from "@/components/IOSStandaloneRecordingNotice";

const MAX_RECORD_SECONDS = 180; // 3 minutes

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{ isFinal: boolean; 0?: { transcript?: string } }>;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function formatMMSS(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

export const Route = createFileRoute("/quotes/new")({
  component: NewQuotePage,
  validateSearch: (s: Record<string, unknown>) => ({
    voice: s.voice === 1 || s.voice === "1" ? 1 : undefined,
  }),
});

type Draft = { title: string; line_items: LineItem[] } | null;

type Clip = { id: string; transcript: string };

function NewQuotePage() {
  const navigate = useNavigate();
  const { voice: voiceParam } = Route.useSearch();
  const [mode, setMode] = useState<"speak" | "onsite">("speak");
  const [desc, setDesc] = useState("");
  const [clips, setClips] = useState<Clip[]>([]);
  const [trade, setTrade] = useState(userProfile.trade_type);
  const [vat, setVat] = useState(userProfile.vat_registered);
  const [clientName, setClientName] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const clientMatches = (() => {
    const q = clientName.trim().toLowerCase();
    const list = q
      ? userClients.filter((c) =>
          `${c.name} ${c.address}`.toLowerCase().includes(q) && c.name.toLowerCase() !== q,
        )
      : userClients;
    return list.slice(0, 6);
  })();
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [draft, setDraft] = useState<Draft>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generateFn = useServerFn(generateAIQuote);
  const transcribeFn = useServerFn(transcribeAudio);
  const { canUse: subActive, blocked: subBlocked } = useSubscription();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const liveTranscriptRef = useRef("");
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recordTargetRef = useRef<"desc" | "clip">("desc");

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      speechRecognitionRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Auto-start voice recording when arriving with ?voice=1
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (voiceParam === 1 && !autoStartedRef.current && !recording && !transcribing && !draft) {
      autoStartedRef.current = true;
      startRecording();
      // Clear the search param so it doesn't re-trigger on remount
      navigate({ to: "/quotes/new", search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceParam]);

  const stopRecording = () => {
    const recognition = speechRecognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch (err) {
        console.warn(err);
      }
      speechRecognitionRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    }
  };

  const appendTranscript = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setDesc((prev) => (prev ? `${prev.trim()} ${clean}` : clean));
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const end = el.value.length;
        el.setSelectionRange(end, end);
        el.scrollTop = el.scrollHeight;
      }
    });
  };

  const startRecording = async () => {
    setVoiceError(null);
    liveTranscriptRef.current = "";
    setLiveTranscript("");
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Microphone not supported on this device.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      console.error(err);
      setVoiceError("Microphone permission denied. Enable it in your browser settings.");
      return;
    }
    streamRef.current = stream;

    const mimeType = pickMimeType();
    let mr: MediaRecorder;
    try {
      mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch (err) {
      console.error(err);
      stream.getTracks().forEach((t) => t.stop());
      setVoiceError("Could not start recorder on this browser.");
      return;
    }
    mediaRecorderRef.current = mr;
    chunksRef.current = [];

    const SpeechRecognition = getSpeechRecognition();
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-GB";
        recognition.onresult = (event) => {
          const text = Array.from(event.results)
            .map((result) => result[0]?.transcript || "")
            .join(" ")
            .trim();
          liveTranscriptRef.current = text;
          setLiveTranscript(text);
        };
        recognition.onerror = (event) => console.warn("Speech recognition error", event.error);
        recognition.start();
        speechRecognitionRef.current = recognition;
      } catch (err) {
        console.warn(err);
        speechRecognitionRef.current = null;
      }
    }

    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      setRecording(false);
      const liveTranscript = liveTranscriptRef.current.trim();
      speechRecognitionRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      const blobType = mr.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: blobType });
      console.log("[voice] stop", {
        chunks: chunksRef.current.length,
        size: blob.size,
        type: blobType,
      });
      chunksRef.current = [];

      if (blob.size < 200) {
        if (liveTranscript) appendTranscript(liveTranscript);
        else
          setVoiceError(
            "Didn't catch any audio, hold the button a moment longer and speak clearly.",
          );
        liveTranscriptRef.current = "";
        return;
      }

      if (liveTranscript) {
        appendTranscript(liveTranscript);
        liveTranscriptRef.current = "";
        return;
      }

      setTranscribing(true);
      try {
        const audioBase64 = await blobToBase64(blob);
        const { text } = await transcribeFn({ data: { audioBase64, mimeType: blobType } });
        appendTranscript(text);
      } catch (err) {
        console.error(err);
        setVoiceError(
          err instanceof Error
            ? err.message
            : "Could not transcribe, please try again or type the job description.",
        );
      } finally {
        setTranscribing(false);
      }
    };

    // No timeslice, one final ondataavailable fires on stop with the full recording.
    mr.start();
    setRecording(true);
    setRecordSeconds(0);
    tickRef.current = setInterval(() => {
      setRecordSeconds((s) => {
        const next = s + 1;
        if (next >= MAX_RECORD_SECONDS) {
          stopRecording();
          return MAX_RECORD_SECONDS;
        }
        return next;
      });
    }, 1000);
  };

  const toggleRecord = () => {
    if (transcribing) return;
    feedback("tap");
    if (recording) stopRecording();
    else startRecording();
  };

  const generate = async () => {
    const text = desc.trim();
    if (!text) {
      setError("Please describe the job before generating a quote.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const g = await generateFn({ data: { description: text, trade, vatRegistered: vat } });
      setDraft(g);
      feedback("success");
    } catch (e) {
      console.error(e);
      feedback("error");
      setError(e instanceof Error ? e.message : "Failed to generate quote");
    } finally {
      setLoading(false);
    }
  };

  const subtotal = draft ? draft.line_items.reduce((s, li) => s + li.qty * li.unit_price, 0) : 0;
  const vatAmt = vat ? +(subtotal * 0.2).toFixed(2) : 0;
  const total = +(subtotal + vatAmt).toFixed(2);

  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setError(null);
    try {
      const q = await saveGeneratedQuote({
        clientName: clientName.trim(),
        description: desc.trim(),
        title: draft.title,
        line_items: draft.line_items,
        vatRegistered: vat,
      });
      feedback("success");
      navigate({ to: "/quotes/$quoteId", params: { quoteId: q.id } });
    } catch (e) {
      feedback("error");
      setError(e instanceof Error ? e.message : "Could not save quote");
      setSaving(false);
    }
  };

  return (
    <AppShell>
      {(recording || transcribing) && (
        <VoiceOverlay
          recording={recording}
          transcribing={transcribing}
          seconds={recordSeconds}
          liveTranscript={liveTranscript}
          onStop={stopRecording}
        />
      )}
      <PageHeader title="New quote" subtitle="AI generator" back="/" />


      <form
        className="px-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft) save();
          else generate();
        }}
      >
        <div className="card-surface p-4">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Describe the job
          </label>
          <textarea
            ref={textareaRef}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="e.g. Replace 28kw combi boiler with new Worcester Greenstar, fit magnetic filter, power flush system…"
            rows={5}
            className="mt-2 w-full bg-transparent outline-none text-sm resize-none placeholder:text-muted-foreground"
          />
          {(QUOTE_TEMPLATES[trade]?.length ?? 0) > 0 && (
            <div className="mt-2 -mx-4 px-4 overflow-x-auto">
              <div className="flex items-center gap-1.5 pb-1">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold shrink-0 mr-1">
                  Templates
                </span>
                {QUOTE_TEMPLATES[trade].map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => { setDesc(t.prompt); setDraft(null); textareaRef.current?.focus(); }}
                    className="shrink-0 rounded-full bg-secondary text-ink text-[11px] font-semibold px-3 py-1.5 hover:bg-ink hover:text-paper transition"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={toggleRecord}
              disabled={transcribing}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition disabled:opacity-60 ${
                recording ? "bg-status-overdue text-white" : "bg-secondary text-ink"
              }`}
            >
              {transcribing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Transcribing your voice note…
                </>
              ) : recording ? (
                <>
                  <span className="relative inline-flex h-2.5 w-2.5">
                    <span className="absolute inset-0 rounded-full bg-white opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                  </span>
                  <Square className="h-4 w-4" />
                  Stop · {formatMMSS(recordSeconds)}
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Voice to text
                </>
              )}
            </button>
            {recording && (
              <span className="text-[11px] text-muted-foreground">
                Max {formatMMSS(MAX_RECORD_SECONDS)} · tap stop when done
              </span>
            )}
          </div>
          <IOSStandaloneRecordingNotice active={recording} />
          {voiceError && (
            <p className="mt-2 text-[12px] text-status-overdue font-medium">{voiceError}</p>
          )}
          {!recording && !transcribing && !desc && (
            <RotatingPrompts className="mt-2.5" />
          )}
        </div>

        <div className="card-surface p-4">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Trade type
          </label>
          <select
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            className="mt-2 w-full bg-transparent outline-none text-sm font-medium"
          >
            {TRADE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <label className="card-surface p-4 flex items-center justify-between cursor-pointer">
          <div>
            <p className="font-semibold text-sm">VAT registered</p>
            <p className="text-xs text-muted-foreground">Add 20% VAT to quote total</p>
          </div>
          <input
            type="checkbox"
            checked={vat}
            onChange={(e) => setVat(e.target.checked)}
            className="h-6 w-11 appearance-none rounded-full bg-secondary checked:bg-lime relative cursor-pointer transition
              before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition
              checked:before:translate-x-5"
          />
        </label>

        <div className="card-surface p-4 bg-ink text-paper relative">
          <label className="text-xs uppercase tracking-widest text-paper/60 font-semibold">
            Client
          </label>
          <input
            value={clientName}
            onChange={(e) => { setClientName(e.target.value); setClientOpen(true); }}
            onFocus={() => setClientOpen(true)}
            onBlur={() => setTimeout(() => setClientOpen(false), 150)}
            placeholder="Type to search or add new"
            className="mt-2 w-full bg-transparent outline-none text-sm placeholder:text-paper/40"
          />
          {clientOpen && clientMatches.length > 0 && (
            <ul className="absolute left-3 right-3 top-full mt-1 z-20 bg-paper text-ink rounded-2xl shadow-elegant border border-border max-h-64 overflow-auto">
              {clientMatches.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setClientName(c.name); setClientOpen(false); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-secondary flex flex-col gap-0.5"
                  >
                    <span className="text-sm font-semibold">{c.name}</span>
                    {c.address && <span className="text-[11px] text-muted-foreground truncate">{c.address}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!draft && (
          <button
            type="submit"
            disabled={loading || subBlocked}
            title={subBlocked ? "Your trial has ended, add a payment method to continue" : undefined}
            className="w-full bg-lime text-ink rounded-full py-4 font-bold inline-flex items-center justify-center gap-2 active:scale-[0.99] transition disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
            {subBlocked
              ? "Trial ended, add payment method"
              : loading ? <RotatingStatus messages={QUOTE_GEN_MESSAGES} /> : "Generate quote"}
          </button>
        )}

        {error && (
          <p className="text-[12px] text-center text-status-overdue font-medium">{error}</p>
        )}

        {!draft && !error && (
          <p className="text-[11px] text-center text-muted-foreground">
            Powered by Claude AI · realistic 2026 UK trade pricing.
          </p>
        )}

        {/* Editable quote preview */}
        {draft && (
          <div className="card-surface overflow-hidden">
            <div className="bg-ink text-paper p-4">
              <p className="text-[10px] uppercase tracking-widest text-lime font-bold">Preview · editable</p>
              <p className="font-bold mt-0.5">{userProfile.business_name}</p>
              <p className="text-[10px] text-paper/60">
                {userProfile.registration_number} · VAT {userProfile.vat_number}
              </p>
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="mt-3 w-full bg-transparent outline-none text-2xl leading-tight font-medium placeholder:text-paper/40"
                placeholder="Quote title"
              />
            </div>
            <ul>
              {draft.line_items.map((li, i) => (
                <li
                  key={i}
                  className="px-4 py-3 border-t border-border first:border-t-0 space-y-2"
                >
                  {li.source && (
                    <span
                      className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        li.source === "voice"
                          ? "bg-lime/30 text-ink"
                          : li.source === "learned"
                          ? "bg-lime/15 text-ink"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {li.source === "voice"
                        ? "Your price"
                        : li.source === "learned"
                        ? "Your usual price"
                        : "Quottr suggested"}
                    </span>
                  )}
                  <div className="flex items-start gap-2">
                    <textarea
                      value={li.description}
                      onChange={(e) => {
                        const next = [...draft.line_items];
                        next[i] = { ...li, description: e.target.value };
                        setDraft({ ...draft, line_items: next });
                      }}
                      rows={1}
                      className="flex-1 bg-transparent outline-none text-sm font-medium resize-none placeholder:text-muted-foreground"
                      placeholder="Item description"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = draft.line_items.filter((_, idx) => idx !== i);
                        setDraft({ ...draft, line_items: next.length ? next : [{ description: "", qty: 1, unit_price: 0 }] });
                      }}
                      className="text-muted-foreground hover:text-status-overdue p-1 -mr-1 shrink-0"
                      aria-label="Remove line item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      Qty
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.1"
                        value={li.qty}
                        onChange={(e) => {
                          const next = [...draft.line_items];
                          next[i] = { ...li, qty: parseFloat(e.target.value) || 0 };
                          setDraft({ ...draft, line_items: next });
                        }}
                        className="w-16 bg-secondary rounded px-2 py-1 text-sm text-ink num outline-none"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      £
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        value={li.unit_price}
                        onChange={(e) => {
                          const next = [...draft.line_items];
                          next[i] = { ...li, unit_price: parseFloat(e.target.value) || 0 };
                          setDraft({ ...draft, line_items: next });
                        }}
                        className="w-24 bg-secondary rounded px-2 py-1 text-sm text-ink num outline-none"
                      />
                    </label>
                    <p className="num text-sm ml-auto font-semibold">{formatGBP(li.qty * li.unit_price)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() =>
                setDraft({
                  ...draft,
                  line_items: [...draft.line_items, { description: "", qty: 1, unit_price: 0 }],
                })
              }
              className="w-full px-4 py-3 border-t border-border text-xs font-semibold text-muted-foreground hover:text-ink inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add line item
            </button>
            <div className="px-4 py-3 border-t border-border bg-secondary/40 space-y-1.5">
              <Row label="Subtotal" value={formatGBP(subtotal)} />
              {vat && <Row label="VAT (20%)" value={formatGBP(vatAmt)} />}
              <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-border">
                <span className="text-sm uppercase tracking-widest font-semibold">Total</span>
                <span className="num text-3xl text-ink">{formatGBP(total)}</span>
              </div>
            </div>
          </div>
        )}

        {draft && (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="bg-card border border-border text-ink rounded-full py-3.5 font-bold inline-flex items-center justify-center gap-2 text-sm disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {loading ? <RotatingStatus messages={QUOTE_GEN_MESSAGES} /> : "Regenerate"}
            </button>
            <button
              type="button"
              onClick={save}
              className="bg-lime text-ink rounded-full py-3.5 font-bold inline-flex items-center justify-center gap-2 text-sm"
            >
              <Save className="h-4 w-4" /> Save quote
            </button>
          </div>
        )}
      </form>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}

function VoiceOverlay({
  recording,
  transcribing,
  seconds,
  liveTranscript,
  onStop,
}: {
  recording: boolean;
  transcribing: boolean;
  seconds: number;
  liveTranscript: string;
  onStop: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-ink text-paper flex flex-col items-center justify-between px-6 pt-16 pb-10 safe-top safe-bottom">
      <div className="flex flex-col items-center">
        <p className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">
          {transcribing ? "Transcribing" : "Listening"}
        </p>
        <p className="num text-2xl mt-1 text-lime">{formatMMSS(seconds)}</p>
      </div>

      <div className="relative flex items-center justify-center my-8">
        {recording && (
          <>
            <span className="absolute h-64 w-64 rounded-full bg-lime/10 animate-ping" />
            <span className="absolute h-52 w-52 rounded-full bg-lime/20 animate-pulse" />
          </>
        )}
        <div
          className={`relative h-40 w-40 rounded-full bg-lime flex items-center justify-center shadow-[0_20px_60px_-12px_rgba(200,224,74,0.7)] ${
            recording ? "animate-[pulse_1.4s_ease-in-out_infinite]" : ""
          }`}
        >
          {transcribing ? (
            <Loader2 className="h-16 w-16 text-ink animate-spin" />
          ) : (
            <Mic className="h-16 w-16 text-ink" strokeWidth={2.25} />
          )}
        </div>
      </div>

      <div className="w-full max-w-md min-h-[6rem] text-center">
        {liveTranscript ? (
          <p className="text-base leading-relaxed text-paper/90">{liveTranscript}</p>
        ) : (
          <p className="text-sm text-paper/50">
            {transcribing ? "Turning your voice into text…" : "Describe the job, boiler, bathroom, materials, time…"}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onStop}
        disabled={transcribing}
        className="mt-6 inline-flex items-center justify-center gap-2 bg-paper text-ink rounded-full px-8 py-4 text-sm font-bold active:scale-[0.99] transition disabled:opacity-60"
      >
        <Square className="h-4 w-4 fill-ink" />
        {transcribing ? "Please wait…" : "Stop recording"}
      </button>
    </div>
  );
}
