// Example call-site props for RibbonPeelRevealWithSphere. Does NOT change the component's own defaults.
import { type ReactNode } from "react";
import RibbonPeelRevealWithSphere from "../components/RibbonPeelRevealWithSphere";

export function RibbonPeelRevealWithSphereExample({ current }: { current: ReactNode }) {
  return (
    <RibbonPeelRevealWithSphere
      current={current}
      eyebrow="SECTION · LABEL"
      titleParts={[{ text: "Your" }, { text: "Brand", italic: true }]}
      titleColor="#E9D8A6"
      tagline={["a one- or two-line", "tagline goes here"]}
      coils={7}
      arc={0.32}
      tilt={3}
      tiltEnd={0}
      backTilt={0}
      backTiltEnd={-3}
      peelStart={0.03}
      peelEnd={0.68}
      travelVh={820}
      spinDeg={180}
      growFrom={0.5}
      settleStart={0.05}
      settleEnd={1.0}
      shadow
    />
  );
}
