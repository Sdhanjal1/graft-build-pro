import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { VerticalVideo } from "./VerticalVideo";
import { SocialAd } from "./SocialAd";
import { SocialAdV2 } from "./SocialAdV2";
import { SocialAdV3, socialAdV3Schema } from "./SocialAdV3";

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
  </>
);
