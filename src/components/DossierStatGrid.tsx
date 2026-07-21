"use client";

/**
 * DossierStatGrid — a museum-DOSSIER stat grid with archival index numerals.
 *
 * Pattern — an archival "figure dossier" grid:
 * label→value cells (POSITION / TIMELINE / CAPITAL / …) laid on a hairline rule grid
 * with heavy dividers, an optional archival index numeral ("01 / 05") and eyebrow,
 * plus crosshair "+" corner markers (a Swiss-frame idiom). Cells reveal-
 * STAGGER up on enter. Brutalist-editorial framing for credentials/spec grids.
 *
 * Theming: `--site-ink` (text/rules), `--site-paper` (bg), `--site-hairline`
 * (dividers), `--site-muted` (labels), optional `--site-accent` (index numeral).
 * Fonts via `labelClassName` / `valueClassName`.
 * Reduced-motion: cells static + fully visible.
 *
 * Deps: gsap, @gsap/react, gsap/ScrollTrigger.  effect_type: reveal-stagger.
 */
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Entry = { label: string; value: string; detail?: string };

export default function DossierStatGrid({
  entries,
  eyebrow,
  index,
  total,
  columns = 3,
  labelClassName = "text-xs uppercase tracking-[0.18em]",
  valueClassName = "text-[clamp(1.5rem,3vw,2.75rem)] leading-none",
  className = "",
}: {
  entries: Entry[];
  eyebrow?: string;
  /** archival index numeral, e.g. "01". */
  index?: string;
  /** total for the "01 / 05" pairing. */
  total?: string;
  columns?: 2 | 3 | 4;
  labelClassName?: string;
  valueClassName?: string;
  className?: string;
}) {
  const section = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const cells = section.current?.querySelectorAll("[data-cell]");
        if (!cells?.length) return;
        const rev = gsap.from(cells, {
          opacity: 0,
          y: 24,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.06,
          scrollTrigger: { trigger: section.current, start: "top 78%", toggleActions: "play none none reverse" },
        });
        return () => { rev.scrollTrigger?.kill(); rev.kill(); };
      });
      return () => mm.revert();
    },
    { scope: section },
  );

  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns];

  return (
    <div
      ref={section}
      className={"relative px-6 py-16 md:px-12 md:py-24 " + className}
      style={{ background: "var(--site-paper, #faf9f5)", color: "var(--site-ink, #141413)" }}
    >
      {/* crosshair "+" corner markers (Swiss engineering-grid frame) */}
      {["top-4 left-4", "top-4 right-4", "bottom-4 left-4", "bottom-4 right-4"].map((pos) => (
        <span key={pos} aria-hidden className={"pointer-events-none absolute select-none opacity-40 " + pos}>+</span>
      ))}

      {(eyebrow || index) && (
        <div className="mb-8 flex items-baseline justify-between border-b pb-3" style={{ borderColor: "var(--site-hairline, rgba(0,0,0,.15))" }}>
          {eyebrow && <span className={labelClassName} style={{ color: "var(--site-muted, #6b6b6b)" }}>{eyebrow}</span>}
          {index && (
            <span className="text-sm tabular-nums tracking-[0.2em]" style={{ color: "var(--site-accent, currentColor)" }}>
              {index}{total ? ` / ${total}` : ""}
            </span>
          )}
        </div>
      )}

      <dl className={"grid grid-cols-1 " + cols}>
        {entries.map((e, i) => (
          <div
            key={i}
            data-cell
            className="border-t border-l-0 px-0 py-6 sm:border-l sm:px-6 sm:first:border-l-0"
            style={{ borderColor: "var(--site-hairline, rgba(0,0,0,.15))" }}
          >
            <dt className={"mb-3 " + labelClassName} style={{ color: "var(--site-muted, #6b6b6b)" }}>{e.label}</dt>
            <dd className={valueClassName}>{e.value}</dd>
            {e.detail && <dd className="mt-2 text-sm" style={{ color: "var(--site-muted, #6b6b6b)" }}>{e.detail}</dd>}
          </div>
        ))}
      </dl>
    </div>
  );
}
