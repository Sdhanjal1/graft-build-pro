import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  TRADE_TYPES, mockProfile, mockClients,
  saveGeneratedQuote, formatGBP,
  type LineItem,
} from "@/lib/mock-data";
import { generateAIQuote } from "@/lib/ai-quote.functions";
import { transcribeAudio } from "@/lib/transcribe.functions";
import { Mic, Sparkles, Square, Save, RefreshCw, Loader2 } from "lucide-react";

const MAX_RECORD_SECONDS = 180; // 3 minutes

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
});

type Draft = { title: string; line_items: LineItem[] } | null;

function NewQuotePage() {
  const navigate = useNavigate();
  const [desc, setDesc] = useState("");
  const [trade, setTrade] = useState(mockProfile.trade_type);
  const [vat, setVat] = useState(mockProfile.vat_registered);
  const [clientName, setClientName] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generateFn = useServerFn(generateAIQuote);
  const transcribeFn = useServerFn(transcribeAudio);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    }
  };

  const startRecording = async () => {
    setVoiceError(null);
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

    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      setRecording(false);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      const blobType = mr.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: blobType });
      chunksRef.current = [];

      if (blob.size < 1000) {
        setVoiceError("Recording too short — please try again.");
        return;
      }

      setTranscribing(true);
      try {
        const audioBase64 = await blobToBase64(blob);
        const { text } = await transcribeFn({ data: { audioBase64, mimeType: blobType } });
        const next = desc ? `${desc.trim()} ${text}` : text;
        setDesc(next);
        // Focus + place cursor at end
        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (el) {
            el.focus();
            const end = el.value.length;
            el.setSelectionRange(end, end);
            el.scrollTop = el.scrollHeight;
          }
        });
      } catch (err) {
        console.error(err);
        setVoiceError("Could not transcribe — please try again or type the job description.");
      } finally {
        setTranscribing(false);
      }
    };

    // Start with timeslice so chunks accumulate progressively (helps iOS Safari)
    mr.start(1000);
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
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to generate quote");
    } finally {
      setLoading(false);
    }
  };

  const subtotal = draft ? draft.line_items.reduce((s, li) => s + li.qty * li.unit_price, 0) : 0;
  const vatAmt = vat ? +(subtotal * 0.2).toFixed(2) : 0;
  const total = +(subtotal + vatAmt).toFixed(2);

  const save = () => {
    if (!draft) return;
    const q = saveGeneratedQuote({
      clientName: clientName || "New client",
      description: desc.trim(),
      title: draft.title,
      line_items: draft.line_items,
      vatRegistered: vat,
    });
    navigate({ to: "/quotes/$quoteId", params: { quoteId: q.id } });
  };

  return (
    <AppShell>
      <PageHeader title="New quote" subtitle="AI generator" back="/" />

      <form className="px-5 space-y-4" onSubmit={(e) => { e.preventDefault(); if (draft) save(); else generate(); }}>
        <div className="card-surface p-4">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Describe the job
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="e.g. Replace 28kw combi boiler with new Worcester Greenstar, fit magnetic filter, power flush system…"
            rows={5}
            className="mt-2 w-full bg-transparent outline-none text-sm resize-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={toggleRecord}
            className={`mt-2 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition ${
              recording ? "bg-status-overdue text-white animate-pulse" : "bg-secondary text-ink"
            }`}
          >
            {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {recording ? `Recording… ${recordSeconds}s` : "Voice to text"}
          </button>
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

        <div className="card-surface p-4 bg-ink text-paper">
          <label className="text-xs uppercase tracking-widest text-paper/60 font-semibold">Client</label>
          <input
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            list="client-list"
            placeholder="Client name or pick existing"
            className="mt-2 w-full bg-transparent outline-none text-sm placeholder:text-paper/40"
          />
          <datalist id="client-list">
            {mockClients.map((c) => <option key={c.id} value={c.name}>{c.address}</option>)}
          </datalist>
        </div>

        {!draft && (
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-lime text-ink rounded-full py-4 font-bold inline-flex items-center justify-center gap-2 active:scale-[0.99] transition disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            {loading ? "Generating with Claude…" : "Generate quote"}
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

        {/* Quote preview */}
        {draft && (
          <div className="card-surface overflow-hidden">
            <div className="bg-ink text-paper p-4">
              <p className="text-[10px] uppercase tracking-widest text-lime font-bold">Preview</p>
              <p className="font-bold mt-0.5">{mockProfile.business_name}</p>
              <p className="text-[10px] text-paper/60">{mockProfile.registration_number} · VAT {mockProfile.vat_number}</p>
              <h3 className="text-2xl mt-3 leading-tight">{draft.title}</h3>
            </div>
            <ul>
              {draft.line_items.map((li, i) => (
                <li key={i} className="px-4 py-3 flex items-start gap-3 border-t border-border first:border-t-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{li.description}</p>
                    <p className="text-xs text-muted-foreground">{li.qty} × {formatGBP(li.unit_price)}</p>
                  </div>
                  <p className="num text-base">{formatGBP(li.qty * li.unit_price)}</p>
                </li>
              ))}
            </ul>
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {loading ? "Generating…" : "Regenerate"}
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
