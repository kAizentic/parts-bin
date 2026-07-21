"use client";

/**
 * VelocityMarquee — an infinite word band whose speed tracks SCROLL VELOCITY.
 *
 * Pattern — a velocity-reactive word strip: NOT a
 * CSS `@keyframes` marquee. A base loop drifts the track at a constant rate; a
 * ScrollTrigger reads `self.getVelocity()` and modulates the loop's `timeScale`, so
 * scrolling FAST speeds the band up and scrolling UP reverses it, then it eases back
 * to the base drift (paired with Lenis inertial scroll, this reads as momentum).
 *
 * Theming: inherits `--site-ink` / font via `className`. Optional `--site-accent`
 * tints the separator glyph.
 * Reduced-motion / <768px: a single static row (no duplicate, no motion).
 *
 * Deps: gsap, @gsap/react, gsap/ScrollTrigger.  effect_type: kinetic-marquee.
 */
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function VelocityMarquee({
  items,
  separator = "·",
  /** seconds for one full base loop (lower = faster drift). */
  baseDuration = 22,
  /** base drift direction: 1 = leftward, -1 = rightward. */
  direction = 1,
  className = "text-[clamp(2rem,8vw,6rem)]",
}: {
  items: string[];
  separator?: string;
  baseDuration?: number;
  direction?: 1 | -1;
  className?: string;
}) {
  const section = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px)", () => {
        // Two identical copies sit side by side; moving the track by exactly one copy
        // (-50%) and repeating gives a seamless loop.
        const loop = gsap.fromTo(
          track.current,
          { xPercent: 0 },
          { xPercent: -50 * direction, ease: "none", duration: baseDuration, repeat: -1 },
        );
        const st = ScrollTrigger.create({
          trigger: section.current,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => {
            const v = self.getVelocity();
            // Kick the timeScale by scroll velocity (sign flips on scroll-up), clamp it,
            // then ease back to the base drift so it never runs away.
            const ts = gsap.utils.clamp(-8, 8, direction + v / -320);
            loop.timeScale(ts);
            gsap.to(loop, { timeScale: direction, duration: 0.8, ease: "power2.out", overwrite: true });
          },
        });
        return () => { st.kill(); loop.kill(); };
      });
      return () => mm.revert();
    },
    { scope: section },
  );

  const row = (aria: boolean) => (
    <div aria-hidden={!aria} className="flex shrink-0 items-center gap-[0.6em] whitespace-nowrap pr-[0.6em]">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-[0.6em]">
          <span>{it}</span>
          <span aria-hidden style={{ color: "var(--site-accent, currentColor)" }}>{separator}</span>
        </span>
      ))}
    </div>
  );

  return (
    <div ref={section} className={"overflow-hidden py-[0.4em] " + className}>
      <div ref={track} className="flex w-max font-semibold leading-none tracking-tight">
        {row(true)}
        {/* second copy is decorative — only present under motion, clipped by overflow otherwise */}
        <div className="hidden motion-safe:md:contents">{row(false)}</div>
      </div>
    </div>
  );
}
