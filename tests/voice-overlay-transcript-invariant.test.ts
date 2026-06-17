/**
 * Invariant test for the voice quote overlay.
 *
 * The live transcript MUST be captured internally (so the AI sees the full
 * text on every regenerate / on stop) but MUST NEVER be rendered inside the
 * VoiceOverlay component. This test is a source-level tripwire: if a future
 * edit re-plumbs `livePreview` / `liveSupported` into the overlay or pastes
 * `liveFinalRef` / `liveInterimRef` into its JSX, the test fails.
 *
 * Run with: `bun test src/routes/__tests__`
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(import.meta.dir, "..", "src", "routes", "quotes.new.tsx"),
  "utf8",
);

// Strip /* … */ and // … comments so comment text mentioning the invariant
// doesn't trip the grep — we only care about live code.
function stripComments(src: string): string {
  // remove /* ... */ (including multi-line)
  let out = src.replace(/\/\*[\s\S]*?\*\//g, "");
  // remove // ... to end of line
  out = out.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  return out;
}

function extractVoiceOverlayBody(src: string): string {
  const startMatch = src.match(/function VoiceOverlay\s*\(/);
  if (!startMatch) throw new Error("VoiceOverlay function not found");
  const start = startMatch.index!;
  // Walk braces from the first `{` after the signature.
  const openIdx = src.indexOf("{", start);
  if (openIdx === -1) throw new Error("VoiceOverlay body start not found");
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(openIdx, i + 1);
    }
  }
  throw new Error("VoiceOverlay body end not found");
}

describe("VoiceOverlay transcript invariant", () => {
  const overlayBody = stripComments(extractVoiceOverlayBody(SRC));
  const overlayCode = overlayBody;
  const fullSrc = stripComments(SRC);

  test("internal capture still wired up (setLivePreview is called)", () => {
    // setLivePreview must remain in the file — it's how the AI sees the full
    // transcript on stop / regenerate. If it's gone, capture is broken.
    expect(fullSrc).toMatch(/setLivePreview\s*\(/);
    // The recogniser final/interim refs must still be written.
    expect(fullSrc).toMatch(/liveFinalRef\.current\s*=/);
    expect(fullSrc).toMatch(/liveInterimRef\.current\s*=/);
  });

  test("overlay does NOT reference the live transcript", () => {
    // None of the transcript-bearing identifiers may appear inside the
    // VoiceOverlay component body.
    const forbidden = [
      "livePreview",
      "liveSupported",
      "liveFinalRef",
      "liveInterimRef",
    ];
    for (const id of forbidden) {
      expect(overlayCode).not.toContain(id);
    }
  });

  test("overlay does NOT receive a livePreview / liveSupported prop", () => {
    // Catch both the destructure list and the prop type.
    expect(overlayCode).not.toMatch(/\blivePreview\s*[,:}]/);
    expect(overlayCode).not.toMatch(/\bliveSupported\s*[,:}]/);
  });
});
