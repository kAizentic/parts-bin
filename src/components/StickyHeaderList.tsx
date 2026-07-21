"use client";

/**
 * StickyHeaderList — a sticky section header with a scrolling list of rich rows.
 *
 * Pattern — a services / capabilities section: a CSS `position: sticky` header HOLDS at the top while a list
 * of rows scrolls past. Each row is a grid: media · number · name · a
 * hairline-separated sub-list ("Tools" / deliverables). Pure CSS sticky (no scroll
 * trap); per-row entrance is a no-preference-gated fade-rise.
 *
 * Theming: `--site-paper` / `--site-ink` / `--site-hairline` / `--site-muted`.
 * Reduced-motion / <768px: header still sticks (harmless), rows render static.
 *
 * Deps: gsap, @gsap/react, gsap/ScrollTrigger (only for the row entrance).
 * effect_type: pin (sticky) + reveal.
 */
import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export type ListRow = {
  id: string;
  n?: string;
  name: string;
  /** CSS background string OR a ReactNode for the row thumbnail. */
  media?: string | ReactNode;
  items?: string[];
  itemsLabel?: string;
};

export default function StickyHeaderList({
  title,
  eyebrow,
  rows,
  className = "",
}: {
  title: ReactNode;
  eyebrow?: string;
  rows: ListRow[];
  className?: string;
}) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const items = gsap.utils.toArray<HTMLElement>(".shl-row", root.current!);
        items.forEach((el) =>
          gsap.from(el, {
            opacity: 0,
            y: 28,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none none" },
          }),
        );
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} className={"relative " + className}>
      <div className="mx-auto max-w-[100rem] px-6 md:px-12">
        <div className="sticky top-0 z-10 -mx-6 px-6 pb-6 pt-8 md:-mx-12 md:px-12" style={{ background: "var(--site-paper,#fff)" }}>
          {eyebrow && (
            <span className="mb-4 block text-xs uppercase tracking-[0.16em]" style={{ color: "var(--site-muted,#666)" }}>
              {eyebrow}
            </span>
          )}
          <h2 className="text-[clamp(2.6rem,8vw,6.5rem)] leading-none">{title}</h2>
        </div>
        <div>
          {rows.map((r) => (
            <div
              key={r.id}
              className="shl-row grid grid-cols-1 items-start gap-5 py-8 md:grid-cols-[220px_2.5rem_1fr_minmax(220px,300px)] md:gap-8"
              style={{ borderTop: "1px solid var(--site-hairline,rgba(0,0,0,.14))" }}
            >
              {r.media !== undefined &&
                (typeof r.media === "string" ? (
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-[2px] md:w-[220px]" style={{ background: r.media }} aria-hidden />
                ) : (
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-[2px] md:w-[220px]" aria-hidden>{r.media}</div>
                ))}
              {r.n && <span className="text-sm tabular-nums" style={{ color: "var(--site-muted,#666)" }}>{r.n}</span>}
              <h3 className="text-[clamp(1.6rem,3.2vw,2.6rem)] font-semibold leading-tight">{r.name}</h3>
              {r.items && (
                <div>
                  {r.itemsLabel && (
                    <span className="mb-3 block text-xs uppercase tracking-[0.16em]" style={{ color: "var(--site-muted,#666)" }}>
                      {r.itemsLabel}
                    </span>
                  )}
                  <ul>
                    {r.items.map((t) => (
                      <li key={t} className="py-2.5 text-sm" style={{ borderTop: "1px solid var(--site-hairline,rgba(0,0,0,.14))", color: "var(--site-ink,#111)" }}>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
