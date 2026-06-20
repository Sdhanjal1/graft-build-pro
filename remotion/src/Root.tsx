import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { VerticalVideo } from "./VerticalVideo";
import { SocialAd } from "./SocialAd";
import { SocialAdV2 } from "./SocialAdV2";
import { SocialAdV3, socialAdV3Schema } from "./SocialAdV3";
import { SocialEditorial, socialEditorialSchema } from "./SocialEditorial";

const EDITORIAL_DURATION = 360; // 12s @ 30fps

export const RemotionRoot = () => (
  <>
    <Composition
      id="main"
      component={MainVideo}
      durationInFrames={700}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="main-landing"
      component={MainVideo}
      durationInFrames={420}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ variant: "landing" as const }}
    />
    <Composition
      id="vertical"
      component={VerticalVideo}
      durationInFrames={700}
      fps={30}
      width={1080}
      height={1920}
    />

    <Composition
      id="social"
      component={SocialAd}
      durationInFrames={450}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="social-v2"
      component={SocialAdV2}
      durationInFrames={990}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="social-v3"
      component={SocialAdV3}
      durationInFrames={1000}
      fps={30}
      width={1080}
      height={1920}
      schema={socialAdV3Schema}
      defaultProps={{ hookVariant: "stop-typing" as const }}
    />
    <Composition
      id="editorial-vertical"
      component={SocialEditorial}
      durationInFrames={EDITORIAL_DURATION}
      fps={30}
      width={1080}
      height={1920}
      schema={socialEditorialSchema}
      defaultProps={{ format: "vertical" as const }}
    />
    <Composition
      id="editorial-square"
      component={SocialEditorial}
      durationInFrames={EDITORIAL_DURATION}
      fps={30}
      width={1080}
      height={1080}
      schema={socialEditorialSchema}
      defaultProps={{ format: "square" as const }}
    />
    <Composition
      id="editorial-wide"
      component={SocialEditorial}
      durationInFrames={EDITORIAL_DURATION}
      fps={30}
      width={1920}
      height={1080}
      schema={socialEditorialSchema}
      defaultProps={{ format: "wide" as const }}
    />
  </>
);

