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
  mockQuotes,
  type LineItem,
} from "@/lib/user-data";
import { supabase } from "@/integrations/supabase/client";
import { resolveTrade } from "@/lib/trades";


import { generateAIQuote, prefetchQuoteContext } from "@/lib/ai-quote.functions";
import { useSubscription } from "@/hooks/useSubscription";
import { transcribeAudio } from "@/lib/transcribe.functions";
import { Sparkles, Square, Save, RefreshCw, Loader2, Plus, Trash2, MapPin, X, Search } from "lucide-react";
import { VoiceWaveform } from "@/components/icons/VoiceIcons";
import { RotatingStatus, QUOTE_GEN_MESSAGES } from "@/components/RotatingStatus";
import { feedback, playSample } from "@/lib/feedback";
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

type PendingItem = { id: string; text: string };

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
  const prefetchFn = useServerFn(prefetchQuoteContext);
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
  const draftRef = useRef<HTMLDivElement | null>(null);
  const originalDraftRef = useRef<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const liveFinalRef = useRef<string>("");
  const liveInterimRef = useRef<string>("");
  const processedPhraseKeysRef = useRef<Set<string>>(new Set());

  // LIVE per-phrase pipeline: each recognised final phrase fires a parallel
  // Haiku generate call. Items append as soon as their phrase resolves.
  const [liveItems, setLiveItems] = useState<LineItem[]>([]);
  const liveItemsRef = useRef<LineItem[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const pendingItemsRef = useRef<PendingItem[]>([]);
  const pendingCountRef = useRef(0);
  const phraseSeqRef = useRef(0);
  const lastFinalIdxRef = useRef(-1);
  const voiceSessionRef = useRef(0);
  const closeRequestedRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prefetchedContextRef = useRef<any>(null);
  const liveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const LIVE_PAUSE_MS = 2000;

  // Kept as inert ref so nothing from older code paths leaks.
  const sharedStreamRef = useRef<MediaStream | null>(null);

  const updatePendingItems = (updater: (items: PendingItem[]) => PendingItem[]) => {
    setPendingItems((prev) => {
      const next = updater(prev);
      pendingItemsRef.current = next;
      return next;
    });
  };

  const clearPendingItems = () => {
    pendingItemsRef.current = [];
    setPendingItems([]);
  };

  const waitForPendingPhraseProcessing = async () => {
    while (pendingCountRef.current > 0 || pendingItemsRef.current.length > 0) {
      await new Promise((r) => setTimeout(r, 100));
    }
  };




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
    closeRequestedRef.current = false;
    setVoicePending(false);
    setVoiceError(null);
    setLastTranscript(null);
    setLivePreview("");
    liveFinalRef.current = "";
    liveInterimRef.current = "";
    processedPhraseKeysRef.current.clear();
    await startRecording();
  };
  const handleVoiceClose = () => {
    closeRequestedRef.current = true;
    voiceSessionRef.current++;
    try { recognitionRef.current?.stop?.(); } catch { /* noop */ }
    recognitionRef.current = null;
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      try { mr.stop(); } catch { /* noop */ }
    }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    sharedStreamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current?.getTracks().forEach((t) => t.stop());
    sharedStreamRef.current = null;
    streamRef.current = null;
    setVoicePending(false);
    setRecording(false);
    setTranscribing(false);
    setVoiceError(null);
    setLastTranscript(null);
    setLivePreview("");
    liveFinalRef.current = "";
    liveInterimRef.current = "";
    processedPhraseKeysRef.current.clear();
    clearPendingItems();
    pendingCountRef.current = 0;
    setLiveItems([]);
    liveItemsRef.current = [];
    phraseSeqRef.current = 0;
    lastFinalIdxRef.current = -1;
  };

  const recordStartRef = useRef<number>(0);
  const MIN_RECORD_MS = 1000;
  const stopRequestedRef = useRef<boolean>(false);

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === "inactive") return;
    stopRequestedRef.current = true;
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

  const appendTranscript = (text: string): { combinedDesc: string; target: "desc" | "clip" } => {
    const clean = text.trim();
    const currentTarget = recordTargetRef.current;
    if (!clean) return { combinedDesc: desc, target: currentTarget };
    setLastTranscript(clean);
    if (currentTarget === "clip") {
      setClips((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, transcript: clean }]);
      return { combinedDesc: desc, target: "clip" };
    }
    const combined = desc ? `${desc.trim()} ${clean}` : clean;
    setDesc(combined);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const end = el.value.length;
        el.setSelectionRange(end, end);
        el.scrollTop = el.scrollHeight;
      }
    });
    return { combinedDesc: combined, target: "desc" };
  };

  const runTranscribe = async (blob: Blob, mimeType: string) => {
    setTranscribing(true);
    setVoiceError(null);
    clearPendingItems();
    try {
      const audioBase64 = await blobToBase64(blob);
      const { text } = await transcribeFn({ data: { audioBase64, mimeType } });
      const { combinedDesc, target } = appendTranscript(text);
      lastBlobRef.current = null;
      if (target === "desc" && mode === "speak" && combinedDesc.trim() && !draft) {
        await generate(combinedDesc);
      }
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
      clearPendingItems();
    }
  };

  const retryTranscription = () => {
    const cached = lastBlobRef.current;
    if (!cached) return;
    void runTranscribe(cached.blob, cached.mimeType);
  };



  // Filter out breath/noise/filler-only phrases — only let real speech
  // trigger a per-phrase generate call.
  const isMeaningfulPhrase = (text: string): boolean => {
    const t = text.trim();
    if (t.length < 4) return false;
    const words = t.split(/\s+/).filter((w) => /[a-z]{2,}/i.test(w));
    if (words.length < 2) return false;
    // Reject pure filler ("uh um er erm yeah ok okay right so").
    const filler = /^(?:uh|um|er|erm|yeah|ok|okay|right|so|hmm|well|and|or)$/i;
    if (words.every((w) => filler.test(w))) return false;
    return true;
  };

  const deriveTitle = (items: LineItem[]): string => {
    const first = items[0]?.description?.trim();
    if (first) return first.length > 60 ? `${first.slice(0, 57)}…` : first;
    return `${trade} quote`;
  };

  // Fire-and-forget per-phrase generate. Runs in PARALLEL — phrase 2 starts
  // immediately even while phrase 1 is still in flight.
  const processPhrase = async (text: string, sessionId: number) => {
    if (sessionId !== voiceSessionRef.current || closeRequestedRef.current) return;
    const id = `p-${++phraseSeqRef.current}`;
    pendingCountRef.current++;
    updatePendingItems((prev) => [...prev, { id, text }]);
    try {
      const ctx = prefetchedContextRef.current;
      const g = await generateFn({
        data: {
          description: text,
          trade,
          vatRegistered: vat,
          ...(ctx ? { prefetchedContext: ctx } : {}),
        },
      });
      if (sessionId !== voiceSessionRef.current || closeRequestedRef.current) return;
      if (g.line_items?.length) {
        setLiveItems((prev) => {
          const next = [...prev, ...g.line_items];
          liveItemsRef.current = next;
          return next;
        });
      }
    } catch (err) {
      // Quiet failure for live phrases — don't break the recogniser pipeline
      // or surface a scary error mid-recording. Stop fallback still runs.
      console.warn("[voice] phrase generate failed", err);
    } finally {
      if (sessionId === voiceSessionRef.current) {
        pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
        updatePendingItems((prev) => prev.filter((p) => p.id !== id));
      }
    }
  };

  // Pause-debounced full regeneration. When the speaker pauses for
  // LIVE_PAUSE_MS we send the ENTIRE accumulated transcript to the AI and
  // REPLACE the live items with the returned list. This avoids the duplicate
  // and invented-filler items produced by per-phrase generation, since each
  // call now sees the full context.
  const regenerateLiveQuote = async (sessionId: number) => {
    if (sessionId !== voiceSessionRef.current || closeRequestedRef.current) return;
    const transcript = liveFinalRef.current.trim();
    if (!transcript || !isMeaningfulPhrase(transcript)) return;
    const genId = ++phraseSeqRef.current;
    pendingCountRef.current++;
    try {
      const ctx = prefetchedContextRef.current;
      const g = await generateFn({
        data: { description: transcript, trade, vatRegistered: vat, ...(ctx ? { prefetchedContext: ctx } : {}) },
      });
      if (sessionId !== voiceSessionRef.current || closeRequestedRef.current) return;
      if (genId !== phraseSeqRef.current) return;
      if (g.line_items?.length) {
        setLiveItems(g.line_items);
        liveItemsRef.current = g.line_items;
      }
    } catch (err) {
      console.warn("[voice] live regenerate failed", err);
    } finally {
      pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
    }
  };

  // LIVE FLOW: continuous MediaRecorder (only used as a stop-time fallback if
  // Web Speech produced no items) + Web Speech API per-phrase pipeline.
  const startRecording = async () => {
    const sessionId = voiceSessionRef.current + 1;
    voiceSessionRef.current = sessionId;
    closeRequestedRef.current = false;
    setVoiceError(null);
    clearPendingItems();
    pendingCountRef.current = 0;
    setLiveItems([]);
    liveItemsRef.current = [];
    phraseSeqRef.current = 0;
    lastFinalIdxRef.current = -1;
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
    sharedStreamRef.current = stream;

    // Prefetch labour rates + patterns ONCE — reused for every per-phrase call.
    // Fire-and-forget; per-phrase calls fall back to server-side fetch if it
    // hasn't arrived yet.
    prefetchedContextRef.current = null;
    void prefetchFn()
      .then((ctx) => { prefetchedContextRef.current = ctx; })
      .catch((e) => console.warn("[voice] prefetch failed", e));

    const mimeType = pickMimeType();
    liveFinalRef.current = "";
    liveInterimRef.current = "";
    processedPhraseKeysRef.current.clear();
    setLivePreview("");
    stopRequestedRef.current = false;

    const isClipMode = recordTargetRef.current === "clip";

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
      try { recognitionRef.current?.stop?.(); } catch { /* noop */ }
      recognitionRef.current = null;
      setRecording(false);
      sharedStreamRef.current?.getTracks().forEach((t) => t.stop());
      sharedStreamRef.current = null;
      streamRef.current = null;
      const blobType = mr.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type: blobType });
      chunksRef.current = [];

      if (closeRequestedRef.current || sessionId !== voiceSessionRef.current) {
        return;
      }

      if (isClipMode) {
        // Clip mode uses single-pass Whisper for on-site capture.
        if (blob.size < 1000) {
          setVoiceError("Recording was too short. Hold and speak for at least 2 seconds.");
          return;
        }
        lastBlobRef.current = { blob, mimeType: blobType };
        await runTranscribe(blob, blobType);
        return;
      }

      const finalInterim = liveInterimRef.current.trim();
      if (finalInterim) {
        liveFinalRef.current = `${liveFinalRef.current} ${finalInterim}`.trim();
      }
      if (liveDebounceRef.current) { clearTimeout(liveDebounceRef.current); liveDebounceRef.current = null; }
      void regenerateLiveQuote(sessionId);

      // Wait for all in-flight phrase generates to settle before snapshotting
      // liveItemsRef so the final spoken phrase cannot be orphaned or dropped.
      setTranscribing(true);
      await waitForPendingPhraseProcessing();
      setTranscribing(false);

      const items = liveItemsRef.current;
      if (items.length > 0) {
        const transcript = liveFinalRef.current.trim();
        const built = { title: deriveTitle(items), line_items: items };
        setDraft(built);
        originalDraftRef.current = JSON.stringify(items);
        setDesc(transcript);
        clearPendingItems();
        setLivePreview("");
        liveFinalRef.current = "";
        liveInterimRef.current = "";
        feedback("success");
        playSample("ding");
        requestAnimationFrame(() => {
          draftRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        return;
      }

      // FALLBACK: Web Speech produced nothing usable → single Whisper pass.
      clearPendingItems();
      if (blob.size < 1000) {
        setLivePreview("");
        liveFinalRef.current = "";
        setVoiceError("We didn't catch any speech. Tap the mic and describe the job out loud.");
        return;
      }
      lastBlobRef.current = { blob, mimeType: blobType };
      await runTranscribe(blob, blobType);
    };

    // Web Speech API: drives live preview AND per-phrase processing.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any =
      typeof window !== "undefined"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;
    if (SR && !isClipMode) {
      setLiveSupported(true);
      try {
        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-GB";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onresult = (event: any) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            const txt = res[0]?.transcript ?? "";
            if (res.isFinal) {
              if (i > lastFinalIdxRef.current) {
                lastFinalIdxRef.current = i;
                liveFinalRef.current = `${liveFinalRef.current} ${txt}`.trim();
                if (liveDebounceRef.current) clearTimeout(liveDebounceRef.current);
                const sid = sessionId;
                liveDebounceRef.current = setTimeout(() => { void regenerateLiveQuote(sid); }, LIVE_PAUSE_MS);
              }
            } else {
              interim += txt;
            }
          }
          liveInterimRef.current = interim.trim();
          setLivePreview(`${liveFinalRef.current} ${interim}`.trim());
        };
        rec.onerror = () => { /* silent: pipeline only */ };
        rec.onend = () => {
          if (!stopRequestedRef.current && mediaRecorderRef.current?.state === "recording") {
            lastFinalIdxRef.current = -1; // new session, fresh result indices
            try { rec.start(); } catch { /* noop */ }
          }
        };
        recognitionRef.current = rec;
        try { rec.start(); } catch { /* noop */ }
      } catch {
        recognitionRef.current = null;
      }
    } else if (!SR) {
      setLiveSupported(false);
    }

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

  const generate = async (overrideText?: string) => {
    const text = overrideText !== undefined
      ? overrideText.trim()
      : mode === "onsite" ? combinedClipsText() : desc.trim();
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
      originalDraftRef.current = JSON.stringify(g.line_items);
      // Prefer the AI-cleaned job description over the raw transcript.
      setDesc(g.clean_description?.trim() || text);
      // Auto-populate customer details extracted from the transcript when fields are empty.
      const ec = g.extracted_customer;
      if (ec?.name && !clientName.trim()) setClientName(ec.name);
      if (ec?.phone && !clientPhone.trim()) setClientPhone(ec.phone);
      feedback("success");
      playSample("ding");
      requestAnimationFrame(() => {
        draftRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
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
      // First-quote celebration: stash a flag the detail page can read once.
      if (mockQuotes.length === 1) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const uid = session?.user?.id;
          if (uid) {
            const seenKey = `quottr.firstQuoteSeen:${uid}`;
            if (typeof localStorage !== "undefined" && !localStorage.getItem(seenKey)) {
              sessionStorage.setItem("quottr.celebrateFirstQuote", q.id);
              localStorage.setItem(seenKey, "1");
            }
          }
        } catch { /* noop */ }
      }
      navigate({ to: "/quotes/$quoteId", params: { quoteId: q.id } });

    } catch (e) {
      feedback("error");
      setError(e instanceof Error ? e.message : "Could not save quote");
      setSaving(false);
    }
  };

  return (
    <AppShell>
      {!draft && (recording || transcribing || voicePending || voiceError) && (
        <VoiceOverlay
          recording={recording}
          transcribing={transcribing}
          seconds={recordSeconds}
          error={voiceError}
          lastTranscript={lastTranscript}
          livePreview={livePreview}
          liveSupported={liveSupported}
          liveItems={liveItems}
          pendingItems={pendingItems}
          streamRef={sharedStreamRef}
          onStart={handleVoiceStart}
          onStop={stopRecording}
          onClose={handleVoiceClose}
          onRetryTranscription={lastBlobRef.current ? retryTranscription : undefined}
          onUpdateItem={(index, patch) => {
            setLiveItems((prev) => {
              const next = prev.map((it, i) => (i === index ? { ...it, ...patch } : it));
              liveItemsRef.current = next;
              return next;
            });
          }}
          onDeleteItem={(index) => {
            setLiveItems((prev) => {
              const next = prev.filter((_, i) => i !== index);
              liveItemsRef.current = next;
              return next;
            });
            feedback("warn");
          }}
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
            <VoiceWaveform size={14} /> Speak it
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
          {resolveTrade(trade).certifications.length > 0 && (
            <div className="mt-1.5 -mx-4 px-4 overflow-x-auto">
              <div className="flex items-center gap-1.5 pb-1">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold shrink-0 mr-1">
                  Add cert
                </span>
                {resolveTrade(trade).certifications.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => {
                      const addition = `Include ${c.label}.`;
                      setDesc((d) => (d.trim() ? `${d.trim()} ${addition}` : addition));
                      setDraft(null);
                      textareaRef.current?.focus();
                    }}
                    className="shrink-0 rounded-full bg-lime/20 text-ink text-[11px] font-semibold px-3 py-1.5 hover:bg-lime hover:text-ink transition"
                  >
                    + {c.label}
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
                  <VoiceWaveform size={16} />
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
                onPointerDown={() => feedback("tap")}
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
          <div ref={draftRef} className="card-surface overflow-hidden scroll-mt-20">

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

        {/* Step 4: Assign customer (after draft is generated) */}
        {draft && (
          <div className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Step 4</p>
              <h3 className="text-lg font-bold mt-0.5">Who's this for?</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Assign a customer so we know where this quote is going.
              </p>
            </div>

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
                  onClick={() => {
                    setCustomerMode("existing");
                    setClientName("");
                    setClientPhone("");
                    setPickerOpen(true);
                  }}
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
          </div>
        )}

        {draft && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={save}
              onPointerDown={() => feedback("tap")}
              disabled={!clientName.trim() || saving}
              title={!clientName.trim() ? "Add a customer to save this quote." : undefined}
              className="w-full bg-lime text-ink rounded-full py-3.5 font-bold inline-flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save quote
            </button>
            {!clientName.trim() && (
              <p className="text-[12px] text-center text-muted-foreground">
                Add a customer to save this quote.
              </p>
            )}
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

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function CountUpGBP({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const duration = 280;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = from + (to - from) * eased;
      setDisplay(cur);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);
  return <span className={className}>{formatGBP(display)}</span>;
}


function MicLevelRings({
  streamRef,
  active,
  size,
}: {
  streamRef?: React.RefObject<MediaStream | null>;
  active: boolean;
  size: "lg" | "sm";
}) {
  const innerRef = useRef<HTMLSpanElement | null>(null);
  const outerRef = useRef<HTMLSpanElement | null>(null);
  const levelRef = useRef(0);
  const phaseRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    const reduced = typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const stream = streamRef?.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AC: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let data: Uint8Array | null = null;
    let raf = 0;
    let stopped = false;

    if (!reduced && stream && AC) {
      try {
        ctx = new AC();
        source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.85;
        source.connect(analyser);
        data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      } catch {
        ctx = null;
        analyser = null;
      }
    }

    const tick = () => {
      if (stopped) return;
      let level = 0;
      if (analyser && data) {
        analyser.getByteTimeDomainData(data as Uint8Array<ArrayBuffer>);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // Map rms (typically 0..0.3 for speech) to 0..1, then smooth.
        const target = Math.min(1, rms * 4);
        levelRef.current += (target - levelRef.current) * 0.25;
        level = levelRef.current;
      }
      // Idle breathing pulse so it never feels dead.
      phaseRef.current += 0.05;
      const breathe = (Math.sin(phaseRef.current) + 1) / 2; // 0..1
      const breatheAmt = 0.12 + breathe * 0.08; // gentle baseline

      const combined = Math.max(breatheAmt, level);
      const innerScale = 1 + combined * 0.55;
      const outerScale = 1 + combined * 1.05;
      const innerOpacity = 0.25 + combined * 0.45;
      const outerOpacity = 0.12 + combined * 0.25;

      if (innerRef.current) {
        innerRef.current.style.transform = `scale(${innerScale.toFixed(3)})`;
        innerRef.current.style.opacity = innerOpacity.toFixed(3);
      }
      if (outerRef.current) {
        outerRef.current.style.transform = `scale(${outerScale.toFixed(3)})`;
        outerRef.current.style.opacity = outerOpacity.toFixed(3);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      try { source?.disconnect(); } catch { /* noop */ }
      try { analyser?.disconnect(); } catch { /* noop */ }
      try { ctx?.close(); } catch { /* noop */ }
    };
  }, [active, streamRef]);

  const dims = size === "lg"
    ? { inner: "h-44 w-44", outer: "h-56 w-56" }
    : { inner: "h-16 w-16", outer: "h-20 w-20" };

  return (
    <>
      <span
        ref={outerRef}
        className={`absolute ${dims.outer} rounded-full bg-lime/20 will-change-transform`}
        style={{ transform: "scale(1)", opacity: 0.18, transition: "opacity 120ms linear" }}
      />
      <span
        ref={innerRef}
        className={`absolute ${dims.inner} rounded-full bg-lime/30 will-change-transform`}
        style={{ transform: "scale(1)", opacity: 0.32, transition: "opacity 120ms linear" }}
      />
    </>
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
  liveItems,
  pendingItems,
  streamRef,
  onStart,
  onStop,
  onClose,
  onRetryTranscription,
  onUpdateItem,
  onDeleteItem,
}: {
  recording: boolean;
  transcribing: boolean;
  seconds: number;
  error: string | null;
  lastTranscript: string | null;
  livePreview: string;
  liveSupported: boolean;
  liveItems: LineItem[];
  pendingItems: { id: string; text: string }[];
  streamRef?: React.RefObject<MediaStream | null>;
  onStart: () => void;
  onStop: () => void;
  onClose: () => void;
  onRetryTranscription?: () => void;
  onUpdateItem: (index: number, patch: Partial<LineItem>) => void;
  onDeleteItem: (index: number) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const prevCountRef = useRef(0);
  const justLandedFrom = prevCountRef.current;
  useEffect(() => {
    prevCountRef.current = liveItems.length;
  }, [liveItems.length]);
  const liveTotal = liveItems.reduce((s, li) => s + li.qty * li.unit_price, 0);

  // Independent list scroll with sticky auto-pin to bottom.
  const listRef = useRef<HTMLUListElement | null>(null);
  const pinnedRef = useRef(true);
  const onListScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedRef.current = distance < 80;
  };
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (pinnedRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [liveItems.length, pendingItems.length]);


  function beginEdit(i: number, li: LineItem) {
    setEditingIndex(i);
    setEditDesc(li.description);
    setEditPrice(String(li.qty * li.unit_price));
  }
  function commitEdit(i: number, li: LineItem) {
    const total = parseFloat(editPrice);
    const safeTotal = isFinite(total) && total >= 0 ? total : li.qty * li.unit_price;
    const qty = li.qty || 1;
    onUpdateItem(i, {
      description: editDesc.trim() || li.description,
      unit_price: +(safeTotal / qty).toFixed(2),
    });
    setEditingIndex(null);
    feedback("success");
  }

  if (typeof document === "undefined") return null;
  const idle = !recording && !transcribing;
  const hasItems = liveItems.length > 0;
  const hasPending = pendingItems.length > 0;
  const showList = (recording || transcribing) && (hasItems || hasPending);
  return createPortal(
    <div className={`fixed inset-0 z-[60] bg-ink text-paper flex flex-col px-6 pt-12 pb-8 safe-top safe-bottom ${showList ? "" : "items-center justify-between"}`}>

      {/* PINNED TOP: meta + running total */}
      <div className={`flex flex-col items-center w-full max-w-md mx-auto ${showList ? "shrink-0" : ""}`}>
        <p className="text-[10px] uppercase tracking-widest text-paper/60 font-semibold">
          {transcribing ? "Building your quote" : recording ? "Listening" : error ? "Try again" : "Tap to speak"}
        </p>
        <p className="num text-2xl mt-1 text-paper">
          <span className="text-lime">●</span> <span className="text-paper">{formatMMSS(seconds)}</span>
        </p>

        {showList && hasItems && (
          <div className="mt-4 flex flex-col items-center">
            <p className="text-[10px] uppercase tracking-widest text-paper/50 font-semibold">Running total</p>
            <CountUpGBP value={liveTotal} className="num text-4xl text-lime mt-0.5" />
          </div>
        )}

        {showList && hasItems && (
          <p className="mt-3 text-[10px] uppercase tracking-widest text-paper/40 text-center">
            Tap a line to edit
          </p>
        )}
      </div>

      {/* SCROLLABLE MIDDLE: line items list — fills available space between total and stop button */}
      {showList && (
        <div className="relative flex-1 min-h-0 w-full max-w-md mx-auto mt-2">
          {/* top fade */}
          <span aria-hidden className="pointer-events-none absolute top-0 inset-x-0 h-4 bg-gradient-to-b from-ink to-transparent z-10" />
          <ul
            ref={listRef}
            onScroll={onListScroll}
            className="absolute inset-0 w-full overflow-y-auto space-y-1.5 pt-2 pb-28 pr-1 -mr-1"
            style={{ scrollbarWidth: "thin" }}
          >
            {liveItems.map((li, i) => {
              const isLabour = li.category === "labour" || li.category === "cis_labour";
              const unit = li.unit ?? (isLabour ? "hours" : "qty");
              const suffix = unit === "hours" ? "/hr" : unit === "days" ? "/day" : "";
              const isEditing = editingIndex === i;
              if (isEditing) {
                return (
                  <li
                    key={i}
                    className="rounded-lg bg-paper/[0.08] border-l-2 border-lime pl-3 pr-3 py-2 space-y-2"
                  >
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={2}
                      autoFocus
                      className="w-full rounded-md bg-ink/60 border border-paper/20 px-2 py-1.5 text-sm text-paper placeholder-paper/40 focus:outline-none focus:border-lime"
                      placeholder="Description"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-paper/60">£</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="flex-1 rounded-md bg-ink/60 border border-paper/20 px-2 py-1.5 num text-sm text-paper focus:outline-none focus:border-lime"
                        placeholder="0.00"
                      />
                      <button
                        type="button"
                        onClick={() => { onDeleteItem(i); setEditingIndex(null); }}
                        className="rounded-md bg-status-overdue/20 text-status-overdue px-2 py-1.5"
                        aria-label="Delete line item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingIndex(null)}
                        className="rounded-md bg-paper/10 text-paper px-3 py-1.5 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => commitEdit(i, li)}
                        className="rounded-md bg-lime text-ink px-3 py-1.5 text-xs font-bold"
                      >
                        Save
                      </button>
                    </div>
                  </li>
                );
              }
              const justLanded = i >= justLandedFrom;
              return (
                <li
                  key={i}
                  onClick={() => beginEdit(i, li)}
                  className={`rounded-lg bg-paper/[0.06] border-l-2 border-lime pl-3 pr-3 py-2 flex items-start gap-3 animate-scale-in cursor-pointer active:bg-paper/[0.1] ${justLanded ? "animate-line-glow" : ""}`}
                >
                  <span className="num text-[11px] font-bold text-paper/40 mt-0.5 shrink-0 w-5 text-right">
                    {i + 1}
                  </span>
                  <p className="flex-1 text-sm leading-snug text-paper font-medium">
                    {li.description}
                  </p>
                  <p className="num text-sm font-semibold text-paper shrink-0 whitespace-nowrap text-right">
                    <span className="text-paper/60 text-xs font-medium">
                      {li.qty}{unit === "hours" ? "h" : unit === "days" ? "d" : ""} × {formatGBP(li.unit_price)}
                    </span>
                    <span className="text-paper/40 mx-1">=</span>
                    {formatGBP(li.qty * li.unit_price)}
                    {suffix && <span className="text-paper/50 text-[10px]"> {suffix}</span>}
                  </p>
                </li>
              );
            })}
            {pendingItems.map((p) => (
              <li
                key={p.id}
                className="rounded-lg bg-paper/[0.04] border-l-2 border-paper/20 pl-3 pr-3 py-2 flex items-center gap-3 animate-scale-in"
                aria-live="polite"
              >
                <span className="num text-[11px] font-bold text-paper/30 mt-0.5 shrink-0 w-5 text-right">
                  {liveItems.length + 1}
                </span>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-paper/50 italic">Got it…</span>
                  <span className="relative flex-1 h-2 overflow-hidden rounded-full bg-paper/[0.06]">
                    <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-paper/30 to-transparent bg-[length:200%_100%]" />
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {/* bottom fade hint that list continues under the stop button */}
          <span aria-hidden className="pointer-events-none absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-ink via-ink/85 to-transparent z-10" />
        </div>
      )}



      {/* EMPTY STATE: large central mic — hero of an empty screen */}
      {!hasItems && !hasPending && (
        <button
          type="button"
          onClick={idle ? onStart : onStop}
          disabled={transcribing}
          aria-label={transcribing ? "Transcribing" : recording ? "Stop recording" : "Start recording"}
          className="relative flex items-center justify-center my-6 disabled:opacity-60"
        >
          {recording && (
            <MicLevelRings streamRef={streamRef} active={recording} size="lg" />
          )}
          <div
            className={`relative h-36 w-36 rounded-full bg-lime flex items-center justify-center shadow-[0_20px_60px_-12px_rgba(200,224,74,0.7)] transition-all ${
              recording ? "animate-[pulse_1.4s_ease-in-out_infinite]" : ""
            }`}
          >
            {transcribing ? (
              <Loader2 className="h-14 w-14 text-ink animate-spin" />
            ) : recording ? (
              <Square className="h-14 w-14 text-ink fill-ink" strokeWidth={2.25} />
            ) : (
              <VoiceWaveform size={56} className="text-ink" />
            )}
          </div>
        </button>
      )}

      {/* ACTIVE / BUILDING STATE: smaller FAB docked at bottom-centre */}
      {(hasItems || hasPending) && (
        <button
          type="button"
          onClick={idle ? onStart : onStop}
          disabled={transcribing}
          aria-label={transcribing ? "Transcribing" : recording ? "Stop recording" : "Start recording"}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[70] flex items-center justify-center disabled:opacity-60"
        >
          {recording && (
            <MicLevelRings streamRef={streamRef} active={recording} size="sm" />
          )}
          <div
            className={`relative h-14 w-14 rounded-full bg-lime flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(200,224,74,0.6)] transition-all ${
              recording ? "animate-[pulse_1.4s_ease-in-out_infinite]" : ""
            }`}
          >
            {transcribing ? (
              <Loader2 className="h-7 w-7 text-ink animate-spin" />
            ) : recording ? (
              <Square className="h-7 w-7 text-ink fill-ink" strokeWidth={2.25} />
            ) : (
              <VoiceWaveform size={28} className="text-ink" />
            )}
          </div>
        </button>
      )}

      {/* Bottom text area — pushes up when mic is large, stays above FAB when mic is small */}
      <div className={`w-full max-w-md min-h-[4rem] text-center space-y-2 ${(hasItems || hasPending) ? "pb-16" : ""}`}>
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
          <p className="text-sm text-paper/70">Building your quote…</p>
        ) : recording ? (
          <p className="text-sm text-paper/70">
            Keep talking — describe the job, materials, time. Tap stop when done.
          </p>

        ) : lastTranscript ? (
          <>
            <p className="text-[10px] uppercase tracking-widest text-paper/40 font-semibold">Captured</p>
            <p className="text-sm text-paper italic">“{lastTranscript}”</p>
          </>
        ) : (
          <p className="text-sm text-paper/60">Describe the job, boiler, bathroom, materials, time…</p>
        )}
      </div>

      {idle && (
        <button
          type="button"
          onClick={onClose}
          className="text-xs uppercase tracking-widest text-paper/60 font-semibold py-3"
        >
          {error || lastTranscript ? "Done" : "Cancel"}
        </button>
      )}
      {!idle && <div className={`h-12 ${(hasItems || hasPending) ? "pb-8" : ""}`} />}
    </div>,
    document.body,
  );
}


