"use client";

/**
 * WordSwapSticky — a large statement that holds with the viewport and swaps copy.
 *
 * Pattern — a held "about" statement:
 * the big copy lives in a CSS `position: sticky` inner inside a TALL section, so it
 * HOLDS with the viewport as you scroll through. The swap PLAYS on enter (not
 * scrubbed): heading-1 fades out while heading-2's SplitText WORDS rise
 * (`y 25%→0`, `opacity 0→1`, `stagger .1`).
 *
 * Theming: inherits text color; size via `className` on the headings wrapper.
 * Reduced-motion / <768px: no sticky-swap, only the resolved second heading shows.
 *
 * Deps: gsap, @gsap/react, gsap/SplitText, gsap/ScrollTrigger.
 * effect_type: text-split-reveal (+ sticky hold).
 */
import { useRef } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, SplitText, ScrollTrigger);

export default function WordSwapSticky({
  first,
  second,
  heightVh = 250,
  headingClassName = "text-[clamp(2rem,6vw,5rem)]",
  className = "",
}: {
  first: string;
  second: string;
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
          const tl = gsap.timeline({
            scrollTrigger: { trigger: section.current, start: "top 45%", end: "bottom top", toggleActions: "play none none reverse" },
          });
          tl.to(firstRef.current, { opacity: 0, duration: 0.5, ease: "power2.in" })
            .to(split.words, { yPercent: 0, opacity: 1, duration: 1, ease: "power3.out", stagger: 0.1 }, "<0.15");
          return () => tl.scrollTrigger?.kill();
        };
        if (document.fonts?.ready) document.fonts.ready.then(run); else run();
        return () => split?.revert();
      });
      return () => mm.revert();
    },
    { scope: section },
  );

  return (
    <div ref={section} className={"relative " + className} style={{ minHeight: `${heightVh}vh` }}>
      <div className="grid place-items-center px-6 md:sticky md:top-0 md:h-screen md:px-12">
        <div className="relative mx-auto w-full max-w-5xl text-center">
          <h2 ref={firstRef} aria-hidden className={"pointer-events-none absolute inset-0 hidden motion-safe:md:block " + headingClassName}>
            {first}
          </h2>
          <h2 ref={secondRef} className={"motion-safe:md:opacity-0 " + headingClassName}>
            {second}
          </h2>
        </div>
      </div>
    </div>
  );
}
