"use client";

/**
 * StickyScrubGallery — a pinned, scroll-SCRUBBED "selected work" gallery.
 *
 * Pattern — a "selected work" gallery:
 * a CSS `position: sticky` inner inside a TALL outer + ONE scrubbed ScrollTrigger.
 * Each row's media wipes OPEN to full row width, holds, then collapses + slides out
 * — and the NEXT row opens AS the current collapses (overlap). ALL rows collapse.
 *
 * Why sticky, not GSAP `pin`: hard pinning caused a top cutoff, a post-last-row
 * scroll jump-back, and a too-short rollout. Use `position: sticky` + scrub instead.
 *
 * Theming: uses `--site-paper` / `--site-ink` / `--site-hairline` / `--site-muted`
 * (set them on an ancestor). `media` is a CSS `background` string OR a ReactNode.
 * Reduced-motion / <768px: a static legible list with always-open bands.
 *
 * Deps: gsap, @gsap/react, gsap/ScrollTrigger.
 * effect_type: hover-reveal-family → here scroll-scrubbed full-bleed reveal (pin/scrub).
 */
import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export type GalleryRow = {
  id: string;
  label: string;
  metaLeft?: string;
  metaRight?: string;
  /** CSS background string (gradient/url) OR a ReactNode rendered into the band. */
  media: string | ReactNode;
};

// clip-path corners (inset top right bottom left) — collapsed to a corner / full.
const CLIP = {
  TL: "inset(0% 100% 100% 0%)",
  BL: "inset(100% 100% 0% 0%)",
  TR: "inset(0% 0% 100% 100%)",
  BR: "inset(100% 0% 0% 100%)",
  FULL: "inset(0% 0% 0% 0%)",
};

export default function StickyScrubGallery({
  rows,
  /** viewport-heights of scroll per row — larger = slower, smoother rollout. */
  vhPerRow = 100,
  bandVh = 54,
  cursorLabel = "View",
  className = "",
}: {
  rows: GalleryRow[];
  vhPerRow?: number;
  bandVh?: number;
  cursorLabel?: string;
  className?: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px)", () => {
        const rowEls = gsap.utils.toArray<HTMLElement>(".ssg-row", list.current!);
        const medias = rowEls.map((r) => r.querySelector<HTMLElement>(".ssg-media"));
        const imgs = rowEls.map((r) => r.querySelector<HTMLElement>(".ssg-img"));
        const tl = gsap.timeline({
          scrollTrigger: { trigger: outer.current, start: "top top", end: "bottom bottom", scrub: 0.8 },
        });
        // Viewport accommodation: creep the list up across the scrub so later (lower)
        // rows' open bands stay in frame rather than being cut off.
        tl.fromTo(list.current, { yPercent: 0 }, { yPercent: -10, ease: "none" }, 0);
        const last = rows.length - 1;
        const STEP = 1.0; // next opens at +1.0; this closes at +0.9 → overlap
        rows.forEach((_, i) => {
          const t = i * STEP, m = medias[i], im = imgs[i];
          // Per-row corner choreography: first row expands
          // top-left→contracts top-right; middle rows expand bottom-left→contract
          // top-right; last row expands bottom-left→contracts bottom-right.
          const expandFrom = i === 0 ? CLIP.TL : CLIP.BL;
          const contractTo = i === last ? CLIP.BR : CLIP.TR;
          // Open [t, t+1], close [t+1, t+2]. The next row opens at (i+1)*STEP = t+1 with
          // the SAME duration, so this row's contraction and the next's expansion share
          // the EXACT scroll span (the measured source feel).
          tl.fromTo(m, { height: 0 }, { height: `${bandVh}vh`, duration: 1, ease: "power2.inOut" }, t)
            .fromTo(im, { clipPath: expandFrom }, { clipPath: CLIP.FULL, duration: 1, ease: "power2.inOut" }, t)
            .to(m, { height: 0, duration: 1, ease: "power2.inOut" }, t + 1)
            .to(im, { clipPath: contractTo, duration: 1, ease: "power2.inOut" }, t + 1);
        });
        return () => { tl.scrollTrigger?.kill(); tl.kill(); };
      });
      return () => mm.revert();
    },
    { scope: outer },
  );

  return (
    <section
      ref={outer}
      className={className}
      style={{ minHeight: `${rows.length * vhPerRow}vh`, position: "relative" }}
    >
      <div className="md:sticky md:top-0 md:h-screen md:overflow-hidden" style={{ background: "var(--site-paper,#fff)" }}>
        <div ref={list} className="md:pt-20">
          {rows.map((r) => (
            <a
              key={r.id}
              href="#"
              data-cursor={cursorLabel}
              className="ssg-row group relative block outline-none"
              style={{ borderTop: "1px solid var(--site-hairline,rgba(0,0,0,.14))" }}
            >
              <div className="flex items-baseline justify-between gap-6 px-6 py-5 md:px-12">
                <span className="text-[clamp(1.5rem,3.4vw,2.6rem)] leading-none" style={{ color: "var(--site-ink,#111)" }}>
                  {r.label}
                </span>
                {(r.metaLeft || r.metaRight) && (
                  <span className="hidden items-baseline gap-8 text-sm md:flex" style={{ color: "var(--site-muted,#666)" }}>
                    {r.metaLeft && <span>{r.metaLeft}</span>}
                    {r.metaRight && <span className="tabular-nums">{r.metaRight}</span>}
                  </span>
                )}
              </div>
              <div className="ssg-media relative h-44 w-full overflow-hidden md:h-52">
                {typeof r.media === "string" ? (
                  <div className="ssg-img absolute inset-0 h-full w-full" style={{ background: r.media }} aria-hidden />
                ) : (
                  <div className="ssg-img absolute inset-0 h-full w-full" aria-hidden>{r.media}</div>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
