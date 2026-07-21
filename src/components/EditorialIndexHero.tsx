"use client";

/**
 * EditorialIndexHero — an oversized condensed DISPLAY hero with an archival index.
 *
 * Pattern — an editorial chapter opener:
 * a brutalist-editorial hero — eyebrow label, an archival index numeral ("01 / 05"),
 * a giant condensed display title (per-line SplitText rise on load), and an optional
 * bilingual/secondary face beneath. FLAT INK — no gradient-fill text (a deliberate
 * de-slop choice). Title lines rise; nothing else moves.
 *
 * Theming: `--site-paper` (bg), `--site-ink` (title), `--site-muted` (labels),
 * `--site-accent` (index numeral). Give the display face via `titleClassName`, the
 * secondary face via `subtitleClassName`.
 * Reduced-motion / <768px: fully-resolved static hero (no line rise).
 *
 * Deps: gsap, @gsap/react, gsap/SplitText, gsap/ScrollTrigger.  effect_type: kinetic-type + reveal-stagger.
 */
import { useRef } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, SplitText, ScrollTrigger);

export default function EditorialIndexHero({
  eyebrow,
  index,
  total,
  title,
  subtitle,
  titleClassName = "text-[clamp(3.5rem,15vw,15.5rem)]",
  subtitleClassName = "text-[clamp(1.25rem,3vw,2rem)]",
  background = "var(--site-paper, #faf9f5)",
  className = "",
}: {
  eyebrow?: string;
  index?: string;
  total?: string;
  /** display title; use `\n` (or wrap in the string) for intentional line breaks. */
  title: string;
  /** optional second face beneath — e.g. a bilingual line (織田信長). */
  subtitle?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  /**
   * The hero's own painted background. Pass `"transparent"` to compose it OVER
   * artwork (a crest, an image) held by an ancestor.
   *
   * This is a prop because it was hardcoded, and that silently ate anything placed
   * behind the hero: it paints `--site-paper`, i.e. the SAME colour as the band it
   * sits in, so there is no visual tell that it is painting at all — the art just
   * appears not to have rendered. Being an inline style, no className could
   * override it either. A section component that hardcodes an opaque background
   * cannot be composed over anything.
   */
  background?: string;
  className?: string;
}) {
  const section = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px)", () => {
        let split: SplitText | null = null;
        const run = () => {
          split = new SplitText(titleRef.current, { type: "lines", mask: "lines" });
          gsap.set(titleRef.current, { opacity: 1 });
          // Paused tween played by a ScrollTrigger on entrance. `toggleActions:"play"`
          // alone is NOT enough when the component is the HERO at the top of the page:
          // the trigger is created already past its start, and ScrollTrigger does not
          // fire onEnter for a trigger that is in-range at creation — so the lines would
          // stay parked in their from-state. So we also play immediately if the section
          // is already within the start line at mount.
          const rev = gsap.from(split.lines, {
            yPercent: 110,
            duration: 1,
            ease: "power3.out",
            stagger: 0.12,
            paused: true,
          });
          const st = ScrollTrigger.create({
            trigger: section.current,
            start: "top 80%",
            onEnter: () => rev.play(),
            onLeaveBack: () => rev.reverse(),
          });
          const inView = (section.current?.getBoundingClientRect().top ?? Infinity) <= window.innerHeight * 0.8;
          if (inView) rev.play();
          return () => { st.kill(); rev.kill(); };
        };
        if (document.fonts?.ready) document.fonts.ready.then(run); else run();
        return () => split?.revert();
      });
      return () => mm.revert();
    },
    { scope: section },
  );

  return (
    <header
      ref={section}
      className={"px-6 py-[12vh] md:px-12 " + className}
      style={{ background, color: "var(--site-ink, #141413)" }}
    >
      {(eyebrow || index) && (
        <div className="mb-6 flex items-baseline justify-between">
          {eyebrow && <span className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--site-muted, #6b6b6b)" }}>{eyebrow}</span>}
          {index && (
            <span className="text-sm tabular-nums tracking-[0.2em]" style={{ color: "var(--site-accent, currentColor)" }}>
              {index}{total ? ` / ${total}` : ""}
            </span>
          )}
        </div>
      )}
      {/* Intended breaks are real block elements, NOT `\n` + `white-space: pre-line`.
          Pre-line works only until SplitText re-splits by rendered lines: rebuilding
          the DOM normalises the newline to a space, the forced break silently
          disappears, and the title re-wraps wherever the container happens to end.
          A block per line survives the split (SplitText still sub-splits any line
          that wraps). */}
      <h1
        ref={titleRef}
        className={"font-bold uppercase leading-[0.86] tracking-[-0.01em] motion-safe:md:opacity-0 " + titleClassName}
      >
        {title.split("\n").map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
      </h1>
      {subtitle && <p className={"mt-6 " + subtitleClassName} style={{ color: "var(--site-muted, #6b6b6b)" }}>{subtitle}</p>}
    </header>
  );
}
