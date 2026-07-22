"use client";

/**
 * RibbonPeelReveal — a pinned, scroll-scrubbed reveal where the FRONT section is sliced
 * into a side-profile "slinky": a stack of horizontal coils (each a shallow downward arc)
 * seen edge-on. As you scroll every coil thins evenly to nothing and the gaps between them
 * widen, wiping the front sheet away to uncover `next` behind it. This is a MOVING-BOUNDARY
 * wipe (a live CSS mask edge that travels), never an opacity fade.
 *
 * Signature — isometric depth: the SAME coiling ribbon is drawn again in the background,
 * offset half a pitch and slightly thinner, so a centred revealed object reads as *contained
 * within* the coil structure (sandwiched between the back ribbon and the peeling front sheet).
 * Turn it off with `depthRibbon={false}` when `next` is an opaque full-bleed section.
 *
 * Mechanics:
 *   - The front sheet (`current`) is masked by a live-generated SVG of `coils` arced bands;
 *     `fill=#fff` = kept, so shrinking the band heights uncovers what's behind.
 *   - A soft-light cylindrical-shade overlay rides on the front sheet so the flat bands read
 *     as round coils (a spring), not venetian blinds.
 *   - The back depth ribbon is the same geometry, offset + a hair thinner, tinted from
 *     `--site-paper` so it recedes by tone, NOT by darkening (flat porcelain, no grain).
 *   - As the ribbon thins, the front tilts out to level (tilt→tiltEnd) while the back leans
 *     the opposite way (backTilt→backTiltEnd), so the two sheets fan apart as they vanish.
 *   - The whole ribbon thins out by `peelEnd` (well before the scroll ends), leaving the
 *     revealed backdrop to breathe — see `RibbonPeelRevealWithSphere` for why that matters.
 *
 * Theming: `--site-paper` (the back depth ribbon's porcelain tint) + `--site-ink` (shade/mix
 * tone). The front sheet's own background/colour is whatever you style onto `current`.
 * Reduced-motion: renders `current` then `next` as two normal stacked sections — no pin, no
 * mask, both fully legible.
 *
 * `onProgress(p)` fires every scrubbed frame (0→1) so a parent can drive an auxiliary
 * animation off the same playhead (that's how RibbonPeelRevealWithSphere syncs the sphere).
 *
 * Deps: gsap, @gsap/react, gsap/ScrollTrigger.  effect_type: pin/scrub full-bleed reveal.
 */
import { useRef, type ReactNode, type CSSProperties } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

export default function RibbonPeelReveal({
  current,
  next,
  backdrop,
  coils = 7,
  arc = 0.32,
  overscan = 1.3,
  tilt = 3,
  tiltEnd = 0,
  backTilt = 0,
  backTiltEnd = -3,
  backOffset = 0.36,
  backThin = 0.85,
  depthRibbon = true,
  peelStart = 0.03,
  peelEnd = 0.68,
  travelVh = 800,
  onProgress,
  className = "",
}: {
  /** front "old way" section that gets sliced into the peeling ribbon */
  current: ReactNode;
  /** revealed section/object uncovered behind the ribbon (best as centred, transparent-bg content) */
  next: ReactNode;
  /** optional backmost layer, painted BEHIND the depth ribbon (e.g. a dark scene bg the porcelain
   *  ribbon reads against). Motion-only decorative layer; omit for a plain reveal. */
  backdrop?: ReactNode;
  /** number of horizontal coils the sheet is sliced into (default 7) */
  coils?: number;
  /** downward bow of each coil edge as a fraction of pitch — higher = rounder slinky (default 0.32) */
  arc?: number;
  /** how far the coil stack overscans the viewport so top/bottom coils bleed off (default 1.30) */
  overscan?: number;
  /** front ribbon tilt in degrees at the START of the peel (default 3, leans right) */
  tilt?: number;
  /** front ribbon tilt in degrees once fully thinned — animates tilt→tiltEnd over the peel (default 0, level) */
  tiltEnd?: number;
  /** back depth-ribbon tilt in degrees at the START of the peel (default 0, level) */
  backTilt?: number;
  /** back depth-ribbon tilt in degrees once fully thinned — animates backTilt→backTiltEnd over the peel
   *  (default -3 = 3° left of centre, mirroring the front's lean-out) */
  backTiltEnd?: number;
  /** how far the back ribbon lags the front, in pitch fractions — the isometric offset (default 0.36) */
  backOffset?: number;
  /** back-ribbon coil height vs the front (default 0.85 = slightly thinner, so it recedes) */
  backThin?: number;
  /** draw the background depth ribbon (default true; off for opaque full-bleed `next`) */
  depthRibbon?: boolean;
  /** scroll fraction at which the coils begin thinning (default 0.03) */
  peelStart?: number;
  /** scroll fraction by which the ribbon is fully gone — keep it WELL before 1.0 (default 0.68) */
  peelEnd?: number;
  /** total pinned scroll distance (track height, vh) (default 800) */
  travelVh?: number;
  /** called every scrubbed frame with progress 0→1 (sync auxiliary animation to the same playhead) */
  onProgress?: (p: number) => void;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const curRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const N = Math.max(3, coils);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // ---- resolve the token seam to concrete colours (SVG attrs can't read var()) ----
        const cs = getComputedStyle(track.current!);
        const paper = cs.getPropertyValue("--site-paper").trim() || "#ECEAE3";
        const ink = cs.getPropertyValue("--site-ink").trim() || "#23262B";
        const mix = (pct: number) => `color-mix(in oklab, ${paper}, ${ink} ${pct}%)`;

        // ---- side-profile slinky geometry (1000-unit square, slice-scaled to fill) ----
        const XL = -160, XR = 1160;
        const spanY = 1000 * overscan, topY = (1000 - spanY) / 2, pitch = spanY / N;
        const bow = pitch * arc;

        const bandPath = (cy: number, h: number) => {
          const yT = cy - h / 2, yB = cy + h / 2;
          return (
            "M " + XL + " " + yT.toFixed(1) +
            " Q 500 " + (yT + bow).toFixed(1) + " " + XR + " " + yT.toFixed(1) +
            " L " + XR + " " + yB.toFixed(1) +
            " Q 500 " + (yB + bow).toFixed(1) + " " + XL + " " + yB.toFixed(1) + " Z"
          );
        };

        const maskHead =
          "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 1000' preserveAspectRatio='xMidYMid slice'>";
        // cylindrical shade: achromatic light→shadow (soft-light), so it works over any paper hue
        const shadeHead =
          "<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' viewBox='0 0 1000 1000' preserveAspectRatio='xMidYMid slice'><defs>" +
          "<linearGradient id='cg' gradientUnits='objectBoundingBox' x1='0' y1='0' x2='0' y2='1'>" +
          "<stop offset='0' stop-color='rgb(255,255,255)' stop-opacity='.42'/>" +
          "<stop offset='.32' stop-color='rgb(255,255,255)' stop-opacity='.03'/>" +
          "<stop offset='.60' stop-color='rgb(10,10,24)' stop-opacity='.08'/>" +
          "<stop offset='1' stop-color='rgb(5,3,15)' stop-opacity='.6'/></linearGradient></defs>";
        // back ribbon: same porcelain tint (from --site-paper), sharp; depth from tone + offset (no grain)
        const backHead =
          "<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' viewBox='0 0 1000 1000' preserveAspectRatio='xMidYMid slice'><defs>" +
          "<linearGradient id='cb' gradientUnits='objectBoundingBox' x1='0' y1='0' x2='0' y2='1'>" +
          "<stop offset='0' stop-color='" + paper + "' stop-opacity='.96'/>" +
          "<stop offset='.4' stop-color='" + mix(6) + "' stop-opacity='.86'/>" +
          "<stop offset='1' stop-color='" + mix(26) + "' stop-opacity='.72'/></linearGradient></defs>";

        const setBands = (p: number) => {
          const t = seg(p, peelStart, peelEnd); // 0→1 thinning, evenly across all coils
          const hF = pitch * 1.06 * (1 - t); // front sheet: full overlap → nothing
          const hB = pitch * 1.06 * backThin * (1 - t); // back ribbon: same timing, a hair thinner
          let m = "", s = "", b = "";
          for (let i = 0; i < N; i++) {
            const cy = topY + pitch * (i + 0.5);
            if (hF >= 0.8) {
              const d = bandPath(cy, hF);
              m += "<path d='" + d + "' fill='rgb(255,255,255)'/>";
              s += "<path d='" + d + "' fill='url(#cg)'/>";
            }
            if (depthRibbon && hB >= 0.8) {
              const db = bandPath(cy + pitch * backOffset, hB);
              b += "<path d='" + db + "' fill='url(#cb)'/>";
            }
          }
          // tilts animate over the same peel window: front leans out to level (tilt→tiltEnd),
          // back leans the opposite way (backTilt→backTiltEnd) as everything thins to nothing
          const frontRot = tilt + (tiltEnd - tilt) * t;
          const backRot = backTilt + (backTiltEnd - backTilt) * t;
          const G0 = "<g transform='rotate(" + frontRot.toFixed(3) + " 500 500)'>";
          const GB = "<g transform='rotate(" + backRot.toFixed(3) + " 500 500)'>";
          const END = "</g></svg>";
          const url = 'url("data:image/svg+xml,' + encodeURIComponent(maskHead + G0 + m + END) + '")';
          curRef.current!.style.webkitMaskImage = url;
          curRef.current!.style.maskImage = url;
          shadeRef.current!.innerHTML = shadeHead + G0 + s + END;
          if (backRef.current) backRef.current.innerHTML = depthRibbon ? backHead + GB + b + END : "";
        };

        // switch from the static stacked fallback into the pinned/masked layout
        gsap.set(track.current, { height: `${travelVh}vh`, position: "relative" });
        gsap.set(scene.current, { position: "sticky", top: 0, height: "100vh", width: "100%", overflow: "hidden" });
        gsap.set([curRef.current, nextRef.current, backdropRef.current], { position: "absolute", inset: 0, minHeight: 0 });
        gsap.set(curRef.current, {
          WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
          WebkitMaskSize: "100% 100%", maskSize: "100% 100%",
        });
        // backdrop + depth ribbon are motion-only decorative layers (hidden in the static fallback)
        [shadeRef.current, backRef.current, backdropRef.current].forEach((el) => el && (el.style.display = "block"));

        const render = (p: number) => { setBands(p); onProgress?.(p); };
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

  const panelBase: CSSProperties = { display: "grid", placeItems: "center", minHeight: "100vh", width: "100%" };
  const svgLayer: CSSProperties = { position: "absolute", inset: 0, display: "none", pointerEvents: "none" };

  return (
    // static fallback = current then next as two normal stacked sections (both legible);
    // the backdrop + depth-ribbon layers are display:none until the no-preference branch shows them.
    // Motion paint order (by z-index): backdrop(0) < depth ribbon(1) < next(2) < front sheet(3),
    // so a centred `next` object sits between the back ribbon and the peeling front sheet.
    <div ref={track} className={"relative w-full " + className}>
      <div ref={scene} className="relative">
        <div ref={backdropRef} style={{ ...svgLayer, zIndex: 0 }} aria-hidden="true">
          {backdrop}
        </div>
        <div ref={backRef} style={{ ...svgLayer, zIndex: 1 }} aria-hidden="true" />
        {/* peeling front sheet (masked) + cylindrical shade */}
        <div ref={curRef} style={{ ...panelBase, zIndex: 3 }}>
          {current}
          <div
            ref={shadeRef}
            style={{ ...svgLayer, zIndex: 1, mixBlendMode: "soft-light" }}
            aria-hidden="true"
          />
        </div>
        {/* revealed object (uncovered as the front sheet peels) */}
        <div ref={nextRef} style={{ ...panelBase, zIndex: 2 }}>
          {next}
        </div>
      </div>
    </div>
  );
}
