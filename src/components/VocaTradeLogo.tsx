/**
 * VocaTradeLogo — brand wordmark for VocaTrade.
 *
 * Renders "VOCATRADE" in Bebas Neue as inline SVG. Optionally draws a small
 * filled rectangle (the "crossbar extension") that visually joins the top of
 * the A (index 3) to the stem of the T (index 4), so the A and T share a
 * single horizontal top stroke — our signature ligature.
 *
 * Variants:
 *   - "full": two-tone — VOCA in paper, TRADE in lime, lime crossbar bridge.
 *   - "mono": single colour (defaults to ink) — whole word + crossbar.
 *
 * Legibility:
 *   - The joined ligature is for LARGE sizes only (hero, marketing).
 *   - For small placements (nav, favicon, app icon) pass `joined={false}` to
 *     render a plain clean VOCATRADE with no crossbar.
 */

import * as React from "react";

/* ───────────────────────────── TWEAKABLE CONSTANTS ─────────────────────────────
 * All values are in the SVG's viewBox units. The viewBox is 0 0 1000 220.
 * Fine-tune visually until the crossbar sits flush along the top of the A
 * (index 3, the 4th letter) and meets the vertical stem of the T (index 4).
 * ───────────────────────────────────────────────────────────────────────────── */

// Horizontal start of the crossbar bridge (left edge, in viewBox X units).
// Increase to push it RIGHT, decrease to push it LEFT.
const CROSSBAR_X = 372;

// Width of the crossbar bridge (how far it extends across the A → into T stem).
const CROSSBAR_W = 128;

// Vertical position of the crossbar's TOP edge (in viewBox Y units).
// The text baseline is at y=180, cap height ~ y=40. Tweak until flush with A apex.
const CROSSBAR_Y = 38;

// Thickness of the crossbar (matches the natural T crossbar stroke weight).
const CROSSBAR_H = 18;

// Letter-spacing on the wordmark (matches existing hero treatment).
const LETTER_SPACING = "0.01em";

/* ───────────────────────────────────────────────────────────────────────────── */

export type VocaTradeLogoProps = {
  /** "full" two-tone (paper + lime) or "mono" single colour. Default "full". */
  variant?: "full" | "mono";
  /** Single colour used in "mono" variant. CSS colour or theme token. Default "var(--ink)". */
  color?: string;
  /** Show the AT-ligature crossbar. Set false for small sizes (nav/favicon). Default true. */
  joined?: boolean;
  /** Optional className for sizing (e.g. "h-12 w-auto"). */
  className?: string;
  /** Accessible label. */
  title?: string;
};

export function VocaTradeLogo({
  variant = "full",
  color = "var(--ink)",
  joined = true,
  className = "h-12 w-auto",
  title = "VocaTrade",
}: VocaTradeLogoProps) {
  const fontStyle: React.CSSProperties = {
    fontFamily: "'Bebas Neue', Impact, sans-serif",
    fontSize: 200,
    letterSpacing: LETTER_SPACING,
  };

  const paper = "var(--paper)";
  const lime = "var(--lime)";
  const monoFill = color;

  return (
    <svg
      role="img"
      aria-label={title}
      viewBox="0 0 1000 220"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      shapeRendering="geometricPrecision"
      style={{ display: "block" }}
    >
      <title>{title}</title>

      {variant === "full" ? (
        <>
          {/* VOCA in paper, TRADE in lime, rendered as a single text node so
              spacing matches naturally. Use two <tspan>s for the colour split. */}
          <text x="0" y="180" style={fontStyle}>
            <tspan fill={paper}>VOCA</tspan>
            <tspan fill={lime}>TRADE</tspan>
          </text>
          {joined && (
            <rect
              x={CROSSBAR_X}
              y={CROSSBAR_Y}
              width={CROSSBAR_W}
              height={CROSSBAR_H}
              fill={lime}
            />
          )}
        </>
      ) : (
        <>
          <text x="0" y="180" fill={monoFill} style={fontStyle}>
            VOCATRADE
          </text>
          {joined && (
            <rect
              x={CROSSBAR_X}
              y={CROSSBAR_Y}
              width={CROSSBAR_W}
              height={CROSSBAR_H}
              fill={monoFill}
            />
          )}
        </>
      )}
    </svg>
  );
}

export default VocaTradeLogo;
