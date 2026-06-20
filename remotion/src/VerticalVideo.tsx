import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { colors, display, body } from "./theme";

// ---------- shared chrome ----------

const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 80) * 60;
  return (
    <AbsoluteFill style={{ backgroundColor: colors.ink }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(700px circle at ${50 + drift / 6}% ${18 + Math.sin(frame / 100) * 6}%, rgba(207,255,61,0.20), transparent 60%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 80px), repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 80px)",
        }}
      />
    </AbsoluteFill>
  );
};

const BrandFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 4, 12, 16], [1, 1, 1, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity }}>
      <div style={{ color: colors.lime, fontFamily: display, fontSize: 260, lineHeight: 0.9 }}>
        Quottr.
      </div>
    </AbsoluteFill>
  );
};

// ---------- captions (top-safe for vertical) ----------

type Cue = { from: number; to: number; text: string; accent?: string };
const cues: Cue[] = [
  { from: 110, to: 270, text: "Speak the job" },
  { from: 270, to: 440, text: "Quote ready", accent: "in seconds" },
  { from: 440, to: 570, text: "Send on WhatsApp", accent: "deposit lands" },
];

const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const c = cues.find((x) => frame >= x.from && frame < x.to);
  if (!c) return null;
  const local = frame - c.from;
  const span = c.to - c.from;
  const inOp = interpolate(local, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const outOp = interpolate(local, [span - 14, span], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(inOp, outOp);
  const y = interpolate(local, [0, 14], [24, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 180,
          display: "flex",
          justifyContent: "center",
          padding: "0 60px",
          opacity,
          transform: `translateY(${y}px)`,
        }}
      >
        <div
          style={{
            background: "rgba(14,15,12,0.85)",
            border: `1px solid rgba(207,255,61,0.3)`,
            padding: "26px 40px",
            borderRadius: 22,
            textAlign: "center",
          }}
        >
          <div style={{ color: colors.paper, fontFamily: display, fontSize: 82, lineHeight: 1 }}>
            {c.text}
          </div>
          {c.accent && (
            <div style={{ color: colors.lime, fontFamily: display, fontSize: 58, lineHeight: 1, marginTop: 8 }}>
              {c.accent}.
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- vertical scenes ----------

const V1Hero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wordIn = spring({ frame, fps, config: { damping: 18, stiffness: 110 } });
  const tag = spring({ frame: frame - 22, fps, config: { damping: 22, stiffness: 130 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center", padding: 60 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: interpolate(frame, [0, 18], [0, 1]) }}>
        <div style={{ width: 12, height: 12, borderRadius: 9999, background: colors.lime }} />
        <span style={{ color: colors.paper, fontFamily: body, fontWeight: 600, letterSpacing: "0.28em", fontSize: 28, textTransform: "uppercase", opacity: 0.7 }}>
          Voice-first for trades
        </span>
      </div>
      <div
        style={{
          marginTop: 60,
          color: colors.lime,
          fontFamily: display,
          fontSize: 360,
          lineHeight: 0.85,
          transform: `translateY(${interpolate(wordIn, [0, 1], [80, 0])}px)`,
          opacity: wordIn,
        }}
      >
        Quottr.
      </div>
      <div
        style={{
          marginTop: 40,
          color: colors.paper,
          fontFamily: display,
          fontSize: 96,
          lineHeight: 1,
          opacity: tag,
          transform: `translateY(${interpolate(tag, [0, 1], [40, 0])}px)`,
        }}
      >
        You talk.<br /><span style={{ color: colors.lime }}>Quottr quotes.</span>
      </div>
    </AbsoluteFill>
  );
};

const VPhone: React.FC<{ children: React.ReactNode; entry: number }> = ({ children, entry }) => (
  <div
    style={{
      width: 620,
      height: 1240,
      borderRadius: 80,
      background: colors.ink,
      border: `10px solid #000`,
      boxShadow: "0 60px 120px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.05)",
      overflow: "hidden",
      position: "relative",
      transform: `translateY(${interpolate(entry, [0, 1], [80, 0])}px) scale(${interpolate(entry, [0, 1], [0.92, 1])})`,
      opacity: entry,
    }}
  >
    <div style={{ position: "absolute", top: 22, left: "50%", transform: "translateX(-50%)", width: 140, height: 34, borderRadius: 9999, background: "#000" }} />
    {children}
  </div>
);

const V2Voice: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headIn = spring({ frame, fps, config: { damping: 22 } });
  const phoneIn = spring({ frame: frame - 12, fps, config: { damping: 20, stiffness: 130 } });
  const fullText = "Quote Mrs Jones for a new combi boiler and a thermostat upgrade.";
  const chars = Math.floor(interpolate(frame, [30, 120], [0, fullText.length], { extrapolateRight: "clamp" }));
  const typed = fullText.slice(0, chars);
  const bars = Array.from({ length: 22 });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", flexDirection: "column", padding: "100px 60px 60px" }}>
      <div style={{ textAlign: "center", opacity: headIn }}>
        <div style={{ color: colors.lime, fontFamily: body, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", fontSize: 26 }}>
          Step 01 — Tap & talk
        </div>
        <div style={{ marginTop: 18, color: colors.paper, fontFamily: display, fontSize: 130, lineHeight: 0.95 }}>
          Just say what<br />needs doing.
        </div>
      </div>
      <div style={{ marginTop: 50 }}>
        <VPhone entry={phoneIn}>
          <div style={{ position: "absolute", inset: 10, borderRadius: 70, background: colors.ink2, display: "flex", flexDirection: "column", padding: "110px 44px 44px" }}>
            <div style={{ color: colors.mute, fontFamily: body, fontSize: 22, letterSpacing: "0.2em", textTransform: "uppercase" }}>New quote</div>
            <div style={{ marginTop: 28, color: colors.paper, fontFamily: body, fontSize: 40, lineHeight: 1.35, minHeight: 360 }}>
              “{typed}<span style={{ opacity: (frame % 30) < 15 ? 1 : 0 }}>▍</span>”
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", justifyContent: "center", gap: 6, alignItems: "center", height: 110 }}>
              {bars.map((_, i) => {
                const h = 24 + Math.abs(Math.sin((frame + i * 7) / 6)) * 70 * (0.4 + Math.sin(i * 0.7) * 0.6);
                return <div key={i} style={{ width: 8, height: h, borderRadius: 4, background: colors.lime }} />;
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 30 }}>
              <div
                style={{
                  width: 170,
                  height: 170,
                  borderRadius: 9999,
                  background: colors.lime,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: `0 0 0 ${10 + Math.sin(frame / 5) * 8}px rgba(207,255,61,0.18), 0 0 0 ${30 + Math.sin(frame / 5) * 16}px rgba(207,255,61,0.08)`,
                }}
              >
                <svg width="72" height="72" viewBox="0 0 24 24" fill={colors.ink}>
                  <path d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3z" />
                  <path d="M19 11a1 1 0 10-2 0 5 5 0 11-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H8a1 1 0 100 2h8a1 1 0 100-2h-3v-2.08A7 7 0 0019 11z" />
                </svg>
              </div>
            </div>
          </div>
        </VPhone>
      </div>
    </AbsoluteFill>
  );
};

const lineItems = [
  { label: "Worcester Greenstar combi boiler — supply & fit", price: "1,840.00" },
  { label: "Hive Active Heating thermostat", price: "245.00" },
  { label: "System filter + chemical flush", price: "320.00" },
  { label: "Labour — 1.5 days, two engineers", price: "540.00" },
];

const V3Quote: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headIn = spring({ frame, fps, config: { damping: 22 } });
  const paperIn = spring({ frame: frame - 10, fps, config: { damping: 22, stiffness: 140 } });
  const totalIn = spring({ frame: frame - 95, fps, config: { damping: 12, stiffness: 140 } });
  const stamp = spring({ frame: frame - 120, fps, config: { damping: 8, stiffness: 120 } });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", flexDirection: "column", padding: "100px 60px 60px" }}>
      <div style={{ textAlign: "center", opacity: headIn }}>
        <div style={{ color: colors.lime, fontFamily: body, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", fontSize: 26 }}>
          Step 02 — Quote written
        </div>
        <div style={{ marginTop: 18, color: colors.paper, fontFamily: display, fontSize: 130, lineHeight: 0.95 }}>
          Priced. Branded. <span style={{ color: colors.lime }}>Done.</span>
        </div>
      </div>

      <div
        style={{
          marginTop: 50,
          width: 920,
          background: colors.paper,
          color: colors.ink,
          borderRadius: 28,
          padding: 56,
          boxShadow: "0 60px 120px rgba(0,0,0,0.55)",
          transform: `translateY(${interpolate(paperIn, [0, 1], [60, 0])}px) scale(${interpolate(paperIn, [0, 1], [0.94, 1])})`,
          opacity: paperIn,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 24, borderBottom: `1px solid rgba(14,15,12,0.12)` }}>
          <div style={{ fontFamily: display, fontSize: 72, lineHeight: 0.9 }}>QUOTE</div>
          <div style={{ fontFamily: body, fontSize: 20, textAlign: "right", opacity: 0.7 }}>
            #Q-2048<br />Cosy Plumbing
          </div>
        </div>
        <div style={{ marginTop: 28, fontFamily: body, fontSize: 22, opacity: 0.7 }}>For</div>
        <div style={{ fontFamily: display, fontSize: 48, lineHeight: 1 }}>Mrs Jones · 14 Beech Ave</div>

        <div style={{ marginTop: 28 }}>
          {lineItems.map((it, i) => {
            const enter = spring({ frame: frame - 20 - i * 12, fps, config: { damping: 22, stiffness: 160 } });
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "18px 0",
                  borderBottom: `1px solid rgba(14,15,12,0.08)`,
                  opacity: enter,
                  transform: `translateX(${interpolate(enter, [0, 1], [-30, 0])}px)`,
                  gap: 24,
                }}
              >
                <div style={{ fontFamily: body, fontSize: 28 }}>{it.label}</div>
                <div style={{ fontFamily: display, fontSize: 36 }}>£{it.price}</div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 28,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: colors.ink,
            color: colors.paper,
            borderRadius: 18,
            padding: "30px 36px",
            opacity: totalIn,
            transform: `scale(${interpolate(totalIn, [0, 1], [0.95, 1])})`,
          }}
        >
          <div style={{ fontFamily: body, fontSize: 22, letterSpacing: "0.25em", textTransform: "uppercase", opacity: 0.7 }}>Total inc. VAT</div>
          <div style={{ fontFamily: display, fontSize: 76, color: colors.lime }}>£3,534</div>
        </div>

        <div
          style={{
            marginTop: 28,
            display: "inline-block",
            transform: `rotate(${interpolate(stamp, [0, 1], [-25, -8])}deg) scale(${interpolate(stamp, [0, 1], [1.6, 1])})`,
            opacity: stamp,
            border: `4px solid ${colors.limeDim}`,
            color: colors.limeDim,
            fontFamily: display,
            fontSize: 48,
            padding: "10px 26px",
            letterSpacing: "0.08em",
            borderRadius: 14,
          }}
        >
          READY TO SEND
        </div>
      </div>
    </AbsoluteFill>
  );
};

const V4Send: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headIn = spring({ frame, fps, config: { damping: 22 } });
  const bubbleIn = spring({ frame: frame - 14, fps, config: { damping: 18, stiffness: 130 } });
  const tickIn = spring({ frame: frame - 60, fps, config: { damping: 14, stiffness: 140 } });
  const paidIn = spring({ frame: frame - 90, fps, config: { damping: 10, stiffness: 130 } });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", flexDirection: "column", padding: "100px 60px 60px" }}>
      <div style={{ textAlign: "center", opacity: headIn }}>
        <div style={{ color: colors.lime, fontFamily: body, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", fontSize: 26 }}>
          Step 03 — Send & get paid
        </div>
        <div style={{ marginTop: 18, color: colors.paper, fontFamily: display, fontSize: 130, lineHeight: 0.95 }}>
          Straight to <span style={{ color: colors.lime }}>WhatsApp.</span>
        </div>
      </div>

      <div
        style={{
          marginTop: 60,
          width: 820,
          background: "#075E54",
          borderRadius: 28,
          padding: 36,
          boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
          opacity: bubbleIn,
          transform: `translateY(${interpolate(bubbleIn, [0, 1], [40, 0])}px)`,
        }}
      >
        <div style={{ color: "#fff", fontFamily: body, fontSize: 22, opacity: 0.7 }}>Mrs Jones</div>
        <div
          style={{
            marginTop: 16,
            background: "#DCF8C6",
            color: "#0E0F0C",
            borderRadius: 22,
            padding: "24px 28px",
            fontFamily: body,
            fontSize: 28,
            lineHeight: 1.35,
          }}
        >
          Hi Mrs Jones — your quote for the new combi boiler is ready.
          <div style={{ marginTop: 14, fontWeight: 700 }}>📎 Quote-Q-2048.pdf · £3,534.00</div>
          <div style={{ marginTop: 6, fontSize: 22, opacity: 0.6, textAlign: "right" }}>
            10:42 {tickIn > 0.3 && <span style={{ color: "#34B7F1" }}>✓✓</span>}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 50,
          opacity: paidIn,
          transform: `scale(${interpolate(paidIn, [0, 1], [0.8, 1])})`,
          background: colors.lime,
          color: colors.ink,
          padding: "30px 48px",
          borderRadius: 20,
          fontFamily: display,
          fontSize: 84,
          letterSpacing: "0.02em",
          boxShadow: "0 30px 60px rgba(207,255,61,0.25)",
        }}
      >
        Deposit paid · £530
      </div>
    </AbsoluteFill>
  );
};

const V5End: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wordIn = spring({ frame, fps, config: { damping: 16, stiffness: 110 } });
  const lineIn = spring({ frame: frame - 18, fps, config: { damping: 22 } });
  const tag = spring({ frame: frame - 30, fps, config: { damping: 22 } });
  const cta = spring({ frame: frame - 55, fps, config: { damping: 22, stiffness: 140 } });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", padding: 60 }}>
      <div
        style={{
          color: colors.lime,
          fontFamily: display,
          fontSize: 380,
          lineHeight: 0.85,
          transform: `scale(${interpolate(wordIn, [0, 1], [0.7, 1])})`,
          opacity: wordIn,
        }}
      >
        Quottr.
      </div>
      <div style={{ height: 6, width: interpolate(lineIn, [0, 1], [0, 520]), background: colors.lime, marginTop: 20, opacity: 0.8 }} />
      <div
        style={{
          marginTop: 36,
          color: colors.paper,
          fontFamily: display,
          fontSize: 92,
          opacity: tag,
          textAlign: "center",
          lineHeight: 1,
        }}
      >
        You talk.<br /><span style={{ color: colors.lime }}>Quottr quotes.</span>
      </div>
      <div
        style={{
          marginTop: 56,
          opacity: cta,
          transform: `translateY(${interpolate(cta, [0, 1], [20, 0])}px)`,
          background: colors.lime,
          color: colors.ink,
          fontFamily: body,
          fontWeight: 700,
          fontSize: 34,
          padding: "26px 52px",
          borderRadius: 9999,
          letterSpacing: "0.05em",
        }}
      >
        quottr.co.uk · start free
      </div>
    </AbsoluteFill>
  );
};

export const VerticalVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const vignette = interpolate(frame, [16, 32], [0, 1], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill>
      <Backdrop />
      <Sequence from={0} durationInFrames={18}>
        <BrandFlash />
      </Sequence>
      <Sequence from={16}>
        <AbsoluteFill style={{ opacity: vignette }}>
          <TransitionSeries>
            <TransitionSeries.Sequence durationInFrames={110}><V1Hero /></TransitionSeries.Sequence>
            <TransitionSeries.Transition presentation={fade()} timing={springTiming({ durationInFrames: 18, config: { damping: 200 } })} />
            <TransitionSeries.Sequence durationInFrames={160}><V2Voice /></TransitionSeries.Sequence>
            <TransitionSeries.Transition presentation={fade()} timing={springTiming({ durationInFrames: 18, config: { damping: 200 } })} />
            <TransitionSeries.Sequence durationInFrames={170}><V3Quote /></TransitionSeries.Sequence>
            <TransitionSeries.Transition presentation={fade()} timing={springTiming({ durationInFrames: 18, config: { damping: 200 } })} />
            <TransitionSeries.Sequence durationInFrames={130}><V4Send /></TransitionSeries.Sequence>
            <TransitionSeries.Transition presentation={fade()} timing={springTiming({ durationInFrames: 18, config: { damping: 200 } })} />
            <TransitionSeries.Sequence durationInFrames={180}><V5End /></TransitionSeries.Sequence>
          </TransitionSeries>
        </AbsoluteFill>
      </Sequence>
      <Captions />
    </AbsoluteFill>
  );
};
