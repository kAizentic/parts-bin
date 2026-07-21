// Example call-site props for DiagonalBorderSweep. Does NOT change the component's own defaults.
import { type ReactNode } from "react";
import DiagonalBorderSweep from "../components/DiagonalBorderSweep";

export function DiagonalBorderSweepExample({ current, next }: { current: ReactNode; next: ReactNode }) {
  return (
    <DiagonalBorderSweep
      current={current}
      next={next}
      layers={5}
      leadFinish={0.85}
      weightThin={52}
      weightBold={60}
      thickness={2.5}
      sweepEnd={0.78}
      push={0.18}
      travelVh={360}
    />
  );
}
