import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { VerticalVideo } from "./VerticalVideo";
import { SocialAd } from "./SocialAd";

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
  </>
);

