"use client";

/**
 * ScrubRevealGrid — an (optionally asymmetric) grid that reveals on scroll-scrub.
 *
 * Pattern — an editorial archive / press grid: images
 * grow from a corner (`width+height 0→100%`, emulated with a top-left `scale`) and
 * captions fade + slide in (`opacity 0→1`, `x 20%→0`), SCROLL-SCRUBBED and
 * staggered. Use it for archive / press / portfolio-overflow grids; a play-once
 * (non-scrub) variant suits news/blog card grids.
 *
 * Theming: `--site-ink` / `--site-muted`. Each item carries its own grid placement
 * (`span`, Tailwind classes) for asymmetry. Reduced-motion / <768px: static, full-size.
 *
 * Deps: gsap, @gsap/react, gsap/ScrollTrigger.  effect_type: reveal / batch-stagger (scrub).
 */
import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export type GridItem = {
  id: string;
  media: string | ReactNode;
  caption?: ReactNode;
  /** Tailwind column placement for the asymmetric grid (md+). */
  span?: string;
  /**
   * transform-origin this tile grows FROM — the corner it shares with its
   * neighbour. Enables the connected zig-zag (INDEX.md composition note): tiles
   * meet edge-to-edge at gap 0 (A·BR = B·TL, B·BL = C·TR …) and each grows out of
   * the previous one. Omit for the plain corner-grow reveal.
   */
  origin?: string;
};

export default function ScrubRevealGrid({
  items,
  eyebrow,
  scrub = true,
  sequential = false,
  tiled = false,
  rowHeight = 420,
  className = "",
  gridClassName = "grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 md:grid-cols-12",
}: {
  items: GridItem[];
  eyebrow?: string;
  /** true = scrubbed (archive); false = play-once on enter (news cards). */
  scrub?: boolean;
  /**
   * true = each tile starts only as the previous finishes (the connected zig-zag —
   * images grow OUT of one another). false = the bin's overlapping batch stagger.
   */
  sequential?: boolean;
  /**
   * true = a CONNECTED mosaic: every tile is `rowHeight` tall (so tiles in a row
   * share a bottom edge despite differing spans) and captions are lifted out of
   * flow onto the tile. Without this, `aspect-[4/3]` gives differing spans
   * differing heights and in-flow captions wedge rows apart — corners never meet
   * and you get a generic reveal grid, which the INDEX.md note is explicit is a
   * DIFFERENT pattern.
   */
  tiled?: boolean;
  /** px height of every tile in `tiled` mode. */
  rowHeight?: number;
  className?: string;
  gridClassName?: string;
}) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px)", () => {
        const imgs = gsap.utils.toArray<HTMLElement>(".srg-img", root.current!);
        const caps = gsap.utils.toArray<HTMLElement>(".srg-cap", root.current!);
        const common = scrub
          ? { trigger: root.current, start: "top 75%", end: "bottom 65%", scrub: 0.8 as number | boolean }
          : { trigger: root.current, start: "top 80%", toggleActions: "play none none none" };
        const tl = gsap.timeline({ scrollTrigger: common });

        if (sequential) {
          // Connected zig-zag: tile i grows from the corner it shares with tile i-1,
          // and only once i-1 has finished — so each image appears to grow OUT of the
          // previous one diagonally, rather than the whole grid blooming at once.
          const DUR = 1;
          imgs.forEach((img, i) => {
            tl.fromTo(
              img,
              { scale: 0 },
              { scale: 1, transformOrigin: items[i]?.origin ?? "0% 0%", ease: "power3.out", duration: DUR },
              i * DUR,
            );
          });
          caps.forEach((cap, i) => {
            tl.fromTo(
              cap,
              { opacity: 0, xPercent: 20 },
              { opacity: 1, xPercent: 0, ease: "power2.out", duration: DUR * 0.7 },
              i * DUR + DUR * 0.35,
            );
          });
        } else {
          tl.fromTo(imgs, { scale: 0 }, { scale: 1, transformOrigin: "0% 0%", ease: "power3.out", stagger: 0.5, duration: 1.4 }, 0)
            .fromTo(caps, { opacity: 0, xPercent: 20 }, { opacity: 1, xPercent: 0, ease: "power2.out", stagger: 0.6, duration: 1 }, 0.3);
        }
        return () => { tl.scrollTrigger?.kill(); tl.kill(); };
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    // overflow-x:clip contains the captions' resting `xPercent: 20` pre-state, which
    // otherwise hangs ~20% of each caption's width past the grid's right edge and
    // gives the whole page a horizontal scroll before the scrub ever runs. `clip`
    // (not `hidden`) because it doesn't create a scroll container — sticky-safe.
    <section ref={root} className={className} style={{ overflowX: "clip" }}>
      {eyebrow && (
        <span className="mb-12 block text-xs uppercase tracking-[0.16em]" style={{ color: "var(--site-muted,#666)" }}>
          {eyebrow}
        </span>
      )}
      <div className={gridClassName}>
        {items.map((it) => (
          <figure key={it.id} className={"group relative " + (it.span ?? "")}>
            <div
              className={
                tiled
                  ? "w-full overflow-hidden"
                  : "aspect-[4/3] w-full overflow-hidden rounded-[2px]"
              }
              style={tiled ? { height: rowHeight } : undefined}
            >
              {typeof it.media === "string" ? (
                <div className="srg-img h-full w-full" style={{ background: it.media }} aria-hidden />
              ) : (
                <div className="srg-img h-full w-full" aria-hidden>{it.media}</div>
              )}
            </div>
            {it.caption &&
              (tiled ? (
                // A paper chip on the tile: keeps the mosaic edge-to-edge AND keeps
                // the label ink-on-paper, so contrast never depends on whatever
                // gradient happens to sit behind it.
                <figcaption
                  className="srg-cap absolute bottom-0 left-0 z-10 px-3 py-2"
                  style={{ background: "var(--site-paper,#fff)" }}
                >
                  {it.caption}
                </figcaption>
              ) : (
                <figcaption className="srg-cap mt-4">{it.caption}</figcaption>
              ))}
          </figure>
        ))}
      </div>
    </section>
  );
}
