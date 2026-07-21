"use client";

/**
 * DiagonalBorderSweep — a pinned section transition where two 5-layer border halves
 * sweep in from OPPOSITE corners, compress into the edges consecutively, and the
 * trailing (last) layer of each half bounds a growing rectangular WINDOW that reveals
 * the next section behind it.
 *
 * Pattern:
 *   - Each half is a full-viewport corner bracket (an L: top+left for A, bottom+right
 *     for B) rendered as N stacked stroke layers.
 *   - Sweep phase: every layer travels the full diagonal and parks at the edge, but each
 *     layer FINISHES at a staggered time (leader first → reveal layer last), so they
 *     compress into the edge one at a time. A tight arrival window (`leadFinish`) keeps
 *     the strokes overlapping into one continuous banded frame — pick a stroke `weight`
 *     ABOVE the peak inter-layer gap at mid-sweep or the band splits open there.
 *   - Reveal: the two trailing layers' corners define a centered rectangular window; as
 *     they diverge to their home corners the window grows to full-bleed → `next` shown.
 *   - Exit phase: the compressed frame thins its strokes to nothing over the last of the
 *     scroll while the reveal stays full-bleed.
 *
 * Theming: `--site-paper` (current section bg) → `--site-accent` (revealed section bg +
 * boldest/reveal stroke). The stroke layers ramp `--site-ink`→`--site-accent` (marks that
 * stay legible over the paper section on either theme). Reduced-motion: renders `current`
 * then `next` as two normal stacked sections — no pin, no scrub, both fully legible.
 *
 * Deps: gsap, @gsap/react, gsap/ScrollTrigger.  effect_type: pin/scrub full-bleed reveal.
 */
import { useRef, type ReactNode, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function DiagonalBorderSweep({
  current,
  next,
  layers = 5,
  leadFinish = 0.93,
  weightThin = 52,
  weightBold = 60,
  thickness = 1,
  sweepEnd = 0.78,
  push = 0.18,
  travelVh = 360,
  className = "",
}: {
  /** outgoing section content (visible while the window is closed) */
  current: ReactNode;
  /** revealed section content (shown inside the growing window) */
  next: ReactNode;
  /** stroke layers per half (default 5) */
  layers?: number;
  /** scroll-fraction at which the LEADING layer reaches the edge; higher = tighter fan */
  leadFinish?: number;
  /** trailing-layer stroke px — keep ABOVE the peak mid-sweep gap so bands stay overlapped */
  weightThin?: number;
  /** reveal-layer (last) stroke px */
  weightBold?: number;
  /** uniform multiplier on every stroke weight — the whole frame's heft in one dial (wipe stays crisp: the reveal clip is driven by the layer's position, not its thickness) */
  thickness?: number;
  /** fraction of scroll spent sweeping in; the rest thins the frame out */
  sweepEnd?: number;
  /** how far the compressed frame slides past the edge on exit (× viewport) */
  push?: number;
  /** total pinned scroll distance (track height, vh) */
  travelVh?: number;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const curRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);
  const aRefs = useRef<HTMLDivElement[]>([]);
  const bRefs = useRef<HTMLDivElement[]>([]);

  const N = Math.max(2, layers);
  const paper = "var(--site-paper, #101014)";
  const ink = "var(--site-ink, #f2eee4)";
  const accent = "var(--site-accent, #e8452b)";
  // strokes are MARKS, so the ramp runs ink→accent (contrasts the paper section on either theme);
  // ramping from paper would hide the leading strokes on a paper-coloured section. reveal layer = accent.
  const rampColor = (i: number) =>
    i === N - 1 ? accent : `color-mix(in oklch, ${accent} ${Math.round((i / (N - 1)) * 55)}%, ${ink})`;
  const setW = (el: HTMLDivElement, side: "A" | "B", w: number) => {
    if (side === "A") { el.style.borderTopWidth = w + "px"; el.style.borderLeftWidth = w + "px"; }
    else { el.style.borderBottomWidth = w + "px"; el.style.borderRightWidth = w + "px"; }
  };

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const W0 = () => window.innerWidth, H0 = () => window.innerHeight;

        // switch from the static fallback layout into the pinned/animated layout
        gsap.set(track.current, { height: `${travelVh}vh`, position: "relative" });
        gsap.set(scene.current, { position: "sticky", top: 0, height: "100vh", width: "100vw", overflow: "hidden" });
        gsap.set([curRef.current, nextRef.current], { position: "absolute", inset: 0 });
        gsap.set(nextRef.current, { clipPath: "inset(50% 50% 50% 50%)" });
        [...aRefs.current, ...bRefs.current].forEach((el) => (el.style.display = "block"));

        const render = (p: number) => {
          const W = W0(), H = H0();
          const sweep = clamp(p / sweepEnd);
          const exit = clamp((p - sweepEnd) / (1 - sweepEnd));
          const ee = easeInOutCubic(exit);
          const PUSHx = push * W, PUSHy = push * H;

          let a4x = 0, a4y = 0, b4x = 0, b4y = 0;
          for (let i = 0; i < N; i++) {
            const finish = lerp(leadFinish, 1.0, i / (N - 1));
            const ei = easeInOutCubic(clamp(sweep / finish));
            const w = (i === N - 1 ? weightBold : weightThin) * thickness * (1 - ee);
            const ax = (1 - ei) * W - ee * PUSHx, ay = (1 - ei) * H - ee * PUSHy;
            const a = aRefs.current[i];
            a.style.transform = `translate(${ax}px,${ay}px)`;
            setW(a, "A", w);
            const bx = -(1 - ei) * W + ee * PUSHx, by = -(1 - ei) * H + ee * PUSHy;
            const b = bRefs.current[i];
            b.style.transform = `translate(${bx}px,${by}px)`;
            setW(b, "B", w);
            if (i === N - 1) { a4x = ax; a4y = ay; b4x = bx; b4y = by; }
          }

          // reveal window bounded by the two trailing-layer corners
          const TLx = a4x, TLy = a4y, BRx = W + b4x, BRy = H + b4y;
          if (BRx > TLx && BRy > TLy) {
            const t = Math.max(0, TLy), r = Math.max(0, W - BRx), b = Math.max(0, H - BRy), l = Math.max(0, TLx);
            nextRef.current!.style.clipPath = `inset(${t}px ${r}px ${b}px ${l}px)`;
          } else {
            nextRef.current!.style.clipPath = "inset(50% 50% 50% 50%)";
          }
        };

        const st = ScrollTrigger.create({
          trigger: track.current,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          onUpdate: (self) => render(self.progress),
        });
        render(0);
        return () => st.kill();
      });
      return () => mm.revert();
    },
    { scope: track },
  );

  const bracketBase: CSSProperties = {
    position: "absolute", top: 0, left: 0, width: "100vw", height: "100vh",
    borderStyle: "solid", borderWidth: 0, display: "none", willChange: "transform",
  };
  const panelBase: CSSProperties = { display: "grid", placeItems: "center", textAlign: "center", minHeight: "100vh" };

  return (
    // static fallback = current then next as two normal stacked sections (both legible)
    <div ref={track} className={"relative w-full " + className}>
      <div ref={scene} className="relative">
        <div ref={curRef} style={{ ...panelBase, background: paper, color: "var(--site-ink, #101014)" }}>
          {current}
        </div>
        <div ref={nextRef} style={{ ...panelBase, background: accent, color: "var(--site-ink, #101014)", zIndex: 2 }}>
          {next}
        </div>
        <div className="pointer-events-none" style={{ position: "absolute", inset: 0, zIndex: 3 }}>
          {Array.from({ length: N }).map((_, i) => (
            <div
              key={"a" + i}
              ref={(el) => { if (el) aRefs.current[i] = el; }}
              style={{ ...bracketBase, borderColor: rampColor(i) }}
            />
          ))}
          {Array.from({ length: N }).map((_, i) => (
            <div
              key={"b" + i}
              ref={(el) => { if (el) bRefs.current[i] = el; }}
              style={{ ...bracketBase, borderColor: rampColor(i) }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
