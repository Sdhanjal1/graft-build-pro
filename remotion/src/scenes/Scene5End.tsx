import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { colors, display, body } from "../theme";

export const Scene5End: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const wordIn = spring({ frame, fps, config: { damping: 16, stiffness: 110 } });
  const wordScale = interpolate(wordIn, [0, 1], [0.7, 1]);
  const wordOpacity = interpolate(wordIn, [0, 1], [0, 1]);

  const lineIn = spring({ frame: frame - 18, fps, config: { damping: 22 } });
  const lineWidth = interpolate(lineIn, [0, 1], [0, 600]);

  const tag = spring({ frame: frame - 30, fps, config: { damping: 22 } });
  const ctaIn = spring({ frame: frame - 55, fps, config: { damping: 22, stiffness: 140 } });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <div
        style={{
          color: colors.lime,
          fontFamily: display,
          fontSize: 360,
          lineHeight: 0.85,
          transform: `scale(${wordScale})`,
          opacity: wordOpacity,
          letterSpacing: "-0.01em",
        }}
      >
        Quottr.
      </div>

      <div style={{ height: 4, width: lineWidth, background: colors.lime, marginTop: 16, opacity: 0.7 }} />

      <div
        style={{
          marginTop: 28,
          color: colors.paper,
          fontFamily: display,
          fontSize: 80,
          opacity: tag,
          textAlign: "center",
          lineHeight: 1,
        }}
      >
        You talk. <span style={{ color: colors.lime }}>Quottr quotes.</span>
      </div>

      <div
        style={{
          marginTop: 40,
          opacity: ctaIn,
          transform: `translateY(${interpolate(ctaIn, [0, 1], [20, 0])}px)`,
          background: colors.lime,
          color: colors.ink,
          fontFamily: body,
          fontWeight: 700,
          fontSize: 26,
          padding: "20px 40px",
          borderRadius: 9999,
          letterSpacing: "0.05em",
        }}
      >
        quottr.co.uk · start free
      </div>
    </AbsoluteFill>
  );
};
