import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { colors, display } from "../theme";

// Burned-in captions synced to the global timeline.
// Most viewers watch on mute — these carry the story silently.
type Cue = { from: number; to: number; text: string; accent?: string };

const cues: Cue[] = [
  { from: 110, to: 270, text: "Speak the job" },
  { from: 270, to: 440, text: "Quote ready", accent: "in seconds" },
  { from: 440, to: 570, text: "Send on WhatsApp", accent: "customer pays the deposit" },
];

const Cue: React.FC<{ cue: Cue; frame: number }> = ({ cue, frame }) => {
  const local = frame - cue.from;
  const span = cue.to - cue.from;
  const inOp = interpolate(local, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const outOp = interpolate(local, [span - 14, span], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(inOp, outOp);
  const y = interpolate(local, [0, 14], [24, 0], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 72,
        display: "flex",
        justifyContent: "center",
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          background: "rgba(14,15,12,0.82)",
          border: `1px solid rgba(207,255,61,0.25)`,
          padding: "18px 36px",
          borderRadius: 18,
        }}
      >
        <span
          style={{
            color: colors.paper,
            fontFamily: display,
            fontSize: 56,
            lineHeight: 1,
            letterSpacing: "0.01em",
          }}
        >
          {cue.text}{" "}
          {cue.accent && <span style={{ color: colors.lime }}>{cue.accent}.</span>}
        </span>
      </div>
    </div>
  );
};

export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const active = cues.find((c) => frame >= c.from && frame < c.to);
  if (!active) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <Cue cue={active} frame={frame} />
    </AbsoluteFill>
  );
};
