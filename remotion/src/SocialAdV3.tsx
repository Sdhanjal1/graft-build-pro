import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from "remotion";
import { colors, display, body } from "./theme";

// 30s @ 30fps = 900 frames, 1080x1920
// Visual-only (no audio). Music/SFX to be added later via ElevenLabs.

// ---------- Persistent layered background ----------
const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.08 }) => {
  // CSS-only noise via layered repeating gradients (cheap, render-safe)
  const frame = useCurrentFrame();
  const shift = (frame * 1.3) % 7;
  return (
    <AbsoluteFill
      style={{
        opacity,
        mixBlendMode: "overlay",
        backgroundImage: `
          repeating-radial-gradient(circle at ${20 + shift}% ${30 - shift}%, rgba(255,255,255,0.6) 0 1px, transparent 1px 3px),
          repeating-radial-gradient(circle at ${70 - shift}% ${60 + shift}%, rgba(0,0,0,0.6) 0 1px, transparent 1px 3px)
        `,
      }}
    />
  );
};

const PersistentBg: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 80) * 40;
  const drift2 = Math.cos(frame / 100) * 60;
  return (
    <AbsoluteFill>
      {/* Base gradient */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(140% 100% at ${50 + drift / 4}% ${30 + drift / 2}%, ${colors.ink2} 0%, ${colors.ink} 55%, #000 100%)`,
        }}
      />
      {/* Lime parallax blob */}
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: `${-15 + drift2 / 4}%`,
            top: `${60 + drift / 4}%`,
            width: 800,
            height: 800,
            borderRadius: "50%",
            background: `radial-gradient(closest-side, ${colors.lime}26, transparent 70%)`,
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: `${-20 - drift / 5}%`,
            top: `${-10 + drift2 / 6}%`,
            width: 700,
            height: 700,
            borderRadius: "50%",
            background: `radial-gradient(closest-side, ${colors.lime}1A, transparent 70%)`,
            filter: "blur(30px)",
          }}
        />
      </AbsoluteFill>
      {/* Grid texture, very faint */}
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, rgba(207,255,61,0.035) 0 1px, transparent 1px 90px), repeating-linear-gradient(90deg, rgba(207,255,61,0.035) 0 1px, transparent 1px 90px)`,
          opacity: 0.7,
        }}
      />
      <Grain />
      {/* Vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 80% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// ---------- Helpers ----------
const KineticChars: React.FC<{
  text: string;
  startFrame?: number;
  color?: string;
  size?: number;
  weight?: number;
  family?: string;
  letterSpacing?: number;
  lineHeight?: number;
  stagger?: number;
  fromY?: number;
}> = ({
  text,
  startFrame = 0,
  color = colors.paper,
  size = 200,
  weight,
  family = display,
  letterSpacing = -2,
  lineHeight = 0.88,
  stagger = 2,
  fromY = 60,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", lineHeight }}>
      {text.split("").map((ch, i) => {
        const s = spring({
          frame: frame - startFrame - i * stagger,
          fps,
          config: { damping: 14, stiffness: 140 },
        });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              fontFamily: family,
              color,
              fontSize: size,
              fontWeight: weight as number | undefined,
              letterSpacing,
              transform: `translateY(${(1 - s) * fromY}px)`,
              opacity: s,
              whiteSpace: "pre",
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};

// ---------- Scene 1: Hook (0-90, 3s) ----------
const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const eyebrow = spring({ frame, fps, config: { damping: 18, stiffness: 140 } });
  const out = interpolate(frame, [78, 90], [1, 0], { extrapolateRight: "clamp" });
  // Camera-like push
  const scale = interpolate(frame, [0, 90], [1, 1.08]);
  return (
    <AbsoluteFill
      style={{
        opacity: out,
        padding: "0 80px",
        justifyContent: "center",
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          transform: `translateY(${(1 - eyebrow) * 30}px)`,
          opacity: eyebrow,
          fontFamily: body,
          color: colors.lime,
          fontSize: 38,
          letterSpacing: 8,
          fontWeight: 700,
          marginBottom: 28,
        }}
      >
        STILL QUOTING AT 9PM?
      </div>
      <KineticChars text="STOP" startFrame={10} size={300} fromY={80} />
      <div style={{ marginTop: -10 }}>
        <KineticChars
          text="TYPING."
          startFrame={28}
          size={300}
          color={colors.lime}
          fromY={80}
        />
      </div>
    </AbsoluteFill>
  );
};

// ---------- Scene 2: Solution (90-210, 4s) ----------
const Waveform: React.FC<{ bars?: number }> = ({ bars = 32 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, height: 120 }}>
      {Array.from({ length: bars }).map((_, i) => {
        const phase = i * 0.4;
        const h =
          40 +
          Math.abs(Math.sin(frame / 6 + phase)) * 60 +
          Math.abs(Math.sin(frame / 11 + phase * 0.7)) * 30;
        return (
          <div
            key={i}
            style={{
              width: 8,
              height: h,
              borderRadius: 4,
              background: colors.lime,
              opacity: 0.85,
            }}
          />
        );
      })}
    </div>
  );
};

const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 18, stiffness: 130 } });
  const out = interpolate(frame, [105, 120], [1, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill
      style={{
        opacity: out,
        padding: "0 80px",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ transform: `scale(${0.9 + s * 0.1})`, opacity: s }}>
        <div
          style={{
            fontFamily: body,
            color: colors.mute,
            fontSize: 34,
            letterSpacing: 6,
            fontWeight: 700,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          INSTEAD
        </div>
      </div>
      <KineticChars text="JUST" startFrame={6} size={260} fromY={70} />
      <div style={{ marginTop: -10 }}>
        <KineticChars
          text="TALK."
          startFrame={22}
          size={260}
          color={colors.lime}
          fromY={70}
        />
      </div>
      <div style={{ marginTop: 50, opacity: interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" }) }}>
        <Waveform />
      </div>
    </AbsoluteFill>
  );
};

// ---------- iPhone mock + Quote demo (210-540, 11s) ----------
const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div
      style={{
        width: 680,
        height: 1380,
        borderRadius: 80,
        background: "#0a0b08",
        boxShadow:
          "0 60px 140px rgba(0,0,0,0.7), 0 0 0 14px #1a1c14, 0 0 0 16px #2a2d22",
        padding: 18,
        position: "relative",
      }}
    >
      {/* Notch */}
      <div
        style={{
          position: "absolute",
          top: 22,
          left: "50%",
          transform: "translateX(-50%)",
          width: 180,
          height: 36,
          background: "#000",
          borderRadius: 20,
          zIndex: 5,
        }}
      />
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 64,
          background: colors.ink,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
};

const QuoteLineItem: React.FC<{
  label: string;
  amount: string;
  appearAt: number;
}> = ({ label, amount, appearAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - appearAt,
    fps,
    config: { damping: 16, stiffness: 160 },
  });
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "18px 24px",
        borderBottom: `1px solid ${colors.paper}14`,
        opacity: s,
        transform: `translateX(${(1 - s) * -30}px)`,
      }}
    >
      <div
        style={{
          fontFamily: body,
          color: colors.paper,
          fontSize: 26,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: body,
          color: colors.lime,
          fontSize: 26,
          fontWeight: 700,
        }}
      >
        {amount}
      </div>
    </div>
  );
};

const PhoneQuoteScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Voice waveform (0-60), then quote items appear (60-180), then total (180-200), then send (200+)
  const waveOpacity = interpolate(frame, [0, 10, 60, 75], [0, 1, 1, 0], {
    extrapolateRight: "clamp",
  });
  const quoteOpacity = interpolate(frame, [55, 75], [0, 1], {
    extrapolateRight: "clamp",
  });
  const total = Math.min(
    1240,
    Math.floor(interpolate(frame, [180, 210], [0, 1240], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))
  );
  const sendPulse = spring({
    frame: frame - 240,
    fps,
    config: { damping: 12, stiffness: 180 },
  });

  return (
    <AbsoluteFill style={{ background: colors.ink }}>
      {/* Status bar */}
      <div
        style={{
          padding: "60px 36px 0",
          display: "flex",
          justifyContent: "space-between",
          fontFamily: body,
          color: colors.paper,
          fontSize: 22,
          fontWeight: 600,
        }}
      >
        <span>9:41</span>
        <span>QUOTTR</span>
      </div>

      {/* Voice prompt + waveform */}
      <div
        style={{
          opacity: waveOpacity,
          position: "absolute",
          top: 200,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
        }}
      >
        <div
          style={{
            fontFamily: body,
            color: colors.mute,
            fontSize: 22,
            letterSpacing: 4,
            fontWeight: 700,
          }}
        >
          LISTENING
        </div>
        <div
          style={{
            fontFamily: body,
            color: colors.paper,
            fontSize: 28,
            fontWeight: 500,
            textAlign: "center",
            padding: "0 50px",
            lineHeight: 1.3,
          }}
        >
          "Replace a combi boiler in N7,
          <br />
          add a power flush..."
        </div>
        <div style={{ marginTop: 20 }}>
          <Waveform bars={24} />
        </div>
      </div>

      {/* Quote builds */}
      <div
        style={{
          opacity: quoteOpacity,
          position: "absolute",
          top: 130,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <div
          style={{
            padding: "20px 28px 12px",
            fontFamily: body,
            color: colors.mute,
            fontSize: 20,
            letterSpacing: 3,
            fontWeight: 700,
          }}
        >
          QUOTE · #00428
        </div>
        <div
          style={{
            padding: "0 28px 20px",
            fontFamily: display,
            color: colors.paper,
            fontSize: 56,
            letterSpacing: -1,
            lineHeight: 1,
          }}
        >
          BOILER REPLACEMENT
        </div>
        <div
          style={{
            padding: "0 28px",
            fontFamily: body,
            color: colors.mute,
            fontSize: 22,
            marginBottom: 24,
          }}
        >
          15 Mayfield Rd, London N7
        </div>

        <QuoteLineItem label="Worcester 30i combi" amount="£820" appearAt={80} />
        <QuoteLineItem label="Labour (1.5 days)" amount="£280" appearAt={105} />
        <QuoteLineItem label="Power flush" amount="£90" appearAt={130} />
        <QuoteLineItem label="System chemicals" amount="£50" appearAt={155} />

        {/* Total */}
        <div
          style={{
            margin: "32px 28px 0",
            padding: "26px 28px",
            background: `${colors.lime}1F`,
            borderRadius: 20,
            border: `2px solid ${colors.lime}66`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            opacity: interpolate(frame, [175, 195], [0, 1], { extrapolateRight: "clamp" }),
            transform: `scale(${interpolate(frame, [175, 195], [0.9, 1], { extrapolateRight: "clamp" })})`,
          }}
        >
          <div
            style={{
              fontFamily: body,
              color: colors.paper,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 3,
            }}
          >
            TOTAL
          </div>
          <div
            style={{
              fontFamily: display,
              color: colors.lime,
              fontSize: 72,
              letterSpacing: -1,
            }}
          >
            £{total.toLocaleString()}
          </div>
        </div>

        {/* Send button */}
        <div
          style={{
            margin: "40px 28px 0",
            padding: "26px",
            background: colors.lime,
            borderRadius: 22,
            textAlign: "center",
            fontFamily: body,
            color: colors.ink,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 2,
            opacity: interpolate(frame, [215, 235], [0, 1], { extrapolateRight: "clamp" }),
            transform: `scale(${1 + sendPulse * 0.04})`,
            boxShadow: `0 20px 60px ${colors.lime}66`,
          }}
        >
          SEND VIA WHATSAPP →
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Scene3Phone: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Phone slides up and tilts in
  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const tilt = interpolate(enter, [0, 1], [8, 0]);
  const out = interpolate(frame, [310, 330], [1, 0], { extrapolateRight: "clamp" });

  // Side label "18 SECONDS"
  const labelIn = spring({ frame: frame - 50, fps, config: { damping: 16, stiffness: 140 } });

  return (
    <AbsoluteFill
      style={{
        opacity: out,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 40,
          transform: `translateY(${(1 - enter) * 200}px) rotate(${tilt}deg)`,
          opacity: enter,
        }}
      >
        {/* Left side label */}
        <div
          style={{
            opacity: labelIn,
            transform: `translateX(${(1 - labelIn) * -40}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 12,
          }}
        >
          <div
            style={{
              fontFamily: body,
              color: colors.lime,
              fontSize: 24,
              letterSpacing: 6,
              fontWeight: 700,
            }}
          >
            START TO FINISH
          </div>
          <div
            style={{
              fontFamily: display,
              color: colors.paper,
              fontSize: 160,
              letterSpacing: -2,
              lineHeight: 0.85,
            }}
          >
            18s
          </div>
        </div>

        <PhoneFrame>
          <PhoneQuoteScreen />
        </PhoneFrame>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Scene 4: WhatsApp delivery (540-660, 4s) ----------
const Scene4WhatsApp: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bubbleS = spring({ frame, fps, config: { damping: 14, stiffness: 160 } });
  const tick1 = interpolate(frame, [25, 35], [0, 1], { extrapolateRight: "clamp" });
  const tick2 = interpolate(frame, [45, 55], [0, 1], { extrapolateRight: "clamp" });
  const depositS = spring({ frame: frame - 65, fps, config: { damping: 12, stiffness: 140 } });
  const out = interpolate(frame, [105, 120], [1, 0], { extrapolateRight: "clamp" });
  const cashPulse = 1 + Math.sin(frame / 4) * 0.02 * Math.max(0, depositS);

  return (
    <AbsoluteFill
      style={{
        opacity: out,
        padding: "0 80px",
        justifyContent: "center",
        alignItems: "center",
        gap: 60,
      }}
    >
      {/* WhatsApp-style bubble */}
      <div
        style={{
          transform: `scale(${bubbleS}) translateY(${(1 - bubbleS) * 60}px)`,
          opacity: bubbleS,
          background: "#005C4B",
          borderRadius: 24,
          padding: "32px 40px",
          maxWidth: 720,
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          position: "relative",
        }}
      >
        <div
          style={{
            fontFamily: body,
            color: "#E9FFF5",
            fontSize: 30,
            fontWeight: 500,
            lineHeight: 1.3,
          }}
        >
          Quote attached. £1,240 all-in.
          <br />
          Deposit link inside →
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 6,
            marginTop: 16,
            fontFamily: body,
            color: "#A5D6C7",
            fontSize: 20,
          }}
        >
          <span>09:42</span>
          <span style={{ opacity: tick1, color: "#53BDEB", fontSize: 24 }}>✓</span>
          <span style={{ opacity: tick2, color: "#53BDEB", fontSize: 24, marginLeft: -10 }}>
            ✓
          </span>
        </div>
      </div>

      {/* Deposit confirmation card */}
      <div
        style={{
          transform: `scale(${cashPulse}) translateY(${(1 - depositS) * 80}px)`,
          opacity: depositS,
          background: colors.lime,
          borderRadius: 28,
          padding: "40px 56px",
          textAlign: "center",
          boxShadow: `0 30px 80px ${colors.lime}55`,
        }}
      >
        <div
          style={{
            fontFamily: body,
            color: colors.ink,
            fontSize: 24,
            letterSpacing: 4,
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          DEPOSIT RECEIVED
        </div>
        <div
          style={{
            fontFamily: display,
            color: colors.ink,
            fontSize: 140,
            letterSpacing: -2,
            lineHeight: 0.9,
          }}
        >
          +£200
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Scene 5: Testimonial (660-780, 4s) ----------
const Scene5Testimonial: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const quoteS = spring({ frame, fps, config: { damping: 18, stiffness: 110 } });
  const nameS = spring({ frame: frame - 30, fps, config: { damping: 18, stiffness: 130 } });
  const out = interpolate(frame, [105, 120], [1, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill
      style={{
        opacity: out,
        padding: "0 90px",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          opacity: quoteS,
          transform: `translateY(${(1 - quoteS) * 40}px)`,
          fontFamily: display,
          color: colors.paper,
          fontSize: 110,
          lineHeight: 0.95,
          letterSpacing: -1,
        }}
      >
        "SAVED ME{" "}
        <span style={{ color: colors.lime }}>6 HOURS</span>
        {" "}A WEEK."
      </div>
      <div
        style={{
          marginTop: 60,
          display: "flex",
          alignItems: "center",
          gap: 24,
          opacity: nameS,
          transform: `translateX(${(1 - nameS) * 40}px)`,
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 90,
            height: 90,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${colors.lime}, ${colors.limeDim})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: display,
            color: colors.ink,
            fontSize: 44,
          }}
        >
          D
        </div>
        <div>
          <div
            style={{
              fontFamily: body,
              color: colors.paper,
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            Dave M.
          </div>
          <div
            style={{
              fontFamily: body,
              color: colors.mute,
              fontSize: 24,
              fontWeight: 500,
            }}
          >
            Plumber · Leeds
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Scene 6: Rapid-fire benefits (780-870, 3s) ----------
const Benefit: React.FC<{ word: string; start: number; end: number; color?: string }> = ({
  word,
  start,
  end,
  color = colors.paper,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inS = spring({ frame: frame - start, fps, config: { damping: 12, stiffness: 220 } });
  const out = interpolate(frame, [end - 4, end], [1, 0], { extrapolateRight: "clamp" });
  const visible = frame >= start && frame <= end;
  if (!visible) return null;
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: out,
      }}
    >
      <div
        style={{
          fontFamily: display,
          color,
          fontSize: 280,
          letterSpacing: -3,
          transform: `scale(${0.85 + inS * 0.15})`,
        }}
      >
        {word}
      </div>
    </AbsoluteFill>
  );
};

const Scene6Rapid: React.FC = () => {
  // Each beat ~25 frames
  return (
    <AbsoluteFill>
      <Benefit word="FASTER." start={0} end={25} color={colors.paper} />
      <Benefit word="CLEANER." start={25} end={50} color={colors.lime} />
      <Benefit word="PAID." start={50} end={90} color={colors.paper} />
    </AbsoluteFill>
  );
};

// ---------- Scene 7: End card (870-900, 1s) — actually we'll give it more ----------
const Scene7End: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoS = spring({ frame, fps, config: { damping: 14, stiffness: 130 } });
  const taglineS = spring({ frame: frame - 18, fps, config: { damping: 18, stiffness: 140 } });
  const urlS = spring({ frame: frame - 32, fps, config: { damping: 18, stiffness: 140 } });
  const breath = 1 + Math.sin(frame / 18) * 0.015;
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "0 80px",
      }}
    >
      <div
        style={{
          opacity: logoS,
          transform: `scale(${logoS * breath})`,
          fontFamily: display,
          color: colors.paper,
          fontSize: 340,
          letterSpacing: -4,
          lineHeight: 0.9,
          textShadow: `0 0 60px ${colors.lime}55`,
        }}
      >
        QUOTTR
        <span style={{ color: colors.lime }}>.</span>
      </div>

      <div
        style={{
          opacity: taglineS,
          transform: `translateY(${(1 - taglineS) * 20}px)`,
          marginTop: 12,
          fontFamily: body,
          color: colors.paper,
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: 4,
          textAlign: "center",
        }}
      >
        QUOTE FAST. GET PAID FASTER.
      </div>

      <div
        style={{
          opacity: urlS,
          transform: `translateY(${(1 - urlS) * 20}px)`,
          marginTop: 70,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
      >
        {/* Faux QR — pure CSS grid pattern, looks scannable in motion */}
        <div
          style={{
            width: 240,
            height: 240,
            background: colors.paper,
            borderRadius: 16,
            padding: 14,
            position: "relative",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: colors.ink,
              backgroundImage: `
                repeating-conic-gradient(${colors.ink} 0% 25%, ${colors.paper} 0% 50%) 0 0 / 22px 22px
              `,
              borderRadius: 6,
              position: "relative",
            }}
          >
            {/* Corner markers */}
            {[
              { top: 6, left: 6 },
              { top: 6, right: 6 },
              { bottom: 6, left: 6 },
            ].map((p, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: 44,
                  height: 44,
                  background: colors.paper,
                  border: `8px solid ${colors.ink}`,
                  ...p,
                }}
              />
            ))}
          </div>
        </div>

        <div
          style={{
            fontFamily: body,
            color: colors.lime,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 3,
          }}
        >
          QUOTTR.CO.UK
        </div>
        <div
          style={{
            fontFamily: body,
            color: colors.mute,
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: 2,
          }}
        >
          14 DAYS FREE · NO CARD
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- Main composition ----------
export const SocialAdV2: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <PersistentBg />

      <Sequence from={0} durationInFrames={90}>
        <Scene1 />
      </Sequence>
      <Sequence from={90} durationInFrames={120}>
        <Scene2 />
      </Sequence>
      <Sequence from={210} durationInFrames={330}>
        <Scene3Phone />
      </Sequence>
      <Sequence from={540} durationInFrames={120}>
        <Scene4WhatsApp />
      </Sequence>
      <Sequence from={660} durationInFrames={120}>
        <Scene5Testimonial />
      </Sequence>
      <Sequence from={780} durationInFrames={90}>
        <Scene6Rapid />
      </Sequence>
      <Sequence from={870} durationInFrames={120}>
        <Scene7End />
      </Sequence>
    </AbsoluteFill>
  );
};
