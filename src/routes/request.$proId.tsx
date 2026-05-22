import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getProPublicInfo, createQuoteRequest } from "@/lib/quote-requests.functions";
import { transcribeAudio } from "@/lib/transcribe.functions";
import { useSession, signInWithPassword, signUpWithPassword } from "@/lib/auth";
import { QuottrLogo } from "@/components/QuottrLogo";
import { Loader2, Mic, Square, Send, CheckCircle2, Hammer } from "lucide-react";
import { IOSStandaloneRecordingNotice } from "@/components/IOSStandaloneRecordingNotice";

export const Route = createFileRoute("/request/$proId")({
  component: RequestPage,
});

function RequestPage() {
  const { proId } = Route.useParams();
  const fetchPro = useServerFn(getProPublicInfo);
  const submit = useServerFn(createQuoteRequest);
  const { session, loading: sessionLoading } = useSession();

  const [pro, setPro] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPro({ data: { proId } })
      .then((r) => setPro(r.profile))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load"))
      .finally(() => setLoading(false));
  }, [proId, fetchPro]);

  // form state
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [body, setBody] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await submit({
        data: {
          proId,
          body: body.trim(),
          source: mode,
          customerPhone: phone.trim() || undefined,
        },
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (loading || sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !pro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper px-6 text-center">
        <div>
          <h1 className="text-2xl mb-2">Link not valid</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-paper flex flex-col">
        <Header pro={pro} />
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <div>
            <CheckCircle2 className="h-12 w-12 mx-auto text-lime" />
            <h1 className="text-2xl mt-4">Request sent</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
              {pro?.business_name ?? "The tradesperson"} has been notified and will get back to you shortly.
            </p>
            <Link
              to="/"
              className="inline-block mt-6 rounded-full bg-ink text-paper px-5 py-3 text-sm font-semibold"
            >
              Done
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <CustomerAuth pro={pro} />;
  }

  return (
    <div className="min-h-screen bg-paper pb-32">
      <Header pro={pro} />

      <section className="px-5 mt-5">
        <h1 className="text-2xl leading-tight">Request a quote</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tell {pro?.business_name ?? "them"} about the job — they'll reply with a quote.
        </p>
      </section>

      <section className="px-5 mt-4">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <ModeBtn active={mode === "text"} onClick={() => setMode("text")} label="Type" />
          <ModeBtn active={mode === "voice"} onClick={() => setMode("voice")} label="Voice" icon />
        </div>

        {mode === "text" ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="e.g. Leaking radiator in upstairs bedroom, water dripping from the valve. Looking for a fix asap."
            className="w-full min-h-[160px] bg-white rounded-2xl border border-border p-4 text-sm outline-none focus:border-ink/40"
          />
        ) : (
          <VoiceRecorder onTranscript={(t) => setBody((prev) => (prev ? prev + " " : "") + t)} />
        )}

        {mode === "voice" && body && (
          <div className="mt-3 card-surface p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Transcript</p>
            <p className="text-sm mt-1 whitespace-pre-wrap">{body}</p>
            <button onClick={() => setBody("")} className="mt-2 text-xs text-muted-foreground underline">
              Clear
            </button>
          </div>
        )}

        <div className="mt-4">
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Your phone (optional)
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07…"
              className="mt-1.5 w-full bg-white border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-ink/40"
            />
          </label>
        </div>

        {error && <p className="text-xs text-status-overdue font-medium mt-3">{error}</p>}
      </section>

      <div className="fixed inset-x-0 bottom-0 bg-paper border-t border-border p-4 safe-bottom">
        <div className="max-w-md mx-auto">
          <button
            onClick={send}
            disabled={sending || !body.trim()}
            className="w-full bg-lime text-ink rounded-full py-4 font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send request
          </button>
        </div>
      </div>
    </div>
  );
}

function Header({ pro }: { pro: any }) {
  return (
    <header className="bg-ink text-paper px-5 pt-6 pb-5 flex items-center gap-3">
      <QuottrLogo className="h-7 w-auto" />
      <div className="h-6 w-px bg-paper/20" />
      <div className="min-w-0 flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-lime/30 flex items-center justify-center shrink-0">
          <Hammer className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate">{pro?.business_name ?? pro?.full_name ?? "Tradesperson"}</p>
          {pro?.trade_type && <p className="text-[10px] text-paper/60 truncate">{pro.trade_type}{pro.town ? ` · ${pro.town}` : ""}</p>}
        </div>
      </div>
    </header>
  );
}

function ModeBtn({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 ${active ? "bg-ink text-paper" : "bg-white border border-border text-ink"}`}
    >
      {icon && <Mic className="h-4 w-4" />} {label}
    </button>
  );
}

function VoiceRecorder({ onTranscript }: { onTranscript: (t: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const transcribe = useServerFn(transcribeAudio);

  const start = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const candidates = ["audio/webm", "audio/mp4", "audio/ogg"];
      const mimeType = candidates.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(t));
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || mimeType || "audio/webm" });
        setProcessing(true);
        try {
          const buf = await blob.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
          const r = await transcribe({ data: { audioBase64: b64, mimeType: blob.type } });
          onTranscript(r.text);
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Transcription failed");
        } finally {
          setProcessing(false);
        }
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Microphone access denied");
    }
  };


  const stop = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="card-surface p-6 flex flex-col items-center">
      <button
        onClick={recording ? stop : start}
        disabled={processing}
        className={`h-20 w-20 rounded-full inline-flex items-center justify-center text-paper ${recording ? "bg-status-overdue animate-pulse" : "bg-ink"} disabled:opacity-50`}
      >
        {processing ? <Loader2 className="h-7 w-7 animate-spin" /> : recording ? <Square className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
      </button>
      <p className="text-xs text-muted-foreground mt-3">
        {processing ? "Transcribing…" : recording ? "Tap to stop" : "Tap to record"}
      </p>
      {err && <p className="text-xs text-status-overdue mt-2">{err}</p>}
    </div>
  );
}

function CustomerAuth({ pro }: { pro: any }) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null); setInfo(null);
    try {
      if (mode === "signup") {
        await signUpWithPassword(email, password, name);
        await signInWithPassword(email, password).catch(() => {
          setInfo("Account created — please sign in.");
          setMode("login");
        });
      } else {
        await signInWithPassword(email, password);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <Header pro={pro} />
      <div className="px-5 mt-6 flex-1">
        <h1 className="text-2xl">Send a request to {pro?.business_name ?? "this tradesperson"}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "signup" ? "Create a free account to send your request and track replies." : "Sign in to send your request."}
        </p>

        <form onSubmit={submit} className="space-y-3 mt-6">
          {mode === "signup" && (
            <Field label="Your name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sarah" />
          )}
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />

          {err && <p className="text-xs text-status-overdue font-medium">{err}</p>}
          {info && <p className="text-xs text-lime font-medium">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-lime text-ink rounded-full py-4 font-bold mt-2 disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "signup" ? "Create account & continue" : "Sign in & continue"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setErr(null); setInfo(null); }}
          className="mt-5 text-sm text-muted-foreground text-center w-full"
        >
          {mode === "signup" ? "Have an account? " : "New here? "}
          <span className="text-ink font-semibold underline">
            {mode === "signup" ? "Sign in" : "Create account"}
          </span>
        </button>
      </div>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      <input
        {...props}
        className="mt-1.5 w-full bg-white border border-border rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-ink/40"
      />
    </label>
  );
}
