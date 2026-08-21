"use client";

import { useEffect, useState } from "react";
import RippleTypeHero from "../../../framer/RippleTypeHero.framer";

/**
 * Renders the Framer component file verbatim, with its own shipping defaults spread in.
 * Spreading `defaultProps` rather than re-listing values keeps this preview from drifting
 * away from what the component actually ships with — there is exactly one source of truth,
 * and it is the file that gets pasted into Framer.
 *
 * `?rig=1` additionally makes this page drivable over postMessage by a local tuning bench.
 * The listener is only installed when that flag is present, so the public preview URL
 * registers nothing and behaves identically to a static render. Only known knob keys are
 * accepted, and each is type-checked before it is applied.
 *
 * If you do frame this page from a local bench: serve the bench on the SAME hostname
 * (localhost framing localhost, never mixed with 127.0.0.1). Chrome treats those as
 * different sites and throttles a cross-site iframe's rAF — the water then freezes at frame
 * one while still looking correctly composed, which reads as a broken component.
 */

const STRING_KEYS = [
  "text",
  "ctaLabel",
  "fontFamily",
  "paperColor",
  "inkColor",
  "accentColor",
] as const;

const NUMBER_KEYS = ["relief", "glow", "caustics"] as const;

type Knobs = Partial<Record<(typeof STRING_KEYS)[number], string>> &
  Partial<Record<(typeof NUMBER_KEYS)[number], number>>;

export default function RippleTypeHeroPreview() {
  const [override, setOverride] = useState<Knobs>({});

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("rig") !== "1") return;
    const onMsg = (e: MessageEvent) => {
      const k = (e.data || {}).knobs;
      if (!k || typeof k !== "object") return;
      const next: Knobs = {};
      for (const key of STRING_KEYS) {
        const v = k[key];
        if (typeof v === "string") next[key] = v;
      }
      for (const key of NUMBER_KEYS) {
        const v = k[key];
        if (typeof v === "number") next[key] = v;
      }
      if (Object.keys(next).length) setOverride((prev) => ({ ...prev, ...next }));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        margin: 0,
        overflow: "hidden",
        background: "#04060A",
      }}
    >
      <RippleTypeHero {...RippleTypeHero.defaultProps} {...override} />
    </main>
  );
}
