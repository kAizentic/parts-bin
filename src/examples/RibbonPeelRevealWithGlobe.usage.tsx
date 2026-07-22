// Example call-site props for RibbonPeelRevealWithGlobe. Does NOT change the component's own defaults.
// Requires two Natural Earth 110m GeoJSON files served at the URLs below (this demo ships them in public/).
import { type ReactNode } from "react";
import RibbonPeelRevealWithGlobe from "../components/RibbonPeelRevealWithGlobe";

export function RibbonPeelRevealWithGlobeExample({ current }: { current: ReactNode }) {
  return (
    <RibbonPeelRevealWithGlobe
      current={current}
      title="New World"
      globePaper="#ECEAE3"
      globeInk="#0b1524"
      landUrl="/ne_110m_land.json"
      coastUrl="/ne_110m_coastline.json"
      coils={7}
      arc={0.32}
      tilt={3}
      tiltEnd={0}
      backTilt={0}
      backTiltEnd={-3}
      peelStart={0.03}
      peelEnd={0.68}
      travelVh={820}
      growFrom={0.62}
      settleStart={0.05}
      settleEnd={1.0}
    />
  );
}
