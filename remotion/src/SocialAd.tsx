import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from "remotion";
import { colors, display, body } from "./theme";

// 15s @ 30fps = 450 frames, 1080x1920

const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 60) * 30;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 80% at 50% ${20 + drift}%, ${colors.ink2} 0%, ${colors.ink} 60%, #000 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, rgba(207,255,61,0.04) 0 1px, transparent 1px 80px), repeating-linear-gradient(90deg, rgba(207,255,61,0.04) 0 1px, transparent 1px 80px)`,
          opacity: 0.7,
        }}
      />
    </AbsoluteFill>
  );
};

const Scene1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s1 = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const s2 = spring({ frame: frame - 12, fps, config: { damping: 14, stiffness: 120 } });
  const s3 = spring({ frame: frame - 24, fps, config: { damping: 14, stiffness: 120 } });
  const out = interpolate(frame, [85, 100], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: out, padding: "0 80px", justifyContent: "center" }}>
      <div style={{ transform: `translateY(${(1 - s1) * 40}px)`, opacity: s1 }}>
        <div style={{ fontFamily: body, color: colors.lime, fontSize: 36, letterSpacing: 6, fontWeight: 700 }}>
          STILL QUOTING AT 9PM?
        </div>
      </div>
      <div style={{ transform: `translateY(${(1 - s2) * 60}px)`, opacity: s2, marginTop: 20 }}>
        <div style={{ fontFamily: display, color: colors.paper, fontSize: 220, lineHeight: 0.88, letterSpacing: -2 }}>
          STOP.
        </div>
      </div>
      <div style={{ transform: `translateY(${(1 - s3) * 60}px)`, opacity: s3 }}>
        <div style={{ fontFamily: display, color: colors.lime, fontSize: 220, lineHeight: 0.88, letterSpacing: -2 }}>
          TYPING.
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Mic: React.FC<{ pulse: number }> = ({ pulse }) => (
  <div style={{ position: "relative", width: 260, height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          width: 260 + i * 80 + pulse * 40,
          height: 260 + i * 80 + pulse * 40,
          borderRadius: "50%",
          border: `2px solid ${colors.lime}`,
          opacity: Math.max(0, 0.35 - i * 0.1 - pulse * 0.15),
        }}
      />
    ))}
    <div
      style={{
        width: 220,
        height: 220,
        borderRadius: "50%",
        background: colors.lime,
        boxShadow: `0 0 80px ${colors.lime}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 110,
      }}
    >
      🎤
    </div>
  </div>
);

const Scene2Voice: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18, stiffness: 140 } });
  const pulse = (Math.sin(frame / 6) + 1) / 2;
  const out = interpolate(frame, [105, 120], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const quoteShow = interpolate(frame, [55, 75], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: out, alignItems: "center", justifyContent: "center", gap: 60 }}>
      <div style={{ fontFamily: body, color: colors.mute, fontSize: 28, letterSpacing: 4, fontWeight: 500, opacity: s }}>
        JUST TALK.
      </div>
      <div style={{ transform: `scale(${s})` }}>
        <Mic pulse={pulse} />
      </div>
      <div style={{ opacity: s, textAlign: "center", padding: "0 80px" }}>
        <div style={{ fontFamily: display, color: colors.paper, fontSize: 110, lineHeight: 0.95, letterSpacing: -1 }}>
          "REPLACE A
        </div>
        <div style={{ fontFamily: display, color: colors.paper, fontSize: 110, lineHeight: 0.95, letterSpacing: -1 }}>
          BOILER IN N7."
        </div>
      </div>
      <div
        style={{
          opacity: quoteShow,
          transform: `translateY(${(1 - quoteShow) * 30}px)`,
          background: colors.lime,
          color: colors.ink,
          padding: "20px 40px",
          borderRadius: 100,
          fontFamily: body,
          fontWeight: 700,
          fontSize: 36,
          letterSpacing: 2,
        }}
      >
        QUOTE READY · 18s
      </div>
    </AbsoluteFill>
  );
};

const Scene3Send: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18, stiffness: 140 } });
  const tick = spring({ frame: frame - 40, fps, config: { damping: 8, stiffness: 200 } });
  const out = interpolate(frame, [105, 120], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: out, alignItems: "center", justifyContent: "center", padding: "0 80px" }}>
      <div style={{ opacity: s, transform: `translateY(${(1 - s) * 40}px)`, textAlign: "center" }}>
        <div style={{ fontFamily: body, color: colors.lime, fontSize: 32, letterSpacing: 5, fontWeight: 700, marginBottom: 30 }}>
          SEND IT ON
        </div>
        <div style={{ fontFamily: display, color: colors.paper, fontSize: 260, lineHeight: 0.9 }}>
          WHATSAPP.
        </div>
      </div>
      <div
        style={{
          marginTop: 80,
          opacity: tick,
          transform: `scale(${tick})`,
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: colors.lime,
          color: colors.ink,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 110,
          fontWeight: 900,
          boxShadow: `0 0 100px ${colors.lime}`,
        }}
      >
        ✓
      </div>
      <div
        style={{
          marginTop: 40,
          opacity: tick,
          fontFamily: body,
          fontWeight: 700,
          color: colors.paper,
          fontSize: 38,
          letterSpacing: 1,
        }}
      >
        Customer pays the deposit.
      </div>
    </AbsoluteFill>
  );
};

const Scene4End: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const s2 = spring({ frame: frame - 18, fps, config: { damping: 14 } });
  const s3 = spring({ frame: frame - 36, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: "0 80px", gap: 30 }}>
      <div style={{ opacity: s, transform: `scale(${0.8 + s * 0.2})` }}>
        <div
          style={{
            fontFamily: display,
            fontSize: 320,
            color: colors.lime,
            letterSpacing: -4,
            lineHeight: 1,
            textShadow: `0 0 80px rgba(207,255,61,0.4)`,
          }}
        >
          QUOTTR.
        </div>
      </div>
      <div style={{ opacity: s2, transform: `translateY(${(1 - s2) * 30}px)`, textAlign: "center" }}>
        <div style={{ fontFamily: display, color: colors.paper, fontSize: 90, lineHeight: 1, letterSpacing: -1 }}>
          QUOTE FAST.
        </div>
        <div style={{ fontFamily: display, color: colors.paper, fontSize: 90, lineHeight: 1, letterSpacing: -1 }}>
          GET PAID FASTER.
        </div>
      </div>
      <div
        style={{
          marginTop: 50,
          opacity: s3,
          fontFamily: body,
          color: colors.mute,
          fontSize: 34,
          letterSpacing: 6,
          fontWeight: 500,
        }}
      >
        QUOTTR.CO.UK · 14 DAYS FREE
      </div>
    </AbsoluteFill>
  );
};

export const SocialAd: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: colors.ink, fontFamily: body }}>
      <Backdrop />
      <Sequence from={0} durationInFrames={110}>
        <Scene1Hook />
      </Sequence>
      <Sequence from={100} durationInFrames={130}>
        <Scene2Voice />
      </Sequence>
      <Sequence from={220} durationInFrames={130}>
        <Scene3Send />
      </Sequence>
      <Sequence from={340} durationInFrames={110}>
        <Scene4End />
      </Sequence>
    </AbsoluteFill>
  );
};
