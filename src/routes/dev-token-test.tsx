import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  createRealtimeTranscriptionToken,
  connectRealtimeCall,
} from "@/lib/realtime-token.functions";
import { generateAIQuote, type AIGeneratedQuote } from "@/lib/ai-quote.functions";

type Tile = AIGeneratedQuote["line_items"][number];

export const Route = createFileRoute("/dev-token-test")({
  component: DevTokenTest,
});

type HarnessStatus =
  | "idle"
  | "minting"
  | "requesting mic"
  | "connecting"
  | "listening"
  | "error"
  | "stopped";

function waitForIceComplete(pc: RTCPeerConnection, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const timer = setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    }, timeoutMs);
    function onChange() {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", onChange);
        resolve();
      }
    }
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

function DevTokenTest() {
  // ---- Stage 1: mint button ------------------------------------------------
  const mint = useServerFn(createRealtimeTranscriptionToken);
  const [mintResult, setMintResult] = useState<{ token?: string; expiresAt?: unknown } | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintLoading, setMintLoading] = useState(false);

  async function runMint() {
    setMintLoading(true);
    setMintError(null);
    setMintResult(null);
    try {
      const r = await mint();
      setMintResult(r);
      console.log("[dev-token-test] mint", r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMintError(msg);
      console.error("[dev-token-test] mint error", e);
    } finally {
      setMintLoading(false);
    }
  }

  const expiresInSec =
    typeof mintResult?.expiresAt === "number"
      ? Math.max(0, mintResult.expiresAt - Math.floor(Date.now() / 1000))
      : null;

  // ---- Stage 2b: live transcript harness -----------------------------------
  const connect = useServerFn(connectRealtimeCall);
  const generate = useServerFn(generateAIQuote);

  const [status, setStatus] = useState<HarnessStatus>("idle");
  const [committed, setCommitted] = useState("");
  const [interim, setInterim] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Stage 3: live tiles
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [updating, setUpdating] = useState(false);
  const committedRef = useRef("");
  const regenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const staleRef = useRef(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const seenItemIdsRef = useRef<Set<string>>(new Set());

  async function runRegenerate() {
    const text = committedRef.current.trim();
    if (!text) return;
    if (inFlightRef.current) {
      staleRef.current = true;
      return;
    }
    inFlightRef.current = true;
    staleRef.current = false;
    setUpdating(true);
    console.log("[tiles] regenerate fired; transcript:", text);
    try {
      const result = await generate({
        data: { description: text, trade: "Plumber", vatRegistered: false },
      });
      console.log("[tiles] returned items:", result.line_items.length, result);
      setTiles(result.line_items);
    } catch (e) {
      console.error("[tiles] regenerate failed", e);
      const msg = e instanceof Error ? e.message : String(e);
      setErrors((xs) => [...xs, `regenerate: ${msg}`]);
    } finally {
      inFlightRef.current = false;
      setUpdating(false);
      if (staleRef.current) {
        staleRef.current = false;
        // run once more to capture latest transcript
        runRegenerate();
      }
    }
  }

  function scheduleRegenerate() {
    if (regenTimerRef.current) clearTimeout(regenTimerRef.current);
    regenTimerRef.current = setTimeout(() => {
      regenTimerRef.current = null;
      runRegenerate();
    }, 1200);
  }

  function teardown(nextStatus: HarnessStatus = "stopped") {
    if (regenTimerRef.current) {
      clearTimeout(regenTimerRef.current);
      regenTimerRef.current = null;
    }
    staleRef.current = false;
    try {
      channelRef.current?.close();
    } catch {}
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      pcRef.current?.close();
    } catch {}
    channelRef.current = null;
    streamRef.current = null;
    pcRef.current = null;
    setSpeaking(false);
    setInterim("");
    setUpdating(false);
    setStatus(nextStatus);
  }

  // Release mic if the user navigates away mid-session.
  useEffect(() => {
    return () => {
      try {
        channelRef.current?.close();
      } catch {}
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
      try {
        pcRef.current?.close();
      } catch {}
    };
  }, []);

  async function start() {
    if (status !== "idle" && status !== "stopped" && status !== "error") return;
    setErrors([]);
    setCommitted("");
    setInterim("");
    seenItemIdsRef.current = new Set();
    setStatus("minting");

    let token: string;
    try {
      const r = await mint();
      if (!r?.token) throw new Error("Mint returned no token.");
      token = r.token;
      console.log("[harness] minted token, expiresAt:", r.expiresAt);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrors((xs) => [...xs, `mint: ${msg}`]);
      console.error("[harness] mint failed", e);
      setStatus("error");
      return;
    }

    setStatus("requesting mic");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrors((xs) => [...xs, `mic: ${msg}`]);
      console.error("[harness] getUserMedia failed", e);
      setStatus("error");
      return;
    }

    setStatus("connecting");
    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    pc.addEventListener("connectionstatechange", () => {
      console.log("[harness] pc.connectionState:", pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setErrors((xs) => [...xs, `peer connection: ${pc.connectionState}`]);
        setStatus("error");
      }
    });

    for (const track of stream.getAudioTracks()) {
      pc.addTrack(track, stream);
    }

    const channel = pc.createDataChannel("oai-events");
    channelRef.current = channel;

    channel.addEventListener("open", () => {
      console.log("[harness] data channel open");
      setStatus("listening");
    });
    channel.addEventListener("close", () => {
      console.log("[harness] data channel closed");
    });
    channel.addEventListener("error", (e) => {
      console.error("[harness] data channel error", e);
      setErrors((xs) => [...xs, "data channel error"]);
    });
    channel.addEventListener("message", (e) => {
      let evt: any;
      try {
        evt = JSON.parse(e.data);
      } catch (err) {
        console.warn("[oai] non-JSON message", e.data);
        return;
      }
      console.log("[oai]", evt.type, evt);
      switch (evt.type) {
        case "conversation.item.input_audio_transcription.delta": {
          const d = typeof evt.delta === "string" ? evt.delta : "";
          if (d) setInterim((prev) => prev + d);
          break;
        }
        case "conversation.item.input_audio_transcription.completed": {
          const id = String(evt.item_id ?? "");
          if (id && seenItemIdsRef.current.has(id)) break;
          if (id) seenItemIdsRef.current.add(id);
          const text = typeof evt.transcript === "string" ? evt.transcript : "";
          if (text) setCommitted((prev) => (prev ? prev + " " : "") + text.trim());
          setInterim("");
          break;
        }
        case "input_audio_buffer.speech_started":
          setSpeaking(true);
          break;
        case "input_audio_buffer.speech_stopped":
          setSpeaking(false);
          break;
        default:
          if (typeof evt.type === "string" && evt.type.startsWith("error")) {
            const msg = evt?.error?.message ?? evt?.message ?? evt.type;
            console.error("[oai error]", evt);
            setErrors((xs) => [...xs, `oai: ${msg}`]);
          }
      }
    });

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceComplete(pc);
      const sdp = pc.localDescription?.sdp;
      if (!sdp) throw new Error("Missing local SDP after ICE gathering.");

      const { answer } = await connect({ data: { sdp, ephemeralToken: token } });
      if (!answer) throw new Error("Empty SDP answer from relay.");

      await pc.setRemoteDescription({ type: "answer", sdp: answer });
      console.log("[harness] setRemoteDescription complete");
      // Status flips to "listening" on data-channel open.
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrors((xs) => [...xs, `sdp: ${msg}`]);
      console.error("[harness] sdp exchange failed", e);
      teardown("error");
    }
  }

  function stop() {
    console.log("[harness] stop requested");
    teardown("stopped");
  }

  const dotColor =
    status === "listening" ? "#22c55e" : status === "error" ? "#ef4444" : "#9ca3af";

  return (
    <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>Realtime token test (DEV ONLY)</h1>
      <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 16 }}>
        Sign in with a trialing/active account. Delete this route before launch.
      </p>

      {/* ---- Stage 1: mint ---- */}
      <h2 style={{ fontSize: 14, margin: "16px 0 8px" }}>Stage 1 — mint ephemeral token</h2>
      <button
        onClick={runMint}
        disabled={mintLoading}
        style={{
          padding: "10px 16px",
          background: "#c4f432",
          border: "none",
          borderRadius: 8,
          fontWeight: 600,
          cursor: mintLoading ? "wait" : "pointer",
        }}
      >
        {mintLoading ? "Minting…" : "Mint ephemeral token"}
      </button>

      {mintError && (
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            background: "#fee",
            border: "1px solid #f99",
            borderRadius: 8,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            fontSize: 12,
            color: "#900",
          }}
        >
          {mintError}
        </pre>
      )}

      {mintResult && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>token</div>
          <pre
            style={{
              padding: 12,
              background: "#f3f3f3",
              borderRadius: 8,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              fontSize: 12,
            }}
          >
            {mintResult.token ?? "(missing)"}
          </pre>
          <div style={{ fontSize: 12, opacity: 0.7, margin: "12px 0 4px" }}>expiresAt</div>
          <pre style={{ padding: 12, background: "#f3f3f3", borderRadius: 8, fontSize: 12 }}>
            {String(mintResult.expiresAt)}
            {expiresInSec !== null ? `  (${expiresInSec}s from now)` : ""}
          </pre>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
            starts with <code>ek_</code>?{" "}
            <strong>{mintResult.token?.startsWith("ek_") ? "yes ✓" : "no"}</strong>
          </div>
        </div>
      )}

      {/* ---- Stage 2b: live transcript ---- */}
      <hr style={{ margin: "32px 0", border: "none", borderTop: "1px solid #ddd" }} />
      <h2 style={{ fontSize: 14, margin: "0 0 8px" }}>Stage 2b — live transcript harness</h2>
      <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
        Tap Start, allow mic, speak. Greyed text streams as you talk; black text commits on
        pauses. Full event stream logs to the console.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={start}
          disabled={
            status === "minting" ||
            status === "requesting mic" ||
            status === "connecting" ||
            status === "listening"
          }
          style={{
            padding: "10px 16px",
            background: "#c4f432",
            border: "none",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Start listening
        </button>
        <button
          onClick={stop}
          disabled={status === "idle" || status === "stopped"}
          style={{
            padding: "10px 16px",
            background: "#eee",
            border: "1px solid #ccc",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Stop
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 13 }}>
        <span
          style={{
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: 999,
            background: dotColor,
          }}
        />
        <span>
          {status}
          {speaking ? " · speaking…" : ""}
        </span>
      </div>

      <div
        style={{
          padding: 14,
          minHeight: 120,
          background: "#fafafa",
          border: "1px solid #ddd",
          borderRadius: 8,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: 16,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        <span>{committed}</span>
        {committed && interim ? " " : ""}
        <span style={{ opacity: 0.55, fontStyle: "italic" }}>{interim}</span>
        {!committed && !interim && (
          <span style={{ opacity: 0.4 }}>— transcript will appear here —</span>
        )}
      </div>

      {errors.length > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#fee",
            border: "1px solid #f99",
            borderRadius: 8,
            fontSize: 12,
            color: "#900",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>errors</div>
          <ul style={{ paddingLeft: 16, listStyle: "disc" }}>
            {errors.map((m, i) => (
              <li key={i} style={{ wordBreak: "break-word" }}>
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
