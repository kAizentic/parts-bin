"use client";

/**
 * InvertChapterBand — a full-bleed section that INVERTS paper↔ink as it enters.
 *
 * Pattern — a scroll-driven dark→light section flip:
 * chapter a long page by background INVERSION instead of decoration. A scrubbed
 * ScrollTrigger cross-fades the band's `background`/`color` from the paper token to
 * the ink token (or vice-versa) as it scrolls through the top of the viewport.
 * Optional `clipReveal` wipes the inner content up from the bottom on the same scrub.
 *
 * Theming: `--site-paper` (light state), `--site-ink` (dark state). `invert=true`
 * goes paper→ink; `invert=false` goes ink→paper. Children inherit the animated color.
 * Reduced-motion: lands statically in the END state (fully inverted), fully legible.
 *
 * Deps: gsap, @gsap/react, gsap/ScrollTrigger.  effect_type: band-inversion (+ optional reveal).
 */
import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function InvertChapterBand({
  children,
  invert = true,
  clipReveal = false,
  className = "",
}: {
  children: ReactNode;
  /** true: paper→ink (default). false: ink→paper. */
  invert?: boolean;
  clipReveal?: boolean;
  className?: string;
}) {
  const band = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  const paper = "var(--site-paper, #faf9f5)";
  const ink = "var(--site-ink, #141413)";
  const from = invert ? { backgroundColor: paper, color: ink } : { backgroundColor: ink, color: paper };
  const to = invert ? { backgroundColor: ink, color: paper } : { backgroundColor: paper, color: ink };

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const inv = gsap.fromTo(band.current, from, {
          ...to,
          ease: "none",
          scrollTrigger: { trigger: band.current, start: "top 80%", end: "top 30%", scrub: true },
        });
        let rev: gsap.core.Tween | undefined;
        if (clipReveal) {
          rev = gsap.from(inner.current, {
            clipPath: "inset(0% 0% 100% 0%)",
            ease: "none",
            scrollTrigger: { trigger: band.current, start: "top 75%", end: "top 40%", scrub: true },
          });
        }
        return () => { inv.scrollTrigger?.kill(); inv.kill(); rev?.scrollTrigger?.kill(); rev?.kill(); };
      });
      return () => mm.revert();
    },
    { scope: band },
  );

  // Static fallback = the END (inverted) state, so reduced-motion readers see the resolved band.
  return (
    <div ref={band} className={"relative w-full " + className} style={to}>
      <div ref={inner}>{children}</div>
    </div>
  );
}
