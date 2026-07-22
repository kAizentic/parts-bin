// Example call-site props for RibbonPeelReveal. Does NOT change the component's own defaults.
import { type ReactNode } from "react";
import RibbonPeelReveal from "../components/RibbonPeelReveal";

export function RibbonPeelRevealExample({ current, next }: { current: ReactNode; next: ReactNode }) {
  return (
    <RibbonPeelReveal
      current={current}
      next={next}
      coils={7}
      arc={0.32}
      overscan={1.3}
      tilt={3}
      tiltEnd={0}
      backTilt={0}
      backTiltEnd={-3}
      backOffset={0.36}
      backThin={0.85}
      depthRibbon
      peelStart={0.03}
      peelEnd={0.68}
      travelVh={800}
    />
  );
}
