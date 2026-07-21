"use client";

/**
 * StickyGrowMedia — a hero media card that GROWS while held in the viewport.
 *
 * Pattern — a growing hero video/media card: a real CSS `position:
 * sticky` stage holds the card centred in the viewport while a scroll-SCRUBBED
 * ScrollTrigger grows it (`width small→large`); when the stage ends, sticky releases and
 * the card scrolls away at full size. Adds a lerped MOUSE PARALLAX on a fine pointer.
 *
 * The stage height is DERIVED — `calc(100vh + growDistancePx)` — so the sticky holds for
 * exactly as long as the grow runs, at every viewport height. Do NOT reintroduce a
 * vh-denominated stage/travel knob: a vh stage against a px grow distance is only
 * consistent at ONE viewport height. That unit mismatch is what the retired `travelVh` +
 * `yTravelVh` pair got wrong — `yTravelVh` faked this hold by counter-translating against
 * scroll (so the card drifted ~392px up per grow), and `travelVh: 200` gave a 900px stage
 * for a 1500px grow, releasing the card 600px before it finished.
 *
 * Key: the scrub animates `width` (NOT a transform), so the parallax — which owns the
 * card's transform — never fights it (one owner per property: GSAP owns transform).
 * The load intro is opacity-only (no "shrink to nothing").
 *
 * Theming: `--site-ink` (the ghost `word`). `children` is the media (poster/video/gradient).
 * Reduced-motion / no fine pointer / <768px: static at `restWidth`, no grow, no parallax.
 *
 * Deps: gsap, @gsap/react, gsap/ScrollTrigger.  effect_type: parallax-depth + pin/scrub.
 */
import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function StickyGrowMedia({
  children,
  word,
  restWidth = "46vw",
  grownWidth = "92vw",
  maxWidthPx = 1600,
  /**
   * Scroll distance (px) the grow spans — seed from the measured source
   * scroll distance (a real hero video measured ≈1130px). Also sets the
   * stage length: the sticky holds for exactly this much scroll.
   */
  growDistancePx = 1130,
  parallax = 24,
  className = "",
}: {
  children: ReactNode;
  /** Optional giant display word behind the card. */
  word?: string;
  restWidth?: string;
  grownWidth?: string;
  maxWidthPx?: number;
  growDistancePx?: number;
  parallax?: number;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px)", () => {
        // MATCH THE MEASURED SOURCE DURATION: the grow
        // spans `growDistancePx` of scroll. Two traps, both measured:
        //
        // 1. `start` MUST resolve to a REACHABLE (>=0) scroll position. This is a hero at
        //    the document top, so the old "top 90%" ("begin when my top rises to 90%
        //    viewport") resolved to -746px — unreachable, so the scrub LOADED already ~66%
        //    elapsed and the card painted pre-grown and half off-screen.
        // 2. Do NOT reach for clamp(top 90%): clamp pins the START to 0 but `+=` still
        //    anchors the END to the *unclamped* start (end=384 for an authored 1130), so
        //    growDistancePx silently becomes (growDistancePx - 746). "top top" resolves
        //    >= 0 naturally, so `+=` anchors correctly.
        //
        // No `y` here: the sticky stage does the holding, viewport-independently.
        gsap.set(card.current, { width: restWidth });
        const grow = gsap.to(card.current, {
          width: grownWidth,
          ease: "none",
          scrollTrigger: { trigger: wrap.current, start: "top top", end: `+=${growDistancePx}`, scrub: 0.8 },
        });
        const intro = gsap.from(card.current, { opacity: 0, duration: 1, ease: "power3.out", delay: 0.3 });
        return () => { grow.scrollTrigger?.kill(); grow.kill(); intro.kill(); };
      });
      mm.add("(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)", () => {
        // xPercent/yPercent (not x/y) keeps the parallax proportional as the card grows.
        const xTo = gsap.quickTo(card.current, "xPercent", { duration: 0.6, ease: "power3" });
        const yTo = gsap.quickTo(card.current, "yPercent", { duration: 0.6, ease: "power3" });
        const onMove = (e: PointerEvent) => {
          xTo((e.clientX / window.innerWidth - 0.5) * parallax * 0.1);
          yTo((e.clientY / window.innerHeight - 0.5) * parallax * 0.1);
        };
        window.addEventListener("pointermove", onMove);
        return () => window.removeEventListener("pointermove", onMove);
      });
      return () => mm.revert();
    },
    { scope: wrap },
  );

  return (
    // Stage = one viewport (what sticky holds) + the grow's scroll runway. Derived, not a knob.
    <div ref={wrap} className={"relative " + className} style={{ minHeight: `calc(100vh + ${growDistancePx}px)` }}>
      {/* Real `position: sticky` holds the card viewport-centred for exactly the grow's
          span, at any viewport height. NOTE: any ancestor with `overflow: hidden/auto`
          creates a scroll container and silently kills this — keep the hero's ancestors
          overflow-visible. The 100vh flex box centres the card's MEASURED box, so the
          centring survives `maxWidthPx` capping the derived 16/10 height. */}
      <div className="sticky top-0 flex h-screen w-full items-center justify-center">
        {word && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center font-extrabold leading-none text-[clamp(5rem,26vw,24rem)]"
            style={{ color: "color-mix(in srgb, var(--site-ink,#111) 6%, transparent)" }}
          >
            {word}
          </div>
        )}
        <div ref={card} className="relative aspect-[16/10] overflow-hidden rounded-[2px]" style={{ width: restWidth, maxWidth: maxWidthPx }}>
          {children}
        </div>
      </div>
    </div>
  );
}
