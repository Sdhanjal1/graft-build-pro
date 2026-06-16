import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createRealtimeTranscriptionToken } from "@/lib/realtime-token.functions";

export const Route = createFileRoute("/dev-token-test")({
  component: DevTokenTest,
});

function DevTokenTest() {
  const mint = useServerFn(createRealtimeTranscriptionToken);
  const [result, setResult] = useState<{ token?: string; expiresAt?: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await mint();
      setResult(r);
      // eslint-disable-next-line no-console
      console.log("[dev-token-test]", r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      // eslint-disable-next-line no-console
      console.error("[dev-token-test] error", e);
    } finally {
      setLoading(false);
    }
  }

  const expiresInSec =
    typeof result?.expiresAt === "number"
      ? Math.max(0, result.expiresAt - Math.floor(Date.now() / 1000))
      : null;

  return (
    <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, marginBottom: 12 }}>Realtime token test (DEV ONLY)</h1>
      <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 16 }}>
        Sign in with a trialing/active account, then tap mint. This calls
        createRealtimeTranscriptionToken and shows the ephemeral OpenAI token.
        Delete this route before launch.
      </p>

      <button
        onClick={run}
        disabled={loading}
        style={{
          padding: "10px 16px",
          background: "#c4f432",
          border: "none",
          borderRadius: 8,
          fontWeight: 600,
          cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading ? "Minting…" : "Mint ephemeral token"}
      </button>

      {error && (
        <pre
          style={{
            marginTop: 16,
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
          {error}
        </pre>
      )}

      {result && (
        <div style={{ marginTop: 16 }}>
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
            {result.token ?? "(missing)"}
          </pre>
          <div style={{ fontSize: 12, opacity: 0.7, margin: "12px 0 4px" }}>expiresAt</div>
          <pre
            style={{
              padding: 12,
              background: "#f3f3f3",
              borderRadius: 8,
              fontSize: 12,
            }}
          >
            {String(result.expiresAt)}
            {expiresInSec !== null ? `  (${expiresInSec}s from now)` : ""}
          </pre>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 12 }}>
            starts with <code>ek_</code>?{" "}
            <strong>{result.token?.startsWith("ek_") ? "yes ✓" : "no"}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
