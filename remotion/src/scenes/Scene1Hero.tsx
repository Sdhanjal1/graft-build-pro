import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { colors, display, body } from "../theme";

export const Scene1Hero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const wordIn = spring({ frame, fps, config: { damping: 18, stiffness: 110 } });
  const wordY = interpolate(wordIn, [0, 1], [80, 0]);
  const wordOpacity = interpolate(wordIn, [0, 1], [0, 1]);

  const tag = spring({ frame: frame - 22, fps, config: { damping: 22, stiffness: 130 } });
  const tagY = interpolate(tag, [0, 1], [40, 0]);

  const dot = (frame % 30) / 30;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: interpolate(frame, [0, 18], [0, 1]) }}>
        <div style={{ width: 10, height: 10, borderRadius: 9999, background: colors.lime, opacity: 0.4 + dot * 0.6 }} />
        <span style={{ color: colors.paper, fontFamily: body, fontWeight: 600, letterSpacing: "0.25em", fontSize: 22, textTransform: "uppercase", opacity: 0.7 }}>
          Voice-first for trades
        </span>
      </div>

      <div
        style={{
          marginTop: 40,
          color: colors.lime,
          fontFamily: display,
          fontSize: 420,
          lineHeight: 0.8,
          letterSpacing: "-0.01em",
          transform: `translateY(${wordY}px)`,
          opacity: wordOpacity,
        }}
      >
        Quottr.
      </div>

      <div
        style={{
          marginTop: 24,
          color: colors.paper,
          fontFamily: display,
          fontSize: 72,
          lineHeight: 1,
          transform: `translateY(${tagY}px)`,
          opacity: interpolate(tag, [0, 1], [0, 1]),
        }}
      >
        You talk. <span style={{ color: colors.lime }}>Quottr quotes.</span>
      </div>
    </AbsoluteFill>
  );
};
