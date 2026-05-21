import { AbsoluteFill, useCurrentFrame, interpolate, Sequence } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Scene1Hero } from "./scenes/Scene1Hero";
import { Scene2Voice } from "./scenes/Scene2Voice";
import { Scene3Quote } from "./scenes/Scene3Quote";
import { Scene4Send } from "./scenes/Scene4Send";
import { Scene5End } from "./scenes/Scene5End";
import { Captions } from "./components/Captions";
import { colors, display } from "./theme";

const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 80) * 60;
  return (
    <AbsoluteFill style={{ backgroundColor: colors.ink }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(800px circle at ${50 + drift / 6}% ${20 + Math.sin(frame / 100) * 8}%, rgba(207,255,61,0.18), transparent 60%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 80px), repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 80px)",
        }}
      />
    </AbsoluteFill>
  );
};

// 0.5s branded opening so the first social-preview frame reads "Quottr"
const BrandFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 4, 12, 16], [1, 1, 1, 0], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity }}>
      <div style={{ color: colors.lime, fontFamily: display, fontSize: 280, lineHeight: 0.9 }}>
        Quottr.
      </div>
    </AbsoluteFill>
  );
};

export const MainVideo: React.FC = () => {
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
            <TransitionSeries.Sequence durationInFrames={110}>
              <Scene1Hero />
            </TransitionSeries.Sequence>
            <TransitionSeries.Transition presentation={fade()} timing={springTiming({ durationInFrames: 18, config: { damping: 200 } })} />

            <TransitionSeries.Sequence durationInFrames={160}>
              <Scene2Voice />
            </TransitionSeries.Sequence>
            <TransitionSeries.Transition presentation={fade()} timing={springTiming({ durationInFrames: 18, config: { damping: 200 } })} />

            <TransitionSeries.Sequence durationInFrames={170}>
              <Scene3Quote />
            </TransitionSeries.Sequence>
            <TransitionSeries.Transition presentation={fade()} timing={springTiming({ durationInFrames: 18, config: { damping: 200 } })} />

            <TransitionSeries.Sequence durationInFrames={130}>
              <Scene4Send />
            </TransitionSeries.Sequence>
            <TransitionSeries.Transition presentation={fade()} timing={springTiming({ durationInFrames: 18, config: { damping: 200 } })} />

            <TransitionSeries.Sequence durationInFrames={180}>
              <Scene5End />
            </TransitionSeries.Sequence>
          </TransitionSeries>
        </AbsoluteFill>
      </Sequence>

      <Captions />
    </AbsoluteFill>
  );
};
