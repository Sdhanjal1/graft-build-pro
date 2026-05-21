import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Scene1Hero } from "./scenes/Scene1Hero";
import { Scene2Voice } from "./scenes/Scene2Voice";
import { Scene3Quote } from "./scenes/Scene3Quote";
import { Scene4Send } from "./scenes/Scene4Send";
import { Scene5End } from "./scenes/Scene5End";
import { colors } from "./theme";

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

export const MainVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const vignette = interpolate(frame, [0, 30], [0, 1]);
  return (
    <AbsoluteFill>
      <Backdrop />
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

          <TransitionSeries.Sequence durationInFrames={110}>
            <Scene5End />
          </TransitionSeries.Sequence>
        </TransitionSeries>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
