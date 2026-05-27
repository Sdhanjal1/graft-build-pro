import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  userProfile,
  userClients,
  getClient,
  saveGeneratedQuote,
  updateClientPhone,
  formatGBP,
  QUOTE_TEMPLATES,
  type LineItem,
} from "@/lib/user-data";


import { generateAIQuote } from "@/lib/ai-quote.functions";
import { useSubscription } from "@/hooks/useSubscription";
import { transcribeAudio } from "@/lib/transcribe.functions";
import { Mic, Sparkles, Square, Save, RefreshCw, Loader2, Plus, Trash2, MapPin, X, Search } from "lucide-react";
import { RotatingStatus, QUOTE_GEN_MESSAGES } from "@/components/RotatingStatus";
import { feedback } from "@/lib/feedback";
import { RotatingPrompts } from "@/components/RotatingPrompts";
import { IOSStandaloneRecordingNotice } from "@/components/IOSStandaloneRecordingNotice";
import { usePaidQuoteCount, normalizeSource } from "@/hooks/usePaidQuoteCount";

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
  validateSearch: (s: Record<string, unknown>) => ({
    ...(s.voice === 1 || s.voice === "1" ? { voice: 1 } : {}),
    ...(typeof s.clientId === "string" ? { clientId: s.clientId } : {}),
  }),
});

type Draft = { title: string; line_items: LineItem[] } | null;

type Clip = { id: string; transcript: string };

function NewQuotePage() {
  const navigate = useNavigate();
  const { voice: voiceParam, clientId } = Route.useSearch();
  const [mode, setMode] = useState<"speak" | "onsite">("speak");
  const [desc, setDesc] = useState("");
  const [clips, setClips] = useState<Clip[]>([]);
  const [trade, setTrade] = useState(userProfile.trade_type);
  const [vat, setVat] = useState(userProfile.vat_registered);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [customerMode, setCustomerMode] = useState<"none" | "existing" | "new">("none");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const filteredClients = (() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return userClients;
    return userClients.filter((c) => `${c.name} ${c.address}`.toLowerCase().includes(q));
  })();
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [livePreview, setLivePreview] = useState<string>("");
  const [liveSupported, setLiveSupported] = useState<boolean>(true);
  
  const [draft, setDraft] = useState<Draft>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generateFn = useServerFn(generateAIQuote);
  const transcribeFn = useServerFn(transcribeAudio);
  const { canUse: subActive, blocked: subBlocked } = useSubscription();
  const paidQuoteCount = usePaidQuoteCount();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recordTargetRef = useRef<"desc" | "clip">("desc");
  const lastBlobRef = useRef<{ blob: Blob; mimeType: string } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const liveFinalRef = useRef<string>("");


  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // When arriving with ?voice=1, show the voice overlay in idle state.
  // iOS Safari requires getUserMedia to be invoked from a real user gesture,
  // so the user taps the lime mic in the overlay to start.
  const [voicePending, setVoicePending] = useState(false);
  useEffect(() => {
    if (voiceParam === 1 && !recording && !transcribing && !draft) {
      setVoicePending(true);
      navigate({ to: "/quotes/new", search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceParam]);

  // Pre-populate customer when arriving from "Quote again" on customer detail
  useEffect(() => {
    if (!clientId) return;
    const client = getClient(clientId);
    if (client) {
      setClientName(client.name);
      setClientPhone(client.phone);
      setCustomerMode("existing");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleVoiceStart = async () => {
    setVoicePending(false);
    setVoiceError(null);
    setLastTranscript(null);
    setLivePreview("");
    liveFinalRef.current = "";
    await startRecording();
  };
  const handleVoiceClose = () => {
    setVoicePending(false);
    setVoiceError(null);
    setLastTranscript(null);
    setLivePreview("");
    liveFinalRef.current = "";
    stopRecording();
  };

  const recordStartRef = useRef<number>(0);
  const MIN_RECORD_MS = 1000;

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === "inactive") return;
    const elapsed = Date.now() - recordStartRef.current;
    const remaining = MIN_RECORD_MS - elapsed;
    if (remaining > 0) {
      setTimeout(() => {
        const cur = mediaRecorderRef.current;
        if (cur && cur.state !== "inactive") cur.stop();
      }, remaining);
      return;
    }
    mr.stop();
  };

  const appendTranscript = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setLastTranscript(clean);
    if (recordTargetRef.current === "clip") {
      setClips((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, transcript: clean }]);
      return;
    }
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

  const runTranscribe = async (blob: Blob, mimeType: string) => {
    setTranscribing(true);
    setVoiceError(null);
    try {
      const audioBase64 = await blobToBase64(blob);
      const { text } = await transcribeFn({ data: { audioBase64, mimeType } });
      appendTranscript(text);
      lastBlobRef.current = null;
    } catch (err) {
      console.error(err);
      setVoiceError(
        err instanceof Error
          ? err.message
          : "Could not transcribe. Check your connection and retry.",
      );
    } finally {
      setTranscribing(false);
      setLivePreview("");
      liveFinalRef.current = "";
    }
  };

  const retryTranscription = () => {
    const cached = lastBlobRef.current;
    if (!cached) return;
    void runTranscribe(cached.blob, cached.mimeType);
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
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      // Tear down live preview recognizer (display only — never used as result).
      try {
        recognitionRef.current?.stop?.();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
      setRecording(false);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      const blobType = mr.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: blobType });
      chunksRef.current = [];

      if (blob.size < 1000) {
        setVoiceError(
          "Recording was too short. Hold the button and speak for at least 2 seconds.",
        );
        return;
      }

      lastBlobRef.current = { blob, mimeType: blobType };
      await runTranscribe(blob, blobType);

    };

    // Live preview via Web Speech API — visual feedback only, discarded on stop.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any =
      typeof window !== "undefined"
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;
    if (SR) {
      setLiveSupported(true);
      try {
        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-GB";
        liveFinalRef.current = "";
        setLivePreview("");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onresult = (event: any) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            const txt = res[0]?.transcript ?? "";
            if (res.isFinal) {
              liveFinalRef.current = `${liveFinalRef.current} ${txt}`.trim();
            } else {
              interim += txt;
            }
          }
          setLivePreview(`${liveFinalRef.current} ${interim}`.trim());
        };
        rec.onerror = () => {
          // Silent: this is preview only.
        };
        recognitionRef.current = rec;
        rec.start();
      } catch {
        recognitionRef.current = null;
      }
    } else {
      setLiveSupported(false);
    }

    // Timeslice of 1s ensures a chunk is flushed every second even on iOS Safari.
    recordStartRef.current = Date.now();
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

  const startRecordingForClip = () => {
    if (transcribing || recording) return;
    feedback("tap");
    recordTargetRef.current = "clip";
    startRecording();
  };

  const toggleRecord = () => {
    if (transcribing) return;
    feedback("tap");
    if (recording) stopRecording();
    else {
      recordTargetRef.current = "desc";
      startRecording();
    }
  };

  const combinedClipsText = () =>
    clips
      .map((c, i) => `Task ${i + 1}: ${c.transcript.trim()}`)
      .filter((s) => s.trim().length > 0)
      .join("\n");

  const generate = async () => {
    const text = mode === "onsite" ? combinedClipsText() : desc.trim();
    if (!text) {
      setError(
        mode === "onsite"
          ? "Record at least one clip before generating a quote."
          : "Please describe the job before generating a quote.",
      );
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const g = await generateFn({ data: { description: text, trade, vatRegistered: vat } });
      setDraft(g);
      if (mode === "onsite") setDesc(text);
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
        clientPhone: clientPhone.trim() || undefined,
        description: desc.trim(),
        title: draft.title,
        line_items: draft.line_items,
        vatRegistered: vat,
      });
      // If an existing customer was picked, persist any phone edits to that record.
      if (customerMode === "existing" && q.client_id) {
        try {
          await updateClientPhone(q.client_id, clientPhone);
        } catch (err) {
          console.error("[quotes.new] updateClientPhone failed", err);
        }
      }
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
      {(recording || transcribing || voicePending || voiceError) && (
        <VoiceOverlay
          recording={recording}
          transcribing={transcribing}
          seconds={recordSeconds}
          error={voiceError}
          lastTranscript={lastTranscript}
          livePreview={livePreview}
          liveSupported={liveSupported}
          onStart={handleVoiceStart}
          onStop={stopRecording}
          onClose={handleVoiceClose}
          onRetryTranscription={lastBlobRef.current ? retryTranscription : undefined}
        />
      )}

      <PageHeader title="New quote" subtitle="" back="/quotes" />

        <form
        id="new-quote-form"
        className="px-5 mt-4 space-y-4 pb-64"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft) save();
          else generate();
        }}
      >
        <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setMode("speak")}
            className={`rounded-full py-2.5 inline-flex items-center justify-center gap-1.5 border transition ${
              mode === "speak"
                ? "bg-ink text-paper border-ink"
                : "bg-transparent text-ink border-ink/25"
            }`}
          >
            <Mic className="h-3.5 w-3.5" /> Speak it
          </button>
          <button
            type="button"
            onClick={() => setMode("onsite")}
            className={`rounded-full py-2.5 inline-flex items-center justify-center gap-1.5 border transition ${
              mode === "onsite"
                ? "bg-ink text-paper border-ink"
                : "bg-transparent text-ink border-ink/25"
            }`}
          >
            <MapPin className="h-3.5 w-3.5" /> On site
          </button>
        </div>

        {mode === "speak" && (
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
        )}

        {mode === "onsite" && (
        <div className="card-surface p-4 space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Walk the job
            </label>
            <p className="text-xs text-muted-foreground mt-1">
              Tap + and record a short clip for each task or room. We'll combine them into one quote.
            </p>
          </div>

          {clips.length > 0 && (
            <ul className="space-y-2">
              {clips.map((c, i) => (
                <li key={c.id} className="rounded-2xl bg-secondary px-3 py-2.5 flex items-start gap-2">
                  <span className="num text-[11px] font-bold text-muted-foreground mt-0.5 shrink-0 w-5">
                    {i + 1}.
                  </span>
                  <p className="flex-1 text-sm leading-snug">{c.transcript}</p>
                  <button
                    type="button"
                    onClick={() => setClips((prev) => prev.filter((x) => x.id !== c.id))}
                    className="text-muted-foreground hover:text-status-overdue p-1 -mr-1 shrink-0"
                    aria-label="Remove clip"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={startRecordingForClip}
            disabled={recording || transcribing}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-ink text-paper py-3 text-sm font-bold active:scale-[0.98] transition disabled:opacity-60"
          >
            {transcribing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Transcribing…
              </>
            ) : (
              <>
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-lime text-ink">
                  <Plus className="h-4 w-4" strokeWidth={3} />
                </span>
                {clips.length === 0 ? "Add first clip" : "Add another clip"}
              </>
            )}
          </button>

          <IOSStandaloneRecordingNotice active={recording} />
          {voiceError && (
            <p className="text-[12px] text-status-overdue font-medium">{voiceError}</p>
          )}
        </div>
        )}




        {userClients.length === 0 ? (
          <button
            type="button"
            onClick={() => { setCustomerMode("new"); setClientName(""); setClientPhone(""); }}
            className={`w-full rounded-2xl py-4 px-3 text-sm font-bold text-center transition bg-transparent border inline-flex items-center justify-center gap-1.5 ${
              customerMode === "new" ? "border-ink" : "border-ink/25 text-ink"
            }`}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> New customer
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { setCustomerMode("existing"); setPickerOpen(true); }}
              className={`rounded-2xl py-4 px-3 text-sm font-bold text-center transition bg-transparent border ${
                customerMode === "existing" ? "border-ink" : "border-ink/25 text-ink"
              }`}
            >
              Existing customer
            </button>
            <button
              type="button"
              onClick={() => { setCustomerMode("new"); setClientName(""); setClientPhone(""); }}
              className={`rounded-2xl py-4 px-3 text-sm font-bold text-center transition bg-transparent border inline-flex items-center justify-center gap-1.5 ${
                customerMode === "new" ? "border-ink" : "border-ink/25 text-ink"
              }`}
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} /> New customer
            </button>
          </div>
        )}

        {customerMode === "existing" && clientName && (
          <div className="card-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Customer</p>
                <p className="text-sm font-semibold truncate mt-0.5">{clientName}</p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="text-xs font-bold text-ink underline underline-offset-2 shrink-0 ml-3"
              >
                Change
              </button>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Phone number
              </label>
              <input
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                inputMode="tel"
                placeholder="07XXX XXXXXX"
                className="mt-1.5 w-full bg-transparent outline-none text-sm border-b border-border pb-1.5"
              />
            </div>
          </div>
        )}


        {customerMode === "new" && (
          <div className="card-surface p-4 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Name
              </label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Customer name"
                className="mt-1.5 w-full bg-transparent outline-none text-sm border-b border-border pb-1.5"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Phone number
              </label>
              <input
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                inputMode="tel"
                placeholder="07XXX XXXXXX"
                className="mt-1.5 w-full bg-transparent outline-none text-sm border-b border-border pb-1.5"
              />
            </div>
          </div>
        )}

        {pickerOpen && (
          <CustomerPicker
            search={customerSearch}
            onSearch={setCustomerSearch}
            clients={filteredClients}
            onPick={(c) => {
              setClientName(c.name);
              setClientPhone(c.phone ?? "");
              setCustomerMode("existing");
              setPickerOpen(false);
            }}

            onClose={() => setPickerOpen(false)}
          />
        )}

        {!draft && (
          <div className="fixed bottom-20 inset-x-0 z-30 px-3 safe-bottom pointer-events-none">
            <div className="mx-auto max-w-md pointer-events-auto">
              <button
                type="submit"
                form="new-quote-form"
                disabled={loading || subBlocked}
                title={subBlocked ? "Your trial has ended, add a payment method to continue" : undefined}
                className="w-full bg-lime text-ink rounded-full py-4 font-bold inline-flex items-center justify-center gap-2 active:scale-[0.99] transition disabled:opacity-60 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.35)]"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : error ? (
                  <RefreshCw className="h-5 w-5" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
                {subBlocked
                  ? "Trial ended, add payment method"
                  : loading ? <RotatingStatus messages={QUOTE_GEN_MESSAGES} /> : error ? "Retry generate" : "Generate quote"}
              </button>

              {error && (
                <p className="mt-2 text-[12px] text-center text-status-overdue font-medium bg-paper/90 rounded-full py-1">{error}</p>
              )}
            </div>
          </div>
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
                  {li.source && (() => {
                    const src = normalizeSource(li.source, paidQuoteCount);
                    return (
                      <span
                        className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          src === "voice"
                            ? "bg-lime/30 text-ink"
                            : src === "learned"
                            ? "bg-lime/15 text-ink"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {src === "voice"
                          ? "Your price"
                          : src === "learned"
                          ? "Your usual price"
                          : "Quottr suggested"}
                      </span>
                    );
                  })()}
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
                  {(() => {
                    const isLabour = li.category === "labour" || li.category === "cis_labour";
                    const unit = li.unit ?? (isLabour ? "hours" : "qty");
                    const qtyLabel = unit === "hours" ? "Hrs" : unit === "days" ? "Days" : "Qty";
                    const priceSuffix = unit === "hours" ? "/hr" : unit === "days" ? "/day" : "";
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {qtyLabel}
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
                        {isLabour && (
                          <div className="inline-flex rounded bg-secondary p-0.5 text-[10px] font-semibold">
                            {(["hours", "days"] as const).map((u) => (
                              <button
                                key={u}
                                type="button"
                                onClick={() => {
                                  const next = [...draft.line_items];
                                  next[i] = { ...li, unit: u };
                                  setDraft({ ...draft, line_items: next });
                                }}
                                className={`px-2 py-0.5 rounded ${unit === u ? "bg-ink text-paper" : "text-muted-foreground"}`}
                              >
                                {u === "hours" ? "Hrs" : "Days"}
                              </button>
                            ))}
                          </div>
                        )}
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          £{priceSuffix && <span className="text-[10px]">{priceSuffix}</span>}
                          <input
                            type="text"
                            inputMode="decimal"
                            min={0}
                            step="0.01"
                            value={li.unit_price}
                            onChange={(e) => {
                              const next = [...draft.line_items];
                              next[i] = { ...li, unit_price: parseFloat(e.target.value) || 0 };
                              setDraft({ ...draft, line_items: next });
                            }}
                            onFocus={(e) => e.currentTarget.select()}
                            className="w-24 bg-secondary rounded px-2 py-1 text-sm text-ink num outline-none"
                          />
                        </label>
                        <p className="num text-sm ml-auto font-semibold">{formatGBP(li.qty * li.unit_price)}</p>
                      </div>
                    );
                  })()}
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

type PickerClient = { id: string; name: string; address?: string; phone?: string };

function CustomerPicker({
  search,
  onSearch,
  clients,
  onPick,
  onClose,
}: {
  search: string;
  onSearch: (v: string) => void;
  clients: PickerClient[];
  onPick: (c: PickerClient) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] bg-paper flex flex-col">
      <div className="bg-ink text-paper px-4 pt-5 pb-4 rounded-b-3xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-full bg-paper/10 border border-paper/15 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-paper" />
          </button>
          <h2 className="text-xl font-display tracking-wide">Choose customer</h2>
        </div>
        <div className="mt-4 flex items-center gap-2 bg-paper/10 rounded-full px-4 py-2.5">
          <Search className="h-4 w-4 text-paper/60 shrink-0" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search by name or address"
            autoFocus
            className="flex-1 bg-transparent outline-none text-sm text-paper placeholder:text-paper/50"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {clients.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            No customers match.
          </p>
        ) : (
          <ul className="px-2">
            {clients.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className="w-full text-left px-3 py-4 border-b border-border flex flex-col gap-0.5 active:bg-secondary"
                >
                  <span className="text-base font-semibold">{c.name}</span>
                  {c.address && (
                    <span className="text-xs text-muted-foreground truncate">{c.address}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
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
  error,
  lastTranscript,
  livePreview,
  liveSupported,
  onStart,
  onStop,
  onClose,
  onRetryTranscription,
}: {
  recording: boolean;
  transcribing: boolean;
  seconds: number;
  error: string | null;
  lastTranscript: string | null;
  livePreview: string;
  liveSupported: boolean;
  onStart: () => void;
  onStop: () => void;
  onClose: () => void;
  onRetryTranscription?: () => void;
}) {

  if (typeof document === "undefined") return null;
  const idle = !recording && !transcribing;
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-ink text-paper flex flex-col items-center justify-between px-6 pt-16 pb-10 safe-top safe-bottom">

      <div className="flex flex-col items-center">
        <p className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">
          {transcribing ? "Transcribing" : recording ? "Listening" : error ? "Try again" : "Tap to speak"}
        </p>
        <p className="num text-2xl mt-1 text-lime">{formatMMSS(seconds)}</p>
        {recording && (
          <div className="mt-3 w-full max-w-md min-h-[1.25rem] px-4 text-center">
            {livePreview ? (
              <p className="text-xs italic text-paper/50 leading-snug line-clamp-3">
                {livePreview}
              </p>
            ) : !liveSupported ? (
              <p className="text-xs italic text-paper/40">Listening…</p>
            ) : null}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={idle ? onStart : onStop}
        disabled={transcribing}
        aria-label={transcribing ? "Transcribing" : recording ? "Stop recording" : "Start recording"}
        className="relative flex items-center justify-center my-8 disabled:opacity-60"
      >
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
          ) : recording ? (
            <Square className="h-16 w-16 text-ink fill-ink" strokeWidth={2.25} />
          ) : (
            <Mic className="h-16 w-16 text-ink" strokeWidth={2.25} />
          )}
        </div>
      </button>

      <div className="w-full max-w-md min-h-[6rem] text-center space-y-2">
        {error ? (
          <>
            <p className="text-sm text-status-overdue font-medium">{error}</p>
            {onRetryTranscription && (
              <button
                type="button"
                onClick={onRetryTranscription}
                className="mt-2 inline-flex items-center gap-1.5 bg-lime text-ink rounded-full px-4 py-2 text-xs font-bold active:scale-[0.99]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry without re-recording
              </button>
            )}
          </>
        ) : transcribing ? (
          <p className="text-sm text-paper/60">Turning your voice into text…</p>

        ) : recording ? (
          <p className="text-sm text-paper/60">Describe the job, boiler, bathroom, materials, time…</p>
        ) : lastTranscript ? (
          <>
            <p className="text-[10px] uppercase tracking-widest text-paper/40 font-semibold">Captured</p>
            <p className="text-sm text-paper italic">“{lastTranscript}”</p>
          </>
        ) : (
          <p className="text-sm text-paper/50">Describe the job, boiler, bathroom, materials, time…</p>
        )}
      </div>

      {idle && (
        <button
          type="button"
          onClick={onClose}
          className="text-xs uppercase tracking-widest text-paper/50 font-semibold py-3"
        >
          {error || lastTranscript ? "Done" : "Cancel"}
        </button>
      )}
      {!idle && <div className="h-16" />}
    </div>,
    document.body,
  );
}

