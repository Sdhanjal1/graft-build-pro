import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { colors, display, body } from "../theme";

const Bubble: React.FC<{ text: string; entry: number; align?: "left" | "right" }> = ({ text, entry, align = "left" }) => {
  const isRight = align === "right";
  return (
    <div
      style={{
        alignSelf: isRight ? "flex-end" : "flex-start",
        maxWidth: 420,
        background: isRight ? colors.lime : "rgba(255,255,255,0.08)",
        color: isRight ? colors.ink : colors.paper,
        fontFamily: body,
        fontSize: 22,
        lineHeight: 1.35,
        padding: "16px 22px",
        borderRadius: 22,
        borderBottomRightRadius: isRight ? 6 : 22,
        borderBottomLeftRadius: isRight ? 22 : 6,
        transform: `translateY(${interpolate(entry, [0, 1], [20, 0])}px) scale(${interpolate(entry, [0, 1], [0.9, 1])})`,
        opacity: entry,
        boxShadow: isRight ? "0 8px 30px rgba(207,255,61,0.25)" : "none",
      }}
    >
      {text}
    </div>
  );
};

export const Scene4Send: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerIn = spring({ frame, fps, config: { damping: 22 } });
  const b1 = spring({ frame: frame - 12, fps, config: { damping: 18, stiffness: 140 } });
  const b2 = spring({ frame: frame - 36, fps, config: { damping: 18, stiffness: 140 } });
  const b3 = spring({ frame: frame - 60, fps, config: { damping: 18, stiffness: 140 } });
  const paidIn = spring({ frame: frame - 88, fps, config: { damping: 10, stiffness: 130 } });

  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 100, padding: 80 }}>
      <div style={{ flex: 1, maxWidth: 640, opacity: headerIn }}>
        <div style={{ color: colors.lime, fontFamily: body, fontWeight: 700, letterSpacing: "0.25em", textTransform: "uppercase", fontSize: 20 }}>
          Step 03 — Send & get paid
        </div>
        <div style={{ marginTop: 24, color: colors.paper, fontFamily: display, fontSize: 130, lineHeight: 0.95 }}>
          One tap.<br /><span style={{ color: colors.lime }}>Money in.</span>
        </div>
        <div style={{ marginTop: 28, color: colors.mute, fontFamily: body, fontSize: 26, lineHeight: 1.45 }}>
          Quottr opens WhatsApp with the message pre-written. Customer taps the link, pays the deposit, you crack on.
        </div>
      </div>

      <div
        style={{
          width: 560,
          background: colors.ink2,
          border: `1px solid rgba(255,255,255,0.08)`,
          borderRadius: 32,
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          boxShadow: "0 60px 120px rgba(0,0,0,0.55)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ width: 48, height: 48, borderRadius: 9999, background: colors.lime, display: "flex", alignItems: "center", justifyContent: "center", color: colors.ink, fontFamily: display, fontSize: 28 }}>MJ</div>
          <div>
            <div style={{ color: colors.paper, fontFamily: body, fontSize: 22, fontWeight: 600 }}>Mrs Jones</div>
            <div style={{ color: colors.mute, fontFamily: body, fontSize: 14 }}>via WhatsApp · just now</div>
          </div>
        </div>

        <Bubble entry={b1} text="Hi Mrs Jones 👋 Your quote from Cosy Plumbing is ready. Total £3,534 inc VAT." align="right" />
        <Bubble entry={b2} text="View, approve and pay your deposit here: quottr.co.uk/portal/8H4K" align="right" />
        <Bubble entry={b3} text="Lovely — just paid the deposit. See you Tuesday 🙏" />

        <div
          style={{
            marginTop: 8,
            background: colors.lime,
            color: colors.ink,
            borderRadius: 18,
            padding: "18px 22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: paidIn,
            transform: `scale(${interpolate(paidIn, [0, 1], [0.9, 1])})`,
            boxShadow: `0 0 0 ${6 + Math.sin(frame / 6) * 4}px rgba(207,255,61,0.18)`,
          }}
        >
          <div>
            <div style={{ fontFamily: body, fontSize: 14, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 700, opacity: 0.7 }}>Deposit received</div>
            <div style={{ fontFamily: display, fontSize: 44, lineHeight: 1 }}>£883.50</div>
          </div>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};
