"use client";

/**
 * NewsRoll — a card row that ROLLS in from the left edge.
 *
 * Pattern — a "News / press" L→R fade-roll: the header fades and rises, then
 * the cards come in from `{opacity:0, y, rotateZ:~1.5}` with
 * `transformOrigin:'left top'` and a stagger from the start edge, so they appear
 * to hinge down and roll left→right rather than simply fading up.
 *
 * The rotation is what sells it: pivoting about the top-left corner reads as
 * weight tipping into place. Keep it near 1.5° — past ~3° it turns cartoonish.
 *
 * Theming: `--site-ink` / `--site-muted` / `--site-hairline`.
 * Reduced-motion: cards render static and full-opacity, no roll.
 * Deps: gsap, @gsap/react, gsap/ScrollTrigger.  effect_type: reveal / batch-stagger.
 */
import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export type NewsItem = {
  id: string;
  media: string | ReactNode;
  date: string;
  title: string;
  kicker?: string;
};

export default function NewsRoll({
  items,
  title,
  eyebrow,
  rotate = 1.5,
  className = "",
}: {
  items: NewsItem[];
  title: string;
  eyebrow?: string;
  /** degrees of hinge about the top-left corner. */
  rotate?: number;
  className?: string;
}) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const head = root.current!.querySelector(".nr-head");
        const cards = gsap.utils.toArray<HTMLElement>(".nr-card", root.current!);

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root.current,
            start: "top 78%",
            toggleActions: "play none none none",
          },
        });
        tl.from(head, { opacity: 0, y: 24, duration: 0.6, ease: "power3.out" }).from(
          cards,
          {
            opacity: 0,
            y: 44,
            rotateZ: rotate,
            transformOrigin: "left top",
            duration: 0.85,
            ease: "power3.out",
            stagger: { each: 0.11, from: "start" },
          },
          "-=0.25",
        );
        return () => {
          tl.scrollTrigger?.kill();
          tl.kill();
        };
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} className={className}>
      <div className="mx-auto max-w-[100rem] px-6 md:px-12">
        <div className="nr-head mb-12">
          {eyebrow && <span className="eyebrow mb-4 block">{eyebrow}</span>}
          <h2 className="text-[clamp(2rem,4.4vw,3.2rem)] leading-none">{title}</h2>
        </div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <article key={it.id} className="nr-card">
              <div
                className="aspect-[4/3] w-full overflow-hidden rounded-[2px]"
                style={{ background: typeof it.media === "string" ? it.media : undefined }}
                aria-hidden={typeof it.media === "string" ? true : undefined}
              >
                {typeof it.media === "string" ? null : it.media}
              </div>
              <div
                className="mt-5 pt-4"
                style={{ borderTop: "1px solid var(--site-hairline)" }}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-xs tabular-nums" style={{ color: "var(--site-muted)" }}>
                    {it.date}
                  </span>
                  {it.kicker && <span className="eyebrow">{it.kicker}</span>}
                </div>
                <h3 className="label mt-3" style={{ color: "var(--site-ink)" }}>
                  {it.title}
                </h3>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
