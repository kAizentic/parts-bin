"use client";

/**
 * XrayBlendCopy — a sticky statement that "x-rays" the images behind it.
 *
 * Pattern — a sticky "about" statement: the
 * copy lives in a `position: sticky` element with `mix-blend-mode: exclusion`, held
 * in the viewport while differing-size images sit to either side and scroll past.
 * Where the copy overlaps an image it INVERTS ("x-rays"); a `soft` image is masked
 * to a radial fade so only its centre (the "person") drives the effect. The copy
 * swaps heading-1 → heading-2 with HYSTERESIS — forward near the section bottom,
 * revert near the top (a deliberately late trigger).
 *
 * IMPORTANT a11y: put this on a DARK section and use light copy. Declared
 * light-on-dark passes contrast (axe is blind to blend modes); exclusion still
 * reads. Reduced-motion / <768px: no swap, only the resolved heading-2, static.
 *
 * Deps: gsap, @gsap/react, gsap/SplitText, gsap/ScrollTrigger.  effect_type: text-split-reveal + sticky hold + blend.
 */
import { useRef } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, SplitText, ScrollTrigger);

export type XrayImage = { swatch: string; side: "left" | "right"; topVh: number; w: number; h: number; soft?: boolean };

export default function XrayBlendCopy({
  first,
  second,
  images,
  heightVh = 280,
  headingClassName = "text-[clamp(2.2rem,6.6vw,6rem)]",
  className = "",
}: {
  first: string;
  second: string;
  images: XrayImage[];
  heightVh?: number;
  headingClassName?: string;
  className?: string;
}) {
  const section = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLHeadingElement>(null);
  const secondRef = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px)", () => {
        let split: SplitText | null = null;
        const run = () => {
          split = new SplitText(secondRef.current, { type: "words", mask: "words" });
          gsap.set(secondRef.current, { opacity: 1 });
          gsap.set(split.words, { yPercent: 110, opacity: 0 });
          const tl = gsap.timeline({ paused: true });
          tl.to(firstRef.current, { opacity: 0, duration: 0.5, ease: "power2.in" })
            .to(split.words, { yPercent: 0, opacity: 1, duration: 1, ease: "power3.out", stagger: 0.1 }, "<0.1");
          // Measured on the source: swaps at ~50% of the section's scroll progress
          // (halfway down) and reverts at ~50% on the way up. Small dead-band at 0.5.
          let shown = false;
          const st = ScrollTrigger.create({
            trigger: section.current, start: "top top", end: "bottom bottom",
            onUpdate: (self) => {
              if (!shown && self.progress > 0.52) { shown = true; tl.play(); }
              else if (shown && self.progress < 0.48) { shown = false; tl.reverse(); }
            },
          });
          return () => { st.kill(); tl.kill(); };
        };
        if (document.fonts?.ready) document.fonts.ready.then(run); else run();
        return () => split?.revert();
      });
      return () => mm.revert();
    },
    { scope: section },
  );

  return (
    <div ref={section} className={"relative " + className} style={{ minHeight: `${heightVh}vh`, background: "var(--site-ink,#0b0b0a)" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
        {images.map((im, i) => (
          <div key={i} className="absolute" style={{
            top: `${im.topVh}vh`, [im.side]: "6vw", width: im.w, height: im.h, background: im.swatch,
            ...(im.soft ? { WebkitMaskImage: "radial-gradient(60% 60% at 50% 45%, black 55%, transparent 100%)", maskImage: "radial-gradient(60% 60% at 50% 45%, black 55%, transparent 100%)" } : {}),
          }} />
        ))}
      </div>
      <div className="grid place-items-center px-6 md:px-12" style={{ mixBlendMode: "exclusion", position: "sticky", top: 0, minHeight: "100vh" }}>
        <div className="relative mx-auto w-full max-w-5xl text-center" style={{ color: "var(--site-paper,#fff)" }}>
          <h2 ref={firstRef} aria-hidden className={"pointer-events-none absolute inset-0 hidden motion-safe:md:block " + headingClassName}>{first}</h2>
          <h2 ref={secondRef} className={"motion-safe:md:opacity-0 " + headingClassName}>{second}</h2>
        </div>
      </div>
    </div>
  );
}
