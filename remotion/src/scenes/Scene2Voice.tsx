import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { colors, display, body } from "../theme";

const Phone: React.FC<{ children: React.ReactNode; entry: number }> = ({ children, entry }) => {
  return (
    <div
      style={{
        width: 520,
        height: 1040,
        borderRadius: 72,
        background: colors.ink,
        border: `10px solid #000`,
        boxShadow: "0 60px 120px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.05)",
        overflow: "hidden",
        position: "relative",
        transform: `translateY(${interpolate(entry, [0, 1], [80, 0])}px) scale(${interpolate(entry, [0, 1], [0.92, 1])})`,
        opacity: entry,
      }}
    >
      <div style={{ position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)", width: 120, height: 30, borderRadius: 9999, background: "#000" }} />
      {children}
    </div>
  );
};

const Bars: React.FC<{ frame: number }> = ({ frame }) => {
  const bars = Array.from({ length: 24 });
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", height: 90 }}>
      {bars.map((_, i) => {
        const h = 20 + Math.abs(Math.sin((frame + i * 7) / 6)) * 60 * (0.4 + Math.sin(i * 0.7) * 0.6);
        return <div key={i} style={{ width: 6, height: h, borderRadius: 4, background: colors.lime, opacity: 0.85 }} />;
      })}
    </div>
  );
};

export const Scene2Voice: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneIn = spring({ frame, fps, config: { damping: 20, stiffness: 130 } });

  const fullText = "Quote Mrs Jones for a new combi boiler and a thermostat upgrade.";
  const chars = Math.floor(interpolate(frame, [30, 120], [0, fullText.length], { extrapolateRight: "clamp" }));
  const typed = fullText.slice(0, chars);

  const labelIn = spring({ frame: frame - 18, fps, config: { damping: 22 } });

  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 120, padding: 80 }}>
      <div style={{ flex: 1, maxWidth: 760, opacity: labelIn }}>
        <div style={{ color: colors.lime, fontFamily: body, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", fontSize: 20 }}>
          Step 01 — Tap & talk
        </div>
        <div style={{ marginTop: 24, color: colors.paper, fontFamily: display, fontSize: 130, lineHeight: 0.95 }}>
          Just say what<br />needs doing.
        </div>
        <div style={{ marginTop: 28, color: colors.mute, fontFamily: body, fontSize: 28, lineHeight: 1.45, maxWidth: 620 }}>
          One hand, gloves on. Quottr listens, understands trade-speak, and turns it straight into a quote.
        </div>
      </div>

      <Phone entry={phoneIn}>
        <div style={{ position: "absolute", inset: 10, borderRadius: 62, background: colors.ink2, display: "flex", flexDirection: "column", padding: "90px 36px 36px" }}>
          <div style={{ color: colors.mute, fontFamily: body, fontSize: 18, letterSpacing: "0.2em", textTransform: "uppercase" }}>New quote</div>
          <div style={{ marginTop: 24, color: colors.paper, fontFamily: body, fontSize: 32, lineHeight: 1.35, minHeight: 280 }}>
            “{typed}
            <span style={{ opacity: (frame % 30) < 15 ? 1 : 0 }}>▍</span>”
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", justifyContent: "center", marginBottom: 30 }}>
            <Bars frame={frame} />
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <div
              style={{
                width: 150,
                height: 150,
                borderRadius: 9999,
                background: colors.lime,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 0 ${10 + Math.sin(frame / 5) * 8}px rgba(207,255,61,0.18), 0 0 0 ${30 + Math.sin(frame / 5) * 16}px rgba(207,255,61,0.08)`,
              }}
            >
              <svg width="62" height="62" viewBox="0 0 24 24" fill={colors.ink}>
                <path d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3z" />
                <path d="M19 11a1 1 0 10-2 0 5 5 0 11-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H8a1 1 0 100 2h8a1 1 0 100-2h-3v-2.08A7 7 0 0019 11z" />
              </svg>
            </div>
          </div>
          <div style={{ marginTop: 14, color: colors.mute, fontFamily: body, fontSize: 16, letterSpacing: "0.3em", textTransform: "uppercase", textAlign: "center" }}>
            Listening…
          </div>
        </div>
      </Phone>
    </AbsoluteFill>
  );
};
