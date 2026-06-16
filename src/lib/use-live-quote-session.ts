import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  createRealtimeTranscriptionToken,
  connectRealtimeCall,
} from "@/lib/realtime-token.functions";
import { generateAIQuote, type AIGeneratedQuote } from "@/lib/ai-quote.functions";

/**
 * Live realtime-transcription session that streams the spoken job into
 * generateAIQuote on every speech pause, ported verbatim from the
 * dev-token-test harness. Single source of truth so the harness and the real
 * voice flow can't diverge.
 *
 * Lifecycle:
 *   - `start(stream)` — caller owns getUserMedia (so it can keep the same
 *     stream for the mic-level meter / error UX). We mint a token, open the
 *     peer connection, attach the mic track, open the oai-events data
 *     channel, complete the SDP handshake via connectRealtimeCall, and start
 *     receiving transcription events.
 *   - On each `conversation.item.input_audio_transcription.completed` event
 *     we append to the committed transcript and debounce a regenerate. The
 *     in-flight + stale guards from the harness prevent overlapping passes
 *     and ensure the latest transcript always wins.
 *   - `stop({ finalize })` — closes the channel, stops mic tracks, closes the
 *     peer connection, cancels any pending debounce, and (when finalize is
 *     true) runs one final regenerate against the complete transcript so the
 *     visible draft reflects everything that was said.
 *   - `sessionIdRef` bumps on every start (and stop is keyed to it) so any
 *     pass that finishes against a superseded/closed session is dropped.
 */
export type LiveTile = AIGeneratedQuote["line_items"][number];

export interface UseLiveQuoteSessionOpts {
  trade: string;
  vatRegistered: boolean;
  /** Fired on every regenerate pass (debounced + final). */
  onResult: (result: AIGeneratedQuote, transcript: string) => void;
  /** Fired for mint / sdp / regenerate / oai-error failures. */
  onError: (msg: string) => void;
}

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

export function useLiveQuoteSession(opts: UseLiveQuoteSessionOpts) {
  const mint = useServerFn(createRealtimeTranscriptionToken);
  const connect = useServerFn(connectRealtimeCall);
  const generate = useServerFn(generateAIQuote);

  // Keep latest opts in refs so the event handlers (registered once per
  // session) always see the current trade / vat / callbacks.
  const tradeRef = useRef(opts.trade);
  const vatRef = useRef(opts.vatRegistered);
  const onResultRef = useRef(opts.onResult);
  const onErrorRef = useRef(opts.onError);
  tradeRef.current = opts.trade;
  vatRef.current = opts.vatRegistered;
  onResultRef.current = opts.onResult;
  onErrorRef.current = opts.onError;

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const committedRef = useRef("");
  const interimRef = useRef("");
  const seenItemIdsRef = useRef<Set<string>>(new Set());
  const regenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const staleRef = useRef(false);
  const sessionIdRef = useRef(0);

  function fullTranscript() {
    const c = committedRef.current.trim();
    const i = interimRef.current.trim();
    if (c && i) return c + " " + i;
    return c || i;
  }

  async function runRegenerate(sessionId: number) {
    const text = fullTranscript();
    if (!text) return;
    if (inFlightRef.current) {
      staleRef.current = true;
      return;
    }
    inFlightRef.current = true;
    staleRef.current = false;
    console.log("[live] regenerate fired; transcript:", text);
    try {
      const result = await generate({
        data: {
          description: text,
          trade: tradeRef.current,
          vatRegistered: vatRef.current,
        },
      });
      if (sessionId !== sessionIdRef.current) return;
      console.log("[live] returned items:", result.line_items.length);
      onResultRef.current(result, text);
    } catch (e) {
      console.error("[live] regenerate failed", e);
      onErrorRef.current(e instanceof Error ? e.message : String(e));
    } finally {
      inFlightRef.current = false;
      if (staleRef.current && sessionId === sessionIdRef.current) {
        staleRef.current = false;
        runRegenerate(sessionId);
      }
    }
  }

  function scheduleRegenerate(sessionId: number) {
    if (regenTimerRef.current) clearTimeout(regenTimerRef.current);
    regenTimerRef.current = setTimeout(() => {
      regenTimerRef.current = null;
      runRegenerate(sessionId);
    }, 1200);
  }

  function teardownTransport() {
    if (regenTimerRef.current) {
      clearTimeout(regenTimerRef.current);
      regenTimerRef.current = null;
    }
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
  }

  useEffect(() => {
    return () => {
      // Bump so any in-flight regenerate that resolves after unmount is dropped.
      sessionIdRef.current++;
      teardownTransport();
    };
  }, []);

  /**
   * Opens the realtime session. Caller owns the MediaStream — pass the same
   * stream that drives the mic-level meter so we don't open the mic twice.
   */
  async function start(stream: MediaStream): Promise<void> {
    const sessionId = ++sessionIdRef.current;
    committedRef.current = "";
    interimRef.current = "";
    seenItemIdsRef.current = new Set();
    inFlightRef.current = false;
    staleRef.current = false;
    if (regenTimerRef.current) {
      clearTimeout(regenTimerRef.current);
      regenTimerRef.current = null;
    }

    const r = await mint();
    if (!r?.token) throw new Error("Realtime token mint returned no token.");
    if (sessionId !== sessionIdRef.current) return;
    const token = r.token;
    console.log("[live] minted token, expiresAt:", r.expiresAt);

    streamRef.current = stream;

    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    pc.addEventListener("connectionstatechange", () => {
      console.log("[live] pc.connectionState:", pc.connectionState);
      if (pc.connectionState === "failed") {
        onErrorRef.current(`peer connection: ${pc.connectionState}`);
      }
    });

    for (const track of stream.getAudioTracks()) {
      pc.addTrack(track, stream);
    }

    const channel = pc.createDataChannel("oai-events");
    channelRef.current = channel;

    channel.addEventListener("open", () => {
      console.log("[live] data channel open");
    });
    channel.addEventListener("error", (e) => {
      console.error("[live] data channel error", e);
    });
    channel.addEventListener("message", (e) => {
      let evt: { type?: string; item_id?: unknown; transcript?: unknown; delta?: unknown; error?: { message?: string }; message?: string };
      try {
        evt = JSON.parse(e.data);
      } catch {
        return;
      }
      console.log("[oai]", evt.type, evt);
      switch (evt.type) {
        case "conversation.item.input_audio_transcription.delta": {
          const delta = typeof evt.delta === "string" ? evt.delta : "";
          if (delta) {
            interimRef.current = interimRef.current
              ? interimRef.current + delta
              : delta;
            scheduleRegenerate(sessionId);
          }
          break;
        }
        case "conversation.item.input_audio_transcription.completed": {
          const id = String(evt.item_id ?? "");
          if (id && seenItemIdsRef.current.has(id)) break;
          if (id) seenItemIdsRef.current.add(id);
          const text = typeof evt.transcript === "string" ? evt.transcript.trim() : "";
          if (text) {
            committedRef.current = committedRef.current
              ? committedRef.current + " " + text
              : text;
          }
          // Fold any interim into the committed turn boundary.
          interimRef.current = "";
          if (text) scheduleRegenerate(sessionId);
          break;
        }
        default: {
          if (typeof evt.type === "string" && evt.type.startsWith("error")) {
            const msg = evt?.error?.message ?? evt?.message ?? evt.type;
            console.error("[live oai error]", evt);
            onErrorRef.current(`oai: ${msg}`);
          }
        }
      }
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceComplete(pc);
    const sdp = pc.localDescription?.sdp;
    if (!sdp) throw new Error("Missing local SDP after ICE gathering.");

    const { answer } = await connect({ data: { sdp, ephemeralToken: token } });
    if (!answer) throw new Error("Empty SDP answer from relay.");

    if (sessionId !== sessionIdRef.current) {
      teardownTransport();
      return;
    }
    await pc.setRemoteDescription({ type: "answer", sdp: answer });
    console.log("[live] setRemoteDescription complete");
  }

  /**
   * Tears down the realtime transport. When `finalize` is true, runs one
   * last regenerate against the complete transcript so the on-screen quote
   * reflects everything said before stop — no separate finalise re-pass
   * needed by the caller.
   */
  async function stop(opts: { finalize?: boolean } = {}): Promise<{
    transcript: string;
    didRegenerate: boolean;
  }> {
    const sessionId = sessionIdRef.current;
    teardownTransport();
    const transcript = committedRef.current.trim();

    if (!opts.finalize || !transcript) return { transcript, didRegenerate: false };

    // Wait for any in-flight pass to settle so the final regenerate's result
    // wins over a stale one that finishes after us.
    while (inFlightRef.current && sessionId === sessionIdRef.current) {
      await new Promise((r) => setTimeout(r, 50));
    }
    if (sessionId !== sessionIdRef.current) return { transcript, didRegenerate: false };

    inFlightRef.current = true;
    try {
      console.log("[live] final regenerate; transcript:", transcript);
      const result = await generate({
        data: {
          description: transcript,
          trade: tradeRef.current,
          vatRegistered: vatRef.current,
        },
      });
      if (sessionId !== sessionIdRef.current) return { transcript, didRegenerate: false };
      onResultRef.current(result, transcript);
      return { transcript, didRegenerate: true };
    } catch (e) {
      console.error("[live] final regenerate failed", e);
      onErrorRef.current(e instanceof Error ? e.message : String(e));
      return { transcript, didRegenerate: false };
    } finally {
      inFlightRef.current = false;
    }
  }

  return { start, stop };
}
