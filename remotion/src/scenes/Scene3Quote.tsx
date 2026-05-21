import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { colors, display, body } from "../theme";

const items = [
  { label: "Worcester Greenstar 30i combi boiler — supply & fit", price: "1,840.00" },
  { label: "Hive Active Heating thermostat — install & commission", price: "245.00" },
  { label: "Magnetic system filter + chemical flush", price: "320.00" },
  { label: "Labour — 1.5 days, two engineers", path: "label", price: "540.00" },
];

export const Scene3Quote: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const paperIn = spring({ frame, fps, config: { damping: 22, stiffness: 140 } });
  const headerIn = spring({ frame: frame - 8, fps, config: { damping: 22 } });

  const totalIn = spring({ frame: frame - 95, fps, config: { damping: 12, stiffness: 140 } });

  // typewriter total
  const stamp = spring({ frame: frame - 120, fps, config: { damping: 8, stiffness: 120 } });

  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 100, padding: 80 }}>
      <div style={{ flex: 1, maxWidth: 620, opacity: headerIn }}>
        <div style={{ color: colors.lime, fontFamily: body, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", fontSize: 20 }}>
          Step 02 — Quote written
        </div>
        <div style={{ marginTop: 24, color: colors.paper, fontFamily: display, fontSize: 130, lineHeight: 0.95 }}>
          Priced.<br />Branded.<br /><span style={{ color: colors.lime }}>Done.</span>
        </div>
        <div style={{ marginTop: 28, color: colors.mute, fontFamily: body, fontSize: 26, lineHeight: 1.45 }}>
          Line items, VAT, deposit terms — drafted in seconds with your logo on top.
        </div>
      </div>

      <div
        style={{
          width: 720,
          background: colors.paper,
          color: colors.ink,
          borderRadius: 24,
          padding: 56,
          boxShadow: "0 60px 120px rgba(0,0,0,0.55)",
          transform: `translateY(${interpolate(paperIn, [0, 1], [60, 0])}px) scale(${interpolate(paperIn, [0, 1], [0.94, 1])})`,
          opacity: paperIn,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 24, borderBottom: `1px solid rgba(14,15,12,0.12)` }}>
          <div style={{ fontFamily: display, fontSize: 60, lineHeight: 0.9 }}>QUOTE</div>
          <div style={{ fontFamily: body, fontSize: 16, textAlign: "right", opacity: 0.7 }}>
            #Q-2048 · 21 May 2026<br />Cosy Plumbing & Heating
          </div>
        </div>

        <div style={{ marginTop: 28, fontFamily: body, fontSize: 18, opacity: 0.7 }}>For</div>
        <div style={{ fontFamily: display, fontSize: 40, lineHeight: 1 }}>Mrs Jones · 14 Beech Avenue</div>

        <div style={{ marginTop: 32 }}>
          {items.map((it, i) => {
            const enter = spring({ frame: frame - 20 - i * 12, fps, config: { damping: 22, stiffness: 160 } });
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: "16px 0",
                  borderBottom: `1px solid rgba(14,15,12,0.08)`,
                  opacity: enter,
                  transform: `translateX(${interpolate(enter, [0, 1], [-30, 0])}px)`,
                }}
              >
                <div style={{ fontFamily: body, fontSize: 22, paddingRight: 24 }}>{it.label}</div>
                <div style={{ fontFamily: display, fontSize: 30, letterSpacing: "0.02em" }}>£{it.price}</div>
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
            borderRadius: 16,
            padding: "26px 32px",
            opacity: totalIn,
            transform: `scale(${interpolate(totalIn, [0, 1], [0.95, 1])})`,
          }}
        >
          <div style={{ fontFamily: body, fontSize: 18, letterSpacing: "0.25em", textTransform: "uppercase", opacity: 0.7 }}>Total inc. VAT</div>
          <div style={{ fontFamily: display, fontSize: 64, color: colors.lime }}>£3,534.00</div>
        </div>

        <div
          style={{
            marginTop: 24,
            display: "inline-block",
            transform: `rotate(${interpolate(stamp, [0, 1], [-25, -8])}deg) scale(${interpolate(stamp, [0, 1], [1.6, 1])})`,
            opacity: stamp,
            border: `4px solid ${colors.limeDim}`,
            color: colors.limeDim,
            fontFamily: display,
            fontSize: 42,
            padding: "8px 22px",
            letterSpacing: "0.08em",
            borderRadius: 12,
          }}
        >
          READY TO SEND
        </div>
      </div>
    </AbsoluteFill>
  );
};
