import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadSans } from "@remotion/google-fonts/WorkSans";
import { z } from "zod";

const serif = loadSerif("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily;
const sans = loadSans("normal", { weights: ["300", "400", "500", "600"], subsets: ["latin"] }).fontFamily;

// Editorial palette — cream paper, deep ink, warm copper accent, muted sage
const PAPER = "#F1ECDF";
const PAPER_2 = "#E8E1CE";
const INK = "#15120D";
const INK_2 = "#3A332A";
const COPPER = "#B8784A";
const COPPER_DIM = "#8E5A36";
const SAGE = "#7C8A6C";
const HAIRLINE = "rgba(21,18,13,0.35)";

export const socialEditorialSchema = z.object({
  format: z.enum(["vertical", "square", "wide"]),
});

type Props = z.infer<typeof socialEditorialSchema>;

// ---------- small primitives ----------
const Hairline: React.FC<{ width: number | string; delay?: number; color?: string; thickness?: number }> = ({
  width,
  delay = 0,
  color = HAIRLINE,
  thickness = 1,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - delay, [0, 18], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  return (
    <div
      style={{
        width,
        height: thickness,
        background: color,
        transform: `scaleX(${p})`,
        transformOrigin: "left",
      }}
    />
  );
};

const FadeUp: React.FC<{ delay?: number; children: React.ReactNode; distance?: number; duration?: number }> = ({
  delay = 0,
  children,
  distance = 18,
  duration = 28,
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - delay, [0, duration], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  return (
    <div style={{ opacity: t, transform: `translateY(${(1 - t) * distance}px)` }}>{children}</div>
  );
};

const Masthead: React.FC<{ rightLabel?: string }> = ({ rightLabel = "ESTD. 2026" }) => (
  <FadeUp delay={2} distance={8}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: sans,
        fontSize: 18,
        letterSpacing: 4,
        textTransform: "uppercase",
        color: INK_2,
        fontWeight: 500,
      }}
    >
      <span>Vol. 01 — Quottr Quarterly</span>
      <span>{rightLabel}</span>
    </div>
  </FadeUp>
);

// ---------- scenes ----------
// All scenes use frame-local time via <Sequence>.

const SceneOpen: React.FC<{ format: Props["format"] }> = ({ format }) => {
  const frame = useCurrentFrame();
  const stamp = spring({ frame: frame - 50, fps: 30, config: { damping: 14, stiffness: 110 } });
  const headlineSize = format === "wide" ? 220 : format === "square" ? 200 : 240;
  return (
    <AbsoluteFill
      style={{
        background: PAPER,
        padding: format === "wide" ? "70px 110px" : "100px 80px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        <Masthead />
        <Hairline width="100%" delay={10} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <FadeUp delay={22} distance={10}>
          <div
            style={{
              fontFamily: sans,
              fontSize: 22,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: COPPER,
              fontWeight: 500,
            }}
          >
            A study in speed
          </div>
        </FadeUp>
        <FadeUp delay={32} distance={28} duration={36}>
          <div
            style={{
              fontFamily: serif,
              fontSize: headlineSize,
              color: INK,
              lineHeight: 0.92,
              letterSpacing: -2,
            }}
          >
            Sixty
            <br />
            seconds.
          </div>
        </FadeUp>
        <FadeUp delay={56} distance={16}>
          <div
            style={{
              fontFamily: serif,
              fontStyle: "italic",
              fontSize: format === "wide" ? 48 : 56,
              color: INK_2,
              maxWidth: 880,
              lineHeight: 1.15,
            }}
          >
            from finishing the job
            <br />
            to a quote in their inbox.
          </div>
        </FadeUp>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Hairline width="40%" delay={70} color={COPPER} thickness={2} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            opacity: stamp,
            transform: `translateY(${(1 - stamp) * 14}px)`,
          }}
        >
          <div style={{ fontFamily: sans, fontSize: 18, letterSpacing: 3, color: INK_2, textTransform: "uppercase" }}>
            No. 001 / The Quote
          </div>
          <div
            style={{
              fontFamily: serif,
              fontStyle: "italic",
              fontSize: 28,
              color: INK_2,
            }}
          >
            — for the trades
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Phone-card showing: waveform recording → AI building line items → sent ✓
const PhoneCard: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const frame = useCurrentFrame();

  // Stage timing within the phone scene (sequence is 120f long here)
  const recStart = 4;
  const buildStart = 38;
  const sentStart = 86;

  const recProg = interpolate(frame - recStart, [0, 28], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const buildProg = interpolate(frame - buildStart, [0, 40], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const sentSpring = spring({ frame: frame - sentStart, fps: 30, config: { damping: 12, stiffness: 140 } });

  // Crossfade between the three states
  const recOpacity = interpolate(frame, [recStart, recStart + 6, buildStart - 4, buildStart + 4], [0, 1, 1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const buildOpacity = interpolate(frame, [buildStart - 2, buildStart + 6, sentStart - 4, sentStart + 4], [0, 1, 1, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const sentOpacity = interpolate(frame, [sentStart - 2, sentStart + 6], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  const padX = 36;
  const padY = 40;

  return (
    <div
      style={{
        width,
        height,
        background: PAPER_2,
        borderRadius: 36,
        boxShadow: "0 30px 80px -30px rgba(21,18,13,0.35), inset 0 0 0 1px rgba(21,18,13,0.06)",
        position: "relative",
        overflow: "hidden",
        fontFamily: sans,
      }}
    >
      {/* Status bar */}
      <div
        style={{
          padding: "22px 36px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 16,
          color: INK_2,
          letterSpacing: 1,
        }}
      >
        <span>9:41</span>
        <span style={{ fontFamily: serif, fontStyle: "italic", fontSize: 22, color: INK }}>Quottr</span>
        <span>●●●</span>
      </div>

      {/* STATE 1 — Recording */}
      <div style={{ position: "absolute", inset: 0, opacity: recOpacity, padding: `${padY + 30}px ${padX}px` }}>
        <div style={{ fontFamily: sans, fontSize: 18, letterSpacing: 3, color: COPPER, textTransform: "uppercase" }}>
          Recording
        </div>
        <div
          style={{
            fontFamily: serif,
            fontSize: 56,
            color: INK,
            lineHeight: 1.02,
            marginTop: 18,
            letterSpacing: -1,
          }}
        >
          “Replaced the boiler today, two new rads, full service…”
        </div>
        {/* Waveform */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 60, height: 90 }}>
          {Array.from({ length: 38 }).map((_, i) => {
            const phase = (frame + i * 3) / 6;
            const h = 14 + Math.abs(Math.sin(phase)) * (50 + (i % 5) * 8) * recProg;
            return (
              <div
                key={i}
                style={{
                  width: 6,
                  height: h,
                  borderRadius: 4,
                  background: i % 7 === 0 ? COPPER : INK,
                  opacity: 0.85,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* STATE 2 — Quote building */}
      <div style={{ position: "absolute", inset: 0, opacity: buildOpacity, padding: `${padY + 30}px ${padX}px` }}>
        <div style={{ fontFamily: sans, fontSize: 18, letterSpacing: 3, color: SAGE, textTransform: "uppercase" }}>
          Drafting quote
        </div>
        <div
          style={{
            fontFamily: serif,
            fontSize: 48,
            color: INK,
            marginTop: 16,
            letterSpacing: -0.5,
          }}
        >
          Mrs. Patel — 14 Linden Rd
        </div>
        <div style={{ height: 1, background: HAIRLINE, marginTop: 22 }} />
        {[
          { label: "Boiler replacement (Worcester 30kW)", price: "£1,840" },
          { label: "Two radiators + valves", price: "£420" },
          { label: "System flush & service", price: "£180" },
          { label: "Labour — 1 day", price: "£320" },
        ].map((row, i) => {
          const itemP = interpolate(buildProg, [i / 5, (i + 1) / 5], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          });
          return (
            <div
              key={row.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginTop: 22,
                opacity: itemP,
                transform: `translateY(${(1 - itemP) * 10}px)`,
                fontSize: 26,
                color: INK_2,
              }}
            >
              <span style={{ maxWidth: "70%" }}>{row.label}</span>
              <span style={{ fontFamily: serif, fontSize: 32, color: INK }}>{row.price}</span>
            </div>
          );
        })}
        <div style={{ height: 1, background: HAIRLINE, marginTop: 28 }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginTop: 20,
            opacity: interpolate(buildProg, [0.85, 1], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }),
          }}
        >
          <span style={{ fontFamily: sans, fontSize: 18, letterSpacing: 3, textTransform: "uppercase", color: INK_2 }}>
            Total (inc. VAT)
          </span>
          <span style={{ fontFamily: serif, fontSize: 64, color: COPPER, letterSpacing: -1 }}>£3,312</span>
        </div>
      </div>

      {/* STATE 3 — Sent */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: sentOpacity,
          padding: `${padY + 30}px ${padX}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 30,
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 999,
            border: `2px solid ${COPPER}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${0.6 + sentSpring * 0.4})`,
          }}
        >
          <svg width="74" height="74" viewBox="0 0 74 74" fill="none">
            <path
              d="M14 38 L31 55 L60 22"
              stroke={COPPER}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="100"
              strokeDashoffset={100 - sentSpring * 100}
            />
          </svg>
        </div>
        <div style={{ fontFamily: serif, fontSize: 56, color: INK, letterSpacing: -1 }}>Sent.</div>
        <div style={{ fontFamily: sans, fontSize: 22, color: INK_2, letterSpacing: 2, textTransform: "uppercase" }}>
          Mrs. Patel · 47 seconds
        </div>
      </div>
    </div>
  );
};

const ScenePhone: React.FC<{ format: Props["format"] }> = ({ format }) => {
  const frame = useCurrentFrame();
  const labelP = interpolate(frame, [0, 24], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  // Layout per format
  const wide = format === "wide";
  return (
    <AbsoluteFill
      style={{
        background: PAPER,
        padding: wide ? "70px 110px" : "80px 70px",
        display: "flex",
        flexDirection: wide ? "row" : "column",
        gap: wide ? 80 : 40,
        alignItems: wide ? "center" : "stretch",
      }}
    >
      <div style={{ flex: wide ? 1 : "0 0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ opacity: labelP }}>
          <Hairline width={140} color={COPPER} thickness={2} />
          <div
            style={{
              fontFamily: sans,
              fontSize: 18,
              letterSpacing: 5,
              textTransform: "uppercase",
              color: INK_2,
              marginTop: 14,
            }}
          >
            Act II — The Method
          </div>
        </div>
        <FadeUp delay={6} distance={22} duration={30}>
          <div
            style={{
              fontFamily: serif,
              fontSize: wide ? 130 : format === "square" ? 110 : 130,
              color: INK,
              lineHeight: 0.96,
              letterSpacing: -2,
            }}
          >
            Speak it.
            <br />
            <span style={{ color: COPPER, fontStyle: "italic" }}>Send it.</span>
          </div>
        </FadeUp>
        {!wide && <div style={{ flex: 1 }} />}
      </div>

      <div
        style={{
          flex: wide ? 1 : "1 1 auto",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <PhoneCard
          width={wide ? 720 : format === "square" ? 600 : 820}
          height={wide ? 820 : format === "square" ? 720 : 1120}
        />
      </div>
    </AbsoluteFill>
  );
};

const SceneStat: React.FC<{ format: Props["format"] }> = ({ format }) => {
  const frame = useCurrentFrame();
  const big = spring({ frame, fps: 30, config: { damping: 18, stiffness: 90 } });
  const numScale = interpolate(big, [0, 1], [0.9, 1]);
  return (
    <AbsoluteFill
      style={{
        background: INK,
        color: PAPER,
        padding: format === "wide" ? "70px 120px" : "100px 80px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <FadeUp delay={2} distance={6}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: sans,
            fontSize: 18,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "rgba(241,236,223,0.6)",
          }}
        >
          <span>An observation</span>
          <span>Figure 01</span>
        </div>
      </FadeUp>
      <Hairline width="100%" delay={10} color="rgba(241,236,223,0.25)" />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 24 }}>
        <FadeUp delay={20} distance={10}>
          <div
            style={{
              fontFamily: sans,
              fontSize: 22,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: COPPER,
            }}
          >
            Average time to send
          </div>
        </FadeUp>
        <div
          style={{
            fontFamily: serif,
            fontSize: format === "wide" ? 460 : format === "square" ? 420 : 520,
            lineHeight: 0.85,
            letterSpacing: -8,
            color: PAPER,
            transform: `scale(${numScale})`,
            transformOrigin: "left center",
          }}
        >
          47<span style={{ color: COPPER }}>s</span>
        </div>
        <FadeUp delay={28} distance={14}>
          <div
            style={{
              fontFamily: serif,
              fontStyle: "italic",
              fontSize: format === "wide" ? 44 : 50,
              color: "rgba(241,236,223,0.78)",
              maxWidth: 880,
              lineHeight: 1.15,
            }}
          >
            measured across one thousand
            <br />
            quotes sent on Quottr.
          </div>
        </FadeUp>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Hairline width="100%" delay={36} color="rgba(241,236,223,0.25)" />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: sans,
            fontSize: 18,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "rgba(241,236,223,0.55)",
          }}
        >
          <span>Quottr · For the trades</span>
          <span>p. 47</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SceneSignOff: React.FC<{ format: Props["format"] }> = ({ format }) => {
  const frame = useCurrentFrame();
  const wordP = spring({ frame: frame - 4, fps: 30, config: { damping: 18, stiffness: 90 } });
  const lineP = interpolate(frame - 20, [0, 26], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill
      style={{
        background: PAPER,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 36,
        padding: 80,
      }}
    >
      <div
        style={{
          fontFamily: sans,
          fontSize: 18,
          letterSpacing: 8,
          textTransform: "uppercase",
          color: INK_2,
          opacity: interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        — Colophon —
      </div>
      <div
        style={{
          fontFamily: serif,
          fontSize: format === "wide" ? 240 : format === "square" ? 220 : 260,
          color: INK,
          letterSpacing: -4,
          transform: `scale(${0.85 + wordP * 0.15})`,
        }}
      >
        Quottr<span style={{ color: COPPER, fontStyle: "italic" }}>.</span>
      </div>
      <div
        style={{
          width: format === "wide" ? 520 : 380,
          height: 2,
          background: COPPER,
          transform: `scaleX(${lineP})`,
          transformOrigin: "center",
        }}
      />
      <div
        style={{
          fontFamily: serif,
          fontStyle: "italic",
          fontSize: format === "wide" ? 44 : 52,
          color: INK_2,
          opacity: interpolate(frame - 30, [0, 22], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }),
          letterSpacing: -0.5,
        }}
      >
        Quote faster. Win more work.
      </div>
      <div
        style={{
          fontFamily: sans,
          fontSize: 18,
          letterSpacing: 6,
          textTransform: "uppercase",
          color: COPPER_DIM,
          marginTop: 14,
          opacity: interpolate(frame - 44, [0, 20], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }),
        }}
      >
        quottr.co.uk
      </div>
    </AbsoluteFill>
  );
};

// ---------- film grain overlay ----------
const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  // Deterministic per-frame grain via blended noise svg (no random calls in render)
  const shift = (frame * 7) % 13;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.08, mixBlendMode: "multiply" }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <filter id="n">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={shift} />
          <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.65 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#n)" />
      </svg>
    </AbsoluteFill>
  );
};

// ---------- master comp ----------
// Beats (frames @ 30fps):
//   0-90    Open    (3.0s)
//   90-210  Phone   (4.0s)
//   210-300 Stat    (3.0s)
//   300-360 SignOff (2.0s)
export const SocialEditorial: React.FC<Props> = ({ format }) => {
  const { durationInFrames } = useVideoConfig();

  // global slow vignette pulse for "film" feel
  const frame = useCurrentFrame();
  const pulse = 0.05 + Math.sin(frame / 50) * 0.02;

  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={90}>
        <SceneOpen format={format} />
      </Sequence>
      <Sequence from={90} durationInFrames={120}>
        <ScenePhone format={format} />
      </Sequence>
      <Sequence from={210} durationInFrames={90}>
        <SceneStat format={format} />
      </Sequence>
      <Sequence from={300} durationInFrames={durationInFrames - 300}>
        <SceneSignOff format={format} />
      </Sequence>

      {/* Editorial vignette */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: `radial-gradient(120% 100% at 50% 50%, transparent 55%, rgba(0,0,0,${pulse + 0.08}) 100%)`,
        }}
      />
      <Grain />
    </AbsoluteFill>
  );
};
