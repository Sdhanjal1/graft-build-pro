import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, PageHeader } from "@/components/AppShell";
import {
  userProfile,
  userClients,
  getClient,
  getQuote,
  saveGeneratedQuote,
  updateGeneratedQuote,
  updateClientPhone,
  formatGBP,
  QUOTE_TEMPLATES,
  mockQuotes,
  type LineItem,
  type Quote,
} from "@/lib/user-data";
import { supabase } from "@/integrations/supabase/client";
import { resolveTrade } from "@/lib/trades";
import { toast } from "sonner";


import { generateAIQuote } from "@/lib/ai-quote.functions";
import { useLiveQuoteSession } from "@/lib/use-live-quote-session";
import { useSubscription } from "@/hooks/useSubscription";
import { transcribeAudio } from "@/lib/transcribe.functions";
import { Sparkles, Square, Save, RefreshCw, Loader2, Plus, Trash2, X, Search, Send, Check, Banknote, Zap, Mic, ChevronRight, AlertCircle, ArrowLeftRight, Keyboard } from "lucide-react";
import { SendQuoteDialog } from "@/components/SendQuoteDialog";
import { VoiceWaveform } from "@/components/icons/VoiceIcons";
import { RotatingStatus, QUOTE_GEN_MESSAGES } from "@/components/RotatingStatus";
import { feedback, playSample } from "@/lib/feedback";
import { RotatingPrompts } from "@/components/RotatingPrompts";
import { IOSStandaloneRecordingNotice } from "@/components/IOSStandaloneRecordingNotice";
import { usePaidQuoteCount, normalizeSource } from "@/hooks/usePaidQuoteCount";
import {
  type PaymentTiming,
  deriveTimingFromTotal,
  defaultDepositPercent,
  computeDepositAmount,
  computeDepositPercent,
  parseDepositInput,
  paymentTimingLabel,
} from "@/lib/payment-timing";

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
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return reject(new Error("Unexpected reader result"));
      // result is "data:<mime>;base64,<payload>"
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

type QuotesNewSearch = {
  voice?: 1;
  type?: 1;
  clientId?: string;
  edit?: string;
  prefill?: string;
};

export const Route = createFileRoute("/quotes/new")({
  component: NewQuotePage,
  validateSearch: (s: Record<string, unknown>): QuotesNewSearch => ({
    ...(s.voice === 1 || s.voice === "1" ? { voice: 1 as const } : {}),
    ...(s.type === 1 || s.type === "1" || s.type === true || s.type === "true" ? { type: 1 as const } : {}),
    ...(typeof s.clientId === "string" ? { clientId: s.clientId } : {}),
    ...(typeof s.edit === "string" ? { edit: s.edit } : {}),
    ...(typeof s.prefill === "string" && s.prefill ? { prefill: s.prefill } : {}),
  }),
});

type Draft = { title: string; line_items: LineItem[] } | null;

type Clip = { id: string; transcript: string };

type PendingItem = { id: string; text: string };

function NewQuotePage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { voice: voiceParam, type: typeParam, clientId, edit: editId, prefill } = Route.useSearch();
  const prefillAppliedRef = useRef(false);
  const [editLoading, setEditLoading] = useState<boolean>(() => !!editId && !getQuote(editId));
  const [editError, setEditError] = useState<string | null>(null);
  const [mode] = useState<"speak" | "onsite">("speak");
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
  // Most recent quote's customer, for a one-tap "same as last" shortcut.
  const lastCustomer = (() => {
    const recent = mockQuotes.find((q) => q.client_id);
    if (!recent) return null;
    const c = getClient(recent.client_id);
    return c ? { id: c.id, name: c.name, phone: c.phone } : null;
  })();
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceOpening, setVoiceOpening] = useState(false);
  useEffect(() => { if (recording) setVoiceOpening(false); }, [recording]);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  
  const [draft, setDraft] = useState<Draft>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generateFn = useServerFn(generateAIQuote);
  
  const transcribeFn = useServerFn(transcribeAudio);
  const { canUse: subActive, blocked: subBlocked, loading: subLoading } = useSubscription();
  const paidQuoteCount = usePaidQuoteCount();

  // Payment timing / deposit state — surfaced on the draft preview so the
  // trader can pick how this quote gets paid before saving.
  const [paymentTiming, setPaymentTiming] = useState<PaymentTiming>("on_completion");
  const [depositPct, setDepositPct] = useState<number>(0);
  const [depositAmt, setDepositAmt] = useState<number>(0);
  const [depositAmtRaw, setDepositAmtRaw] = useState<string>("");
  const [depositPctRaw, setDepositPctRaw] = useState<string>("");
  const paymentSeededRef = useRef(false);
  const [editVoiceOpen, setEditVoiceOpen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recordTargetRef = useRef<"desc" | "clip" | "edit">("desc");
  const lastBlobRef = useRef<{ blob: Blob; mimeType: string } | null>(null);
  const draftRef = useRef<HTMLDivElement | null>(null);
  const customerRef = useRef<HTMLDivElement | null>(null);
  const [showTyping, setShowTyping] = useState(!!typeParam);
  const [confirmTrashIdx, setConfirmTrashIdx] = useState<number | null>(null);
  const originalDraftRef = useRef<string>("");
  // Set true when a voice finalise wants the page to scroll to the freshly
  // committed draft. The scroll runs in an effect that watches `draft` so it
  // fires AFTER React has painted the draft surface into the DOM, not before.
  const pendingScrollToDraftRef = useRef<boolean>(false);

  const voiceSessionRef = useRef(0);
  const closeRequestedRef = useRef(false);
  // Session-scoped tombstones so user deletions during recording survive a
  // subsequent voice-add pass. Keyed by normalised description.
  const deletedDescsRef = useRef<Set<string>>(new Set());
  const normDesc = (s: string) => s.trim().toLowerCase();

  // Kept as inert ref so nothing from older code paths leaks.
  const sharedStreamRef = useRef<MediaStream | null>(null);

  // Live realtime path — when true, the active recording session is being
  // streamed through useLiveQuoteSession rather than buffered into a
  // MediaRecorder + Whisper finalise. Stays false for clip/edit modes.
  const liveActiveRef = useRef(false);
  // State mirror of liveActiveRef so renders react. Drives the compact
  // sticky bar vs full overlay decision below.
  const [liveActive, setLiveActive] = useState(false);

  const live = useLiveQuoteSession({
    trade,
    vatRegistered: vat,
    onResult: (g, transcript) => {
      // Stale-session guard: if the user closed or restarted while a pass
      // was in flight, drop the result rather than overwriting the draft.
      if (closeRequestedRef.current) return;
      // Arm scroll BEFORE setDraft so the watcher fires on the next render
      // once the draft surface is mounted (same discipline as finaliseFromAudio).
      pendingScrollToDraftRef.current = true;
      setDraft({ title: g.title, line_items: g.line_items });
      originalDraftRef.current = JSON.stringify(g.line_items);
      setDesc(g.clean_description || transcript);
      const ec = g.extracted_customer;
      // Functional setState — avoids stale-closure overwrites of names the
      // user typed mid-recording.
      if (ec?.name) setClientName((prev) => (prev.trim() ? prev : ec.name!));
      if (ec?.phone) setClientPhone((prev) => (prev.trim() ? prev : ec.phone!));
    },
    onError: (msg) => {
      setVoiceError(msg);
      setError(msg);
    },
  });




  useEffect(() => {
    return () => {
      // Orphan any in-flight phrase generates so their results are discarded.
      voiceSessionRef.current++;
      closeRequestedRef.current = true;
      if (tickRef.current) clearInterval(tickRef.current);
      sharedStreamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current?.getTracks().forEach((t) => t.stop());
      sharedStreamRef.current = null;
      streamRef.current = null;
    };
  }, []);

  // When arriving via "Or type instead", focus the textarea immediately.
  useEffect(() => {
    if (typeParam) {
      const t = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [typeParam]);

  // ?voice=1 means "show the overlay in idle, waiting for the user gesture".
  // iOS Safari requires getUserMedia to be invoked from a real user gesture,
  // so the user taps the lime mic in the overlay to start. Derived from the
  // URL so it can't race a setState during navigation.
  const voicePending = voiceParam === 1;

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

  // Seed the description from ?prefill once (e.g. arriving from an inbox request).
  // Strip the param after applying so it doesn't overwrite later edits.
  useEffect(() => {
    if (!prefill || prefillAppliedRef.current) return;
    prefillAppliedRef.current = true;
    setDesc(prefill);
    navigate({
      to: "/quotes/new",
      search: (prev: QuotesNewSearch) => {
        const { prefill: _omit, ...rest } = prev;
        return rest;
      },
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);


  // Edit mode: pre-load the existing quote into the draft so the user can
  // re-record (replaces line items) or tweak before saving.
  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    const apply = (q: Quote) => {
      if (cancelled) return;
      setDraft({ title: q.title, line_items: q.line_items });
      originalDraftRef.current = JSON.stringify(q.line_items);
      setDesc(q.job_description ?? "");
      if (q.client_id) {
        const c = getClient(q.client_id);
        if (c) {
          setClientName(c.name);
          setClientPhone(c.phone ?? "");
          setCustomerMode("existing");
        }
      }
      // Seed payment timing from the stored quote so the draft preview shows
      // the same options the detail page would.
      const t: PaymentTiming = q.payment_timing ?? "on_completion";
      const p = q.deposit_percent ?? 0;
      const a = q.deposit_amount ?? 0;
      setPaymentTiming(t);
      setDepositPct(p);
      setDepositAmt(a);
      setDepositPctRaw(p ? String(p) : "");
      setDepositAmtRaw(a ? String(a) : "");
      paymentSeededRef.current = true;
      setEditLoading(false);
      setEditError(null);
    };
    const cached = getQuote(editId);
    if (cached) {
      apply(cached);
      return () => { cancelled = true; };
    }
    setEditLoading(true);
    setEditError(null);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("quotes")
          .select("*")
          .eq("id", editId)
          .single();
        if (error) throw error;
        if (cancelled) return;
        const row = data as unknown as {
          id: string;
          ref: string;
          client_id: string | null;
          title: string;
          job_description: string | null;
          line_items: unknown;
          payment_timing: PaymentTiming | null;
          deposit_amount: number | null;
          deposit_percent: number | null;
        };
        const q = {
          id: row.id,
          ref: row.ref,
          client_id: row.client_id ?? "",
          title: row.title,
          job_description: row.job_description ?? "",
          line_items: (Array.isArray(row.line_items) ? row.line_items : []) as LineItem[],
          payment_timing: row.payment_timing ?? "on_completion",
          deposit_amount: Number(row.deposit_amount ?? 0),
          deposit_percent: Number(row.deposit_percent ?? 0),
        } as Quote;
        apply(q);
      } catch (e) {
        if (cancelled) return;
        setEditError(e instanceof Error ? e.message : "Could not load quote");
        setEditLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const handleVoiceStart = async () => {
    if (saving) return;
    closeRequestedRef.current = false;
    setVoiceError(null);
    setLastTranscript(null);
    setVoiceOpening(true);
    if (voiceParam === 1) navigate({ to: "/quotes/new", search: {}, replace: true });
    try {
      await startRecording();
    } catch (e) {
      setVoiceOpening(false);
      throw e;
    }
  };
  const handleEditByVoice = async () => {
    if (saving || recording || transcribing) return;
    feedback("tap");
    recordTargetRef.current = "edit";
    setEditVoiceOpen(true);
    closeRequestedRef.current = false;
    setVoiceError(null);
    setLastTranscript(null);
    setVoiceOpening(true);
    try {
      await startRecording();
    } catch (e) {
      setVoiceOpening(false);
      throw e;
    }
  };
  const handleVoiceClose = () => {
    closeRequestedRef.current = true;
    voiceSessionRef.current++;
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      try { mr.stop(); } catch { /* noop */ }
    }
    // Live path: close transport without a final regenerate — the user is
    // bailing out, not finishing. The stale guard in onResult drops any
    // in-flight pass.
    if (liveActiveRef.current) {
      liveActiveRef.current = false;
      setLiveActive(false);
      void live.stop({ finalize: false });
    }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    sharedStreamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current?.getTracks().forEach((t) => t.stop());
    sharedStreamRef.current = null;
    streamRef.current = null;
    // handleVoiceStart already strips ?voice=1; no need to navigate again here.
    setRecording(false);
    setTranscribing(false);
    setVoiceError(null);
    setVoiceOpening(false);
    setLastTranscript(null);
    setEditVoiceOpen(false);
    recordTargetRef.current = "desc";
  };

  const recordStartRef = useRef<number>(0);
  const MIN_RECORD_MS = 1000;

  const finaliseLiveSession = async (sessionId: number) => {
    if (!liveActiveRef.current) return;
    liveActiveRef.current = false;
    setLiveActive(false);
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    setRecording(false);
    // The hook owns the mic stream lifecycle — clear our refs so the meter
    // stops drawing immediately.
    sharedStreamRef.current = null;
    streamRef.current = null;
    setTranscribing(true);
    try {
      const { transcript, didRegenerate } = await live.stop({ finalize: true });
      if (sessionId !== voiceSessionRef.current || closeRequestedRef.current) return;
      if (!transcript) {
        setVoiceError("We didn't catch any speech. Tap the mic and describe the job out loud.");
        return;
      }
      if (didRegenerate) {
        feedback("success");
        playSample("ding");
      }
    } finally {
      setTranscribing(false);
    }
  };

  const stopRecording = () => {
    // Enforce MIN_RECORD_MS for both paths so a fat-fingered tap doesn't
    // close the session before any speech reaches the wire.
    if (liveActiveRef.current) {
      const elapsed = Date.now() - recordStartRef.current;
      const remaining = MIN_RECORD_MS - elapsed;
      if (remaining > 0) {
        setTimeout(stopRecording, remaining);
        return;
      }
      const sessionId = voiceSessionRef.current;
      void finaliseLiveSession(sessionId);
      return;
    }
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


  const appendTranscript = (text: string): { combinedDesc: string; target: "desc" | "clip" | "edit" } => {
    const clean = text.trim();
    const currentTarget = recordTargetRef.current;
    if (!clean) return { combinedDesc: desc, target: currentTarget };
    setLastTranscript(clean);
    if (currentTarget === "clip") {
      setClips((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, transcript: clean }]);
      return { combinedDesc: desc, target: "clip" };
    }
    if (currentTarget === "edit") {
      return { combinedDesc: clean, target: "edit" };
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
    try {
      const audioBase64 = await blobToBase64(blob);
      const { text } = await transcribeFn({ data: { audioBase64, mimeType } });
      const { combinedDesc, target } = appendTranscript(text);
      lastBlobRef.current = null;
      if (target === "edit") {
        await applyVoiceEdit(combinedDesc);
        return;
      }
      if (target === "desc" && mode === "speak" && combinedDesc.trim() && !draft) {
        if (subBlocked) {
          const msg = "Trial ended — add a payment method to generate quotes.";
          setVoiceError(msg);
          setError(msg);
          return;
        }
        await generate(combinedDesc);
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error
        ? err.message
        : "Could not transcribe. Check your connection and retry.";
      setVoiceError(msg);
      // Mirror to the main form error so failures aren't silent after the overlay closes.
      setError(msg);
    } finally {
      setTranscribing(false);
    }
  };

  // Authoritative finalise path: Whisper transcribes the recorded blob, then
  // we regenerate the draft from that transcript. Live tiles are preview only.
  const finaliseFromAudio = async (blob: Blob, mimeType: string, sessionId: number) => {
    setTranscribing(true);
    setVoiceError(null);
    try {
      const audioBase64 = await blobToBase64(blob);
      const { text } = await transcribeFn({ data: { audioBase64, mimeType } });
      if (sessionId !== voiceSessionRef.current || closeRequestedRef.current) return;
      const transcript = (text || "").trim();
      if (!transcript) {
        setVoiceError("We didn't catch any speech. Tap the mic and describe the job out loud.");
        return;
      }
      const g = await generateFn({ data: { description: transcript, trade, vatRegistered: vat } });
      if (sessionId !== voiceSessionRef.current || closeRequestedRef.current) return;

      // Arm the scroll BEFORE setDraft so the effect that watches `draft`
      // fires on the very next render and scrolls once the surface is mounted.
      pendingScrollToDraftRef.current = true;
      setDraft({ title: g.title, line_items: g.line_items });
      originalDraftRef.current = JSON.stringify(g.line_items);
      setDesc(g.clean_description || transcript);
      const ec = g.extracted_customer;
      if (ec?.name && !clientName.trim()) setClientName(ec.name);
      if (ec?.phone && !clientPhone.trim()) setClientPhone(ec.phone);



      feedback("success");
      playSample("ding");
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error
        ? err.message
        : "Could not finalise the recording. Check your connection and retry.";
      setVoiceError(msg);
      setError(msg);
    } finally {
      setTranscribing(false);
    }
  };

  const applyVoiceEdit = async (transcript: string) => {
    if (!draft || !transcript.trim()) return;
    try {
      // Generate from the new transcript ALONE — same shape as a fresh quote.
      // The model never sees existing items, so it cannot rewrite or re-price them.
      const g = await generateFn({ data: { description: transcript, trade, vatRegistered: vat } });

      const existing = draft.line_items;
      const existingKeys = new Set(existing.map((li) => normDesc(li.description)));

      const newOnes = (g.line_items ?? []).filter((li) => {
        const key = normDesc(li.description);
        if (existingKeys.has(key)) return false;            // dedupe vs current draft
        if (deletedDescsRef.current.has(key)) return false; // respect user deletions
        return true;
      });

      if (newOnes.length) {
        const merged = [...existing, ...newOnes];
        setDraft({ title: draft.title, line_items: merged });
        originalDraftRef.current = JSON.stringify(merged);
        // Let the seeding effect re-derive payment timing from the new total
        // (only for fresh quotes — don't auto-flip a saved quote's timing).
        if (!editId) paymentSeededRef.current = false;
        feedback("success");
        playSample("ding");
      }
      handleVoiceClose();
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Could not apply voice edit.";
      setVoiceError(msg);
      feedback("error");
    }
  };

  const retryTranscription = () => {
    const cached = lastBlobRef.current;
    if (!cached) return;
    void runTranscribe(cached.blob, cached.mimeType);
  };




  // Recording flow: MediaRecorder captures audio; on stop, Whisper transcribes
  // and the AI builds the draft from the full transcript.
  const startRecording = async () => {
    const sessionId = voiceSessionRef.current + 1;
    voiceSessionRef.current = sessionId;
    closeRequestedRef.current = false;
    setVoiceError(null);
    deletedDescsRef.current = new Set();
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Microphone not supported on this device.");
      setVoiceOpening(false);
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
      // Distinguish the failure modes so the user gets actionable guidance
      // and an obvious fall-back to typing instead of a dead screen.
      const name = (err as DOMException | undefined)?.name ?? "";
      let msg: string;
      if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
        msg = "Microphone access is blocked. Allow mic access in your browser settings, or type the job below.";
      } else if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") {
        msg = "No microphone found on this device. Type the job below instead.";
      } else {
        msg = "Couldn't start the microphone. Try again, or type the job below.";
      }
      setVoiceError(msg);
      setVoiceOpening(false);
      return;
    }
    streamRef.current = stream;
    sharedStreamRef.current = stream;

    const mimeType = pickMimeType();

    const isClipMode = recordTargetRef.current === "clip" || recordTargetRef.current === "edit";

    // LIVE PATH — desc target only. Stream the spoken job through the
    // realtime relay so tiles appear live. Clip/edit modes keep using
    // MediaRecorder + Whisper below (those flows append/merge differently).
    if (!isClipMode) {
      try {
        await live.start(stream);
      } catch (err) {
        console.error("[live] start failed", err);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        sharedStreamRef.current = null;
        const msg = err instanceof Error ? err.message : "Could not start live session.";
        setVoiceError(msg);
        setError(msg);
        setVoiceOpening(false);
        return;
      }
      if (closeRequestedRef.current || sessionId !== voiceSessionRef.current) {
        // User bailed during handshake — tear down what we just opened.
        void live.stop({ finalize: false });
        return;
      }
      liveActiveRef.current = true;
      setLiveActive(true);
      recordStartRef.current = Date.now();
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
      return;
    }


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

      // Single authoritative path: Whisper transcribes the recorded audio and
      // rebuilds the draft.
      if (blob.size < 1000) {
        setVoiceError("We didn't catch any speech. Tap the mic and describe the job out loud.");
        return;
      }
      lastBlobRef.current = { blob, mimeType: blobType };
      await finaliseFromAudio(blob, blobType, sessionId);
    };

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

  // Seed payment timing the first time a draft appears for a fresh quote
  // (editId path already seeds from the loaded quote inside `apply()`).
  useEffect(() => {
    if (!draft || editId || paymentSeededRef.current) return;
    const t = deriveTimingFromTotal(total);
    setPaymentTiming(t);
    if (t === "deposit_then_balance") {
      const p = defaultDepositPercent(userProfile.default_deposit_percent);
      const a = computeDepositAmount(subtotal, p);
      setDepositPct(p);
      setDepositAmt(a);
      setDepositPctRaw(String(p));
      setDepositAmtRaw(String(a));
    }
    paymentSeededRef.current = true;
  }, [draft, editId, subtotal, total]);

  // After a successful voice finalise, scroll the freshly committed draft into
  // view. Runs in a layout-after-paint effect so the draft surface is already
  // mounted; double-rAF guards against the voice overlay reflow.
  useEffect(() => {
    if (!draft || !pendingScrollToDraftRef.current) return;
    pendingScrollToDraftRef.current = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        draftRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }, [draft]);



  // Keep deposit amount in sync with subtotal when timing is deposit (user-edited
  // values are preserved — we only recompute from the stored percent).
  useEffect(() => {
    if (paymentTiming !== "deposit_then_balance" || !depositPct) return;
    const a = computeDepositAmount(subtotal, depositPct);
    setDepositAmt(a);
    setDepositAmtRaw(String(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, paymentTiming]);

  const onPaymentTimingChange = (next: PaymentTiming) => {
    setPaymentTiming(next);
    if (next === "deposit_then_balance") {
      const p = depositPct || defaultDepositPercent(userProfile.default_deposit_percent);
      const a = computeDepositAmount(subtotal, p);
      setDepositPct(p); setDepositAmt(a);
      setDepositPctRaw(String(p)); setDepositAmtRaw(String(a));
    } else {
      setDepositPct(0); setDepositAmt(0);
      setDepositPctRaw(""); setDepositAmtRaw("");
    }
  };
  const onDepositAmtBlur = () => {
    const parsed = parseDepositInput(depositAmtRaw);
    if (!parsed) return;
    const amt = parsed.kind === "amount" ? parsed.value : computeDepositAmount(subtotal, parsed.value);
    const pct = computeDepositPercent(subtotal, amt);
    setDepositAmt(amt); setDepositPct(pct);
    setDepositAmtRaw(String(amt)); setDepositPctRaw(String(pct));
  };
  const onDepositPctBlur = () => {
    const parsed = parseDepositInput(depositPctRaw);
    if (!parsed) return;
    const pct = Math.max(0, Math.min(100, parsed.value));
    const amt = computeDepositAmount(subtotal, pct);
    setDepositPct(pct); setDepositAmt(amt);
    setDepositPctRaw(String(pct)); setDepositAmtRaw(String(amt));
  };

  const [savingMode, setSavingMode] = useState<"draft" | "send" | null>(null);
  const saving = savingMode !== null;
  const [sendSheetOpen, setSendSheetOpen] = useState(false);
  const [savedQuote, setSavedQuote] = useState<Quote | null>(null);
  const wasSentRef = useRef(false);
  const save = async (mode: "draft" | "send" = "draft") => {
    if (!draft || saving) return null;
    setSavingMode(mode);
    setError(null);
    try {
      const q = editId
        ? await updateGeneratedQuote({
            id: editId,
            clientName: clientName.trim(),
            clientPhone: clientPhone.trim() || undefined,
            description: desc.trim(),
            title: draft.title,
            line_items: draft.line_items,
            vatRegistered: vat,
            payment_timing: paymentTiming,
            deposit_amount: paymentTiming === "deposit_then_balance" ? depositAmt : 0,
            deposit_percent: paymentTiming === "deposit_then_balance" ? depositPct : 0,
          })
        : await saveGeneratedQuote({
            clientName: clientName.trim(),
            clientPhone: clientPhone.trim() || undefined,
            description: desc.trim(),
            title: draft.title,
            line_items: draft.line_items,
            vatRegistered: vat,
            payment_timing: paymentTiming,
            deposit_amount: paymentTiming === "deposit_then_balance" ? depositAmt : 0,
            deposit_percent: paymentTiming === "deposit_then_balance" ? depositPct : 0,
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
      if (!editId && mockQuotes.length === 1) {
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
      try { await router.invalidate(); } catch { /* noop */ }
      if (mode === "send") {
        // Stay on /quotes/new and open the send sheet over it.
        setSavedQuote(q);
        wasSentRef.current = false;
        setSendSheetOpen(true);
        toast.success(editId ? "Changes saved" : "Quote saved");
      } else {
        // Save as draft: stay on /quotes/new if creating new; return to list if editing.
        if (editId) {
          toast.success("Draft updated");
          navigate({ to: "/quotes" });
        } else {
          toast.success("Saved as draft");
          navigate({ to: "/quotes" });
        }
      }
      return q;
    } catch (e) {
      feedback("error");
      const message = e instanceof Error ? e.message : "Could not save quote";
      setError(message);
      toast.error(editId ? "Could not save changes" : "Could not save quote", { description: message });
      return null;
    } finally {
      setSavingMode(null);
    }
  };

  return (
    <AppShell>
      {(editVoiceOpen || !draft) && (recording || transcribing || voicePending || voiceError || voiceOpening) && (
        <VoiceOverlay
          recording={recording}
          transcribing={transcribing}
          seconds={recordSeconds}
          error={voiceError}
          lastTranscript={lastTranscript}
          streamRef={sharedStreamRef}
          onStart={handleVoiceStart}
          onStop={stopRecording}
          onClose={handleVoiceClose}
          onTypeInstead={() => {
            handleVoiceClose();
            setShowTyping(true);
            setTimeout(() => {
              textareaRef.current?.focus();
              textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 0);
          }}
          onRetryTranscription={lastBlobRef.current ? retryTranscription : undefined}
        />
      )}

      <PageHeader title={editId ? "Edit quote" : "New quote"} subtitle="" back="/quotes" />

      {editId && editLoading && (
        <div className="px-5 mt-4">
          <div className="card-surface p-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading quote…
          </div>
        </div>
      )}
      {editId && editError && (
        <div className="px-5 mt-4">
          <div className="card-surface p-4 text-sm text-status-overdue font-medium">
            Couldn't load that quote: {editError}.{" "}
            <button
              type="button"
              onClick={() => navigate({ to: "/quotes/$quoteId", params: { quoteId: editId } })}
              className="underline font-semibold text-ink ml-1"
            >
              Go back
            </button>
          </div>
        </div>
      )}

        <form
        id="new-quote-form"
        className={`px-5 mt-4 space-y-4 ${draft ? "pb-28" : "pb-8 flex flex-col min-h-[calc(100dvh-12rem)]"}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (draft) {
            if (!clientName.trim()) {
              toast.error("Add a customer to save this quote.");
              return;
            }
            void save("send");
          } else generate();
        }}
      >

        {!draft && (
          <div className="space-y-3">
            {typeParam ? (
              <>
                {/* Type — primary entry */}
                <div className="card-surface p-4">
                  <label
                    htmlFor="quote-desc"
                    className="block text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5"
                  >
                    Describe the job
                  </label>
                  <textarea
                    id="quote-desc"
                    ref={textareaRef}
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    rows={5}
                    className="w-full rounded-2xl bg-secondary text-ink p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-lime resize-y"
                    placeholder="e.g. Build single-storey rear extension 4m x 3m — strip foundations"
                  />
                </div>

                {/* Voice — secondary */}
                <button
                  type="button"
                  onClick={handleVoiceStart}
                  className="w-full inline-flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground hover:text-ink py-2"
                >
                  <Mic className="h-3.5 w-3.5" />
                  Or speak it instead
                </button>
              </>
            ) : (
              <>
                {/* Voice — primary entry */}
                <button
                  type="button"
                  onClick={handleVoiceStart}
                  className="w-full bg-lime text-ink rounded-2xl px-5 py-5 active:scale-[0.99] transition flex items-center gap-4 text-left shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]"
                >
                  <div className="h-12 w-12 rounded-full bg-ink text-lime flex items-center justify-center shrink-0">
                    <Mic className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base leading-tight">Speak the job</p>
                    <p className="text-xs text-ink/70 mt-0.5">Describe it out loud — Quottr writes the quote.</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-ink/60 shrink-0" />
                </button>

                <RotatingPrompts className="" />

                {/* Type fallback — collapsed by default */}
                {!showTyping && !desc ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowTyping(true);
                      setTimeout(() => textareaRef.current?.focus(), 0);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground hover:text-ink py-2"
                  >
                    <Keyboard className="h-3.5 w-3.5" />
                    Or type it instead
                  </button>
                ) : (
                  <div className="card-surface p-4">
                    <label
                      htmlFor="quote-desc"
                      className="block text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5"
                    >
                      Describe the job
                    </label>
                    <textarea
                      id="quote-desc"
                      ref={textareaRef}
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      rows={5}
                      className="w-full rounded-2xl bg-secondary text-ink p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-lime resize-y"
                      placeholder="e.g. Build single-storey rear extension 4m x 3m — strip foundations"
                    />
                  </div>
                )}
              </>
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
          <div className="mt-auto pt-2 safe-bottom">
            <div className="mx-auto max-w-md space-y-2">
              {subBlocked && (
                <div className="rounded-2xl bg-paper/95 backdrop-blur border border-status-overdue/40 px-3.5 py-2.5 flex items-center gap-2.5 shadow-lg">
                  <AlertCircle className="h-4 w-4 text-status-overdue shrink-0" />
                  <p className="text-xs text-ink flex-1">Trial ended.</p>
                  <Link
                    to="/settings"
                    className="text-xs font-bold text-ink underline underline-offset-2 shrink-0"
                  >
                    Update payment
                  </Link>
                </div>
              )}

              {error && !subBlocked && (
                <div className="rounded-2xl bg-paper/95 backdrop-blur border border-status-overdue/40 px-3.5 py-2.5 flex items-start gap-2.5 shadow-lg">
                  <AlertCircle className="h-4 w-4 text-status-overdue shrink-0 mt-0.5" />
                  <p className="text-xs text-ink flex-1 break-words">{error}</p>
                </div>
              )}

              <button
                type="submit"
                form="new-quote-form"
                disabled={loading || subBlocked}
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
                {loading ? <RotatingStatus messages={QUOTE_GEN_MESSAGES} /> : error ? "Retry generate" : "Generate quote"}
              </button>
            </div>
          </div>
        )}

        {/* Editable quote preview */}
        {draft && (
          <div ref={draftRef} className="card-surface overflow-hidden scroll-mt-20">

            <div className="bg-ink text-paper p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-lime font-bold">Preview · editable</p>
                  <p className="text-[11px] text-paper/55 mt-0.5">Tap any field to edit, or use voice →</p>
                </div>
                <button
                  type="button"
                  onClick={handleEditByVoice}
                  disabled={recording || transcribing || saving}
                  className="inline-flex items-center gap-1.5 bg-lime text-ink rounded-full px-3 py-1 text-[11px] font-bold active:scale-[0.98] transition disabled:opacity-60 shrink-0"
                >
                  <Mic className="h-3 w-3" />
                  Edit by voice
                </button>
              </div>
              <p className="font-bold mt-2">{userProfile.business_name}</p>
              {userProfile.registration_number && (
                <p className="text-[10px] text-paper/60">
                  {userProfile.registration_number}
                </p>
              )}
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="mt-3 w-full bg-transparent outline-none text-2xl leading-tight font-medium placeholder:text-paper/40"
                placeholder="Quote title"
              />
            </div>
            <ul>
              {draft.line_items.map((li, i) => {
                const src = li.source ? normalizeSource(li.source, paidQuoteCount) : null;
                const showPill = src === "voice" || src === "learned";
                const isLabour = li.category === "labour" || li.category === "cis_labour";
                const unit = li.unit ?? (isLabour ? "hours" : "qty");
                const qtyLabel = unit === "hours" ? "Hrs" : unit === "days" ? "Days" : "Qty";
                const priceSuffix = unit === "hours" ? "/hr" : unit === "days" ? "/day" : "";
                const lineTotal = li.qty * li.unit_price;
                const isPriced = li.unit_price > 0;
                const isConfirmingTrash = confirmTrashIdx === i;
                return (
                  <li
                    key={i}
                    className="px-4 py-3 border-t border-border first:border-t-0 space-y-2 group"
                  >
                    {showPill && (
                      <span
                        className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          src === "voice" ? "bg-lime/30 text-ink" : "bg-lime/15 text-ink"
                        }`}
                      >
                        {src === "voice" ? "Your price" : "Your usual price"}
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
                          if (isPriced && !isConfirmingTrash) {
                            setConfirmTrashIdx(i);
                            setTimeout(() => setConfirmTrashIdx((v) => (v === i ? null : v)), 3000);
                            return;
                          }
                          setConfirmTrashIdx(null);
                          const next = draft.line_items.filter((_, idx) => idx !== i);
                          setDraft({ ...draft, line_items: next.length ? next : [{ description: "", qty: 1, unit_price: 0 }] });
                        }}
                        className={`p-1 -mr-1 shrink-0 transition-opacity ${
                          isConfirmingTrash
                            ? "text-status-overdue opacity-100"
                            : "text-muted-foreground/40 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-status-overdue"
                        }`}
                        aria-label={isConfirmingTrash ? "Tap again to remove" : "Remove line item"}
                        title={isConfirmingTrash ? "Tap again to remove" : undefined}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {isConfirmingTrash && (
                      <p className="text-[11px] text-status-overdue font-medium">Tap trash again to remove this priced line.</p>
                    )}
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
                      <p className="num text-sm ml-auto font-semibold w-full text-right sm:w-auto">{formatGBP(lineTotal)}</p>
                    </div>
                  </li>
                );
              })}
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

        {/* Customer — gates save, surfaced before payment */}
        {draft && (
          <div ref={customerRef} className="space-y-3 scroll-mt-20">
            <div>
              <h3 className="text-lg font-bold">Customer</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Assign a customer so we know where this quote is going.
              </p>
            </div>

            {lastCustomer && !clientName && (
              <button
                type="button"
                onClick={() => {
                  setCustomerMode("existing");
                  setClientName(lastCustomer.name);
                  setClientPhone(lastCustomer.phone ?? "");
                }}
                className="w-full rounded-2xl py-3 px-4 flex items-center gap-3 bg-lime/15 border border-lime/40 active:scale-[0.99] transition text-left"
              >
                <div className="h-9 w-9 rounded-full bg-lime/30 flex items-center justify-center text-ink font-bold text-xs shrink-0">
                  {lastCustomer.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Same as last</p>
                  <p className="text-sm font-bold text-ink truncate">{lastCustomer.name}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-ink/60 shrink-0" />
              </button>
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
              <div className="card-surface overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="w-full p-4 flex items-center gap-3 text-left active:scale-[0.99] transition"
                >
                  <div className="h-9 w-9 rounded-full bg-lime/30 flex items-center justify-center text-ink font-bold text-xs shrink-0">
                    {clientName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Customer · tap to change</p>
                    <p className="text-sm font-semibold truncate mt-0.5">{clientName}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
                <div className="px-4 pb-4 pt-1 border-t border-border">
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

        {/* Payment — after customer */}
        {draft && (
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-bold">Payment</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {paymentTimingLabel({ timing: paymentTiming, total, depositAmount: depositAmt, depositPercent: depositPct })}
              </p>
            </div>
            <div className="card-surface p-2 space-y-1.5">
              <PaymentMethodOption
                active={paymentTiming === "on_completion"}
                icon={Check}
                label="On completion"
                sub="Customer pays after work is done"
                onClick={() => onPaymentTimingChange("on_completion")}
              />
              <PaymentMethodOption
                active={paymentTiming === "deposit_then_balance"}
                icon={Banknote}
                label="Deposit then balance"
                sub="Take a deposit up front, balance on completion"
                onClick={() => onPaymentTimingChange("deposit_then_balance")}
              />
              <PaymentMethodOption
                active={paymentTiming === "upfront"}
                icon={Zap}
                label="Upfront"
                sub="Full payment before work starts"
                onClick={() => onPaymentTimingChange("upfront")}
              />
            </div>
            {paymentTiming === "deposit_then_balance" && (
              <div className="card-surface p-4 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Deposit</p>
                <div className="flex items-center gap-2">
                  <label className="flex items-center bg-secondary rounded-2xl px-3 py-2.5 gap-1.5 flex-1">
                    <span className="text-ink/60 font-bold">£</span>
                    <input
                      type="text" inputMode="decimal"
                      value={depositAmtRaw}
                      onChange={(e) => setDepositAmtRaw(e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      onBlur={onDepositAmtBlur}
                      placeholder="0.00"
                      className="flex-1 min-w-0 bg-transparent text-sm font-semibold num outline-none"
                    />
                  </label>
                  <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <label className="flex items-center bg-secondary rounded-2xl px-3 py-2.5 gap-1.5 flex-1">
                    <input
                      type="text" inputMode="decimal"
                      value={depositPctRaw}
                      onChange={(e) => setDepositPctRaw(e.target.value)}
                      onFocus={(e) => e.currentTarget.select()}
                      onBlur={onDepositPctBlur}
                      placeholder="0"
                      className="flex-1 min-w-0 bg-transparent text-sm font-semibold num outline-none text-right"
                    />
                    <span className="text-ink/60 font-bold">%</span>
                  </label>
                </div>
                <p className="text-[11px] text-muted-foreground">£ and % stay in sync.</p>
              </div>
            )}
          </div>
        )}
      </form>

      {/* Sticky save bar (draft state) */}
      {draft && (
        <div className="fixed bottom-0 inset-x-0 z-30 px-3 pb-3 safe-bottom pointer-events-none">
          <div className="mx-auto max-w-md pointer-events-auto space-y-2">
            {error && (
              <div className="rounded-2xl bg-paper/95 backdrop-blur border border-status-overdue/40 px-3.5 py-2.5 shadow-lg space-y-1.5">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-status-overdue shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-ink">Couldn't save quote</p>
                    <p className="text-[11px] text-muted-foreground break-words mt-0.5">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {draft && (draft.line_items.length === 0 || total <= 0) && clientName.trim() && (
              <div className="mb-2 rounded-2xl bg-paper/95 backdrop-blur shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25)] px-3 py-2">
                <p className="text-xs font-semibold text-ink">Add at least one item before sending.</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Quotes need a non-zero total.</p>
              </div>
            )}

            <div className="rounded-full bg-paper/95 backdrop-blur shadow-[0_12px_32px_-8px_rgba(0,0,0,0.35)] p-1.5 flex items-center gap-1.5">
              
              <button
                type="button"
                onClick={() => { void save("draft"); }}
                onPointerDown={() => feedback("tap")}
                disabled={!clientName.trim() || (draft?.line_items.length ?? 0) === 0 || total <= 0 || saving}
                className="px-4 py-3 rounded-full text-ink font-bold text-xs inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/5 transition"
              >
                {savingMode === "draft" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {editId ? "Save" : "Draft"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!clientName.trim()) {
                    customerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                    return;
                  }
                  if ((draft?.line_items.length ?? 0) === 0 || total <= 0) {
                    return;
                  }
                  void save("send");
                }}
                onPointerDown={() => feedback("tap")}
                disabled={saving || (draft?.line_items.length ?? 0) === 0 || total <= 0}
                className={`flex-1 rounded-full py-3 font-bold inline-flex items-center justify-center gap-2 text-sm transition ${
                  !clientName.trim() || (draft?.line_items.length ?? 0) === 0 || total <= 0
                    ? "bg-ink/10 text-muted-foreground"
                    : "bg-lime text-ink active:scale-[0.99]"
                } disabled:opacity-60`}
              >
                {savingMode === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {!clientName.trim()
                  ? "Add a customer ↑"
                  : (draft?.line_items.length ?? 0) === 0 || total <= 0
                  ? "Add an item ↓"
                  : "Save & send"}
              </button>
            </div>

          </div>
        </div>
      )}

      {savedQuote && (
        <SendQuoteDialog
          open={sendSheetOpen}
          onClose={() => {
            setSendSheetOpen(false);
            const id = savedQuote.id;
            const sent = wasSentRef.current;
            setSavedQuote(null);
            if (sent) {
              navigate({ to: "/quotes/$quoteId", params: { quoteId: id }, search: { sent: 1 } as never });
            } else {
              navigate({ to: "/quotes/$quoteId", params: { quoteId: id } });
            }
          }}
          onSent={() => { wasSentRef.current = true; }}
          onUndo={() => { wasSentRef.current = false; }}
          quoteId={savedQuote.id}
          quoteRef={savedQuote.ref ?? ""}
          quoteTitle={savedQuote.title}
          customerName={getClient(savedQuote.client_id)?.name}
          customerPhone={getClient(savedQuote.client_id)?.phone}
        />
      )}
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

function PaymentMethodOption({
  active, onClick, icon: Icon, label, sub,
}: { active: boolean; onClick: () => void; icon: ComponentType<{ className?: string }>; label: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl p-3 flex items-center gap-3 transition ${active ? "bg-lime text-ink" : "bg-transparent hover:bg-secondary"}`}
    >
      <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${active ? "bg-ink text-lime" : "bg-secondary text-ink"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">{label}</p>
        <p className={`text-[11px] truncate ${active ? "text-ink/70" : "text-muted-foreground"}`}>{sub}</p>
      </div>
      {active && <Check className="h-4 w-4 shrink-0" />}
    </button>
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

/**
 * MicLevelBars — 5-bar volume meter driven by the recording stream's RMS.
 * Used as the "Listening…" cue. Visual only — the parent's aria-live region
 * carries the announcement; bars are aria-hidden.
 *
 * On iOS, AudioContext must be created/resumed inside a user gesture. The
 * parent's startRecording is gesture-initiated, so the stream is already
 * primed by the time this mounts.
 */
function MicLevelBars({
  streamRef,
  active,
}: {
  streamRef?: React.RefObject<MediaStream | null>;
  active: boolean;
}) {
  const barRefs = [
    useRef<HTMLSpanElement | null>(null),
    useRef<HTMLSpanElement | null>(null),
    useRef<HTMLSpanElement | null>(null),
    useRef<HTMLSpanElement | null>(null),
    useRef<HTMLSpanElement | null>(null),
  ];
  const levelRef = useRef(0);
  const thresholds = [0.05, 0.12, 0.22, 0.35, 0.5];

  useEffect(() => {
    if (!active) return;
    const stream = streamRef?.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AC: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext;
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let data: Uint8Array | null = null;
    let raf = 0;
    let stopped = false;

    if (stream && AC) {
      try {
        ctx = new AC();
        // iOS sometimes starts contexts suspended even from a gesture chain.
        if (ctx.state === "suspended") { void ctx.resume().catch(() => { /* noop */ }); }
        source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      } catch {
        ctx = null;
        analyser = null;
      }
    }

    // Peak-hold: when a bar lights, keep it lit for HOLD_MS so the meter
    // doesn't strobe between syllables. Analyser already smooths at 0.6.
    const HOLD_MS = 220;
    const holdUntil = [0, 0, 0, 0, 0];

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
        const target = Math.min(1, rms * 4);
        levelRef.current += (target - levelRef.current) * 0.3;
        level = levelRef.current;
      }
      const now = performance.now();
      for (let i = 0; i < barRefs.length; i++) {
        const el = barRefs[i].current;
        if (!el) continue;
        const meets = level >= thresholds[i];
        if (meets) holdUntil[i] = now + HOLD_MS;
        const lit = meets || now < holdUntil[i];
        el.style.backgroundColor = lit ? "rgb(190 242 100)" /* lime */ : "rgba(245,245,245,0.18)";
        const scale = lit ? 1 + Math.min(0.6, (Math.max(level, thresholds[i]) - thresholds[i]) * 1.6) : 0.55;
        el.style.transform = `scaleY(${scale.toFixed(3)})`;
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
      for (const r of barRefs) {
        if (r.current) {
          r.current.style.backgroundColor = "rgba(245,245,245,0.18)";
          r.current.style.transform = "scaleY(0.55)";
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, streamRef]);

  return (
    <span className="inline-flex items-end gap-[3px] h-3" aria-hidden="true">
      {barRefs.map((ref, i) => (
        <span
          key={i}
          ref={ref}
          className="block w-[3px] h-3 rounded-full origin-bottom transition-colors duration-100 will-change-transform"
          style={{ backgroundColor: "rgba(245,245,245,0.18)", transform: "scaleY(0.55)" }}
        />
      ))}
    </span>
  );
}

function VoiceOverlay({
  recording,
  transcribing,
  seconds,
  error,
  lastTranscript,
  streamRef,
  onStart,
  onStop,
  onClose,
  onTypeInstead,
  onRetryTranscription,
}: {
  recording: boolean;
  transcribing: boolean;
  seconds: number;
  error: string | null;
  lastTranscript: string | null;
  streamRef?: React.RefObject<MediaStream | null>;
  onStart: () => void;
  onStop: () => void;
  onClose: () => void;
  onTypeInstead?: () => void;
  onRetryTranscription?: () => void;
}) {
  if (typeof document === "undefined") return null;
  const idle = !recording && !transcribing;
  const isBuilding = transcribing;

  // aria-live status — announces transitions (Listening / Processing / Stopped
  // / error) without firing on every render. Visually hidden.
  const announcement = error
    ? `Microphone error. ${error}`
    : isBuilding
      ? "Processing your quote"
      : recording
        ? "Listening"
        : "Stopped";

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-ink text-paper flex flex-col px-6 pt-12 pb-8 safe-top safe-bottom items-center justify-between overflow-hidden">
      {/* Visually hidden aria-live region for screen readers. */}
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </span>

      {/* Off-centre breathing lime glow blob — depth behind the dark surface. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-24 h-[420px] w-[420px] rounded-full bg-lime/15 blur-[130px] animate-[pulse_4s_ease-in-out_infinite]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-20 h-[360px] w-[360px] rounded-full bg-lime/10 blur-[130px] animate-[pulse_5s_ease-in-out_infinite]"
      />

      {/* TOP KICKER */}
      <div className="relative flex flex-col items-center w-full max-w-md mx-auto">
        <p className="text-[10px] uppercase tracking-widest text-lime font-semibold">
          {isBuilding ? "Building your quote" : recording ? "Listening" : error ? "Try again" : "Tap to speak"}
        </p>
      </div>

      {/* CENTRE — hero mic while recording, skeleton while building */}
      <div className="relative flex-1 w-full max-w-md mx-auto flex flex-col items-center justify-center">
        {!isBuilding && (
          <>
            <button
              type="button"
              onClick={idle ? onStart : onStop}
              aria-label={recording ? "Stop recording" : "Start recording"}
              className="relative flex items-center justify-center"
            >
              {recording && (
                <MicLevelRings streamRef={streamRef} active={recording} size="lg" />
              )}
              <div
                className={`relative h-36 w-36 rounded-full bg-lime flex items-center justify-center shadow-[0_20px_60px_-12px_rgba(200,224,74,0.7)] transition-all ${
                  recording ? "animate-[pulse_1.4s_ease-in-out_infinite]" : ""
                }`}
              >
                {recording ? (
                  <Square className="h-14 w-14 text-ink fill-ink" strokeWidth={2.25} />
                ) : (
                  <VoiceWaveform size={56} className="text-ink" />
                )}
              </div>
            </button>

            {recording && (
              <>
                <div
                  className="mt-6 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <MicLevelBars streamRef={streamRef} active={recording} />
                </div>
                <p className="num text-sm mt-3 text-paper/50">
                  <span className="text-lime">●</span> {formatMMSS(seconds)}
                </p>
                <p className="mt-4 text-xs uppercase tracking-widest text-paper/60 font-semibold">
                  Listening…
                </p>
              </>
            )}
          </>
        )}

        {isBuilding && (
          <div className="w-full flex flex-col items-center gap-5">
            {/* progress shimmer bar */}
            <span className="relative w-40 h-1 overflow-hidden rounded-full bg-paper/[0.08]">
              <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-lime/70 to-transparent bg-[length:200%_100%]" />
            </span>

            {/* skeleton line-item rows */}
            <ul className="w-full space-y-2 px-1">
              {[0, 1, 2, 3].map((i) => (
                <li
                  key={i}
                  className="rounded-lg bg-paper/[0.06] border-l-2 border-lime pl-3 pr-3 py-3 flex items-center gap-3"
                  style={{
                    animation: "scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
                    animationDelay: `${i * 120}ms`,
                  }}
                >
                  <span
                    className="relative flex-1 h-3 overflow-hidden rounded-md bg-paper/[0.06]"
                  >
                    <span
                      className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-paper/25 to-transparent bg-[length:200%_100%]"
                      style={{ animationDelay: `${i * 120}ms` }}
                    />
                  </span>
                  <span
                    className="relative h-3 w-16 overflow-hidden rounded-md bg-paper/[0.06]"
                  >
                    <span
                      className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-lime/40 to-transparent bg-[length:200%_100%]"
                      style={{ animationDelay: `${i * 120 + 60}ms` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Bottom text area — error / hint / lastTranscript */}
      <div className="relative w-full max-w-md min-h-[4rem] text-center space-y-2">
        {error ? (
          <>
            <p className="text-sm text-status-overdue font-medium">{error}</p>
            <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
              {onRetryTranscription && (
                <button
                  type="button"
                  onClick={onRetryTranscription}
                  className="inline-flex items-center gap-1.5 bg-lime text-ink rounded-full px-4 py-2 text-xs font-bold active:scale-[0.99]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry without re-recording
                </button>
              )}
              {onTypeInstead && (
                <button
                  type="button"
                  onClick={onTypeInstead}
                  className="inline-flex items-center gap-1.5 bg-paper/10 text-paper rounded-full px-4 py-2 text-xs font-bold active:scale-[0.99] border border-paper/20"
                >
                  Type the quote instead
                </button>
              )}
            </div>
          </>
        ) : isBuilding ? (
          <p className="text-sm text-paper/70">Hang tight — shaping your quote…</p>
        ) : recording ? (
          <p className="text-sm text-paper/70">
            Keep talking — describe the job, materials, time. Tap the mic when done.
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
          className="relative text-xs uppercase tracking-widest text-paper/60 font-semibold py-3"
        >
          {error || lastTranscript ? "Done" : "Cancel"}
        </button>
      )}
      {!idle && <div className="h-12" />}
    </div>,
    document.body,
  );
}


