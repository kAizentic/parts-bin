"use client";

/**
 * ScrollSpyNav — a fixed nav whose links carry a hand-drawn underline that DRAWS
 * left→right on hover/focus AND stays drawn for the section currently in view.
 *
 * Pattern — an editorial scroll-spy nav: the underline lives in a wrapper clipped to
 * `inset(0 100% 0 0)` and opens to `inset(0 0 0 0)`. Scroll-spy is an
 * IntersectionObserver on a zero-height band at the viewport MIDLINE
 * (`rootMargin: -50% 0px -50% 0px`), so exactly one section is "current" at a time —
 * no ratio-sorting, no thrash between adjacent sections.
 *
 * Self-contained: the transition ships in styled-jsx, so there is no globals.css
 * dependency. Only the `--site-*` tokens are required.
 *
 * A11y: the active link carries `aria-current="location"`, so the state is not
 * conveyed by the squiggle alone.
 *
 * Deliberately NOT `mix-blend-mode: difference` (the tempting way to survive dark
 * sections): blended nav copy must be declared white, and axe — blind to blend modes —
 * reads that as white-on-white and fails. Solid `--site-paper` is the axe-safe idiom.
 * See XrayBlendCopy's header for the same trap.
 *
 * Theming: `--site-paper` / `--site-ink` / `--site-hairline`.
 * Reduced-motion: the draw transition is dropped; the active state still shows.
 * effect_type: scroll-spy + clip-path draw (CSS-only motion; JS only observes).
 */
import { useEffect, useState, type ReactNode } from "react";

export type SpyLink = { id: string; label: string };

/** Default hand-drawn squiggle. Pass your own `underline` for a different mark. */
function Squiggle() {
  return (
    <svg viewBox="0 0 120 8" preserveAspectRatio="none" className="h-full w-full" fill="none">
      <path
        d="M1 5.2C10 1.6 19 1.4 28 4.6s18 3.6 27 .6 18-3.2 27 .2 18 3.4 27 .2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function ScrollSpyNav({
  links,
  brand,
  brandHref = "#",
  brandClassName = "",
  underline,
  heightRem = 4,
  className = "",
}: {
  links: SpyLink[];
  /** Wordmark / logo node. */
  brand?: ReactNode;
  brandHref?: string;
  brandClassName?: string;
  /** Override the default squiggle mark. */
  underline?: ReactNode;
  heightRem?: number;
  className?: string;
}) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = links
      .map((l) => document.getElementById(l.id))
      .filter((el): el is HTMLElement => el !== null);
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [links]);

  return (
    <header
      className={"ssn fixed inset-x-0 top-0 z-50 " + className}
      style={{
        height: `${heightRem}rem`,
        background: "var(--site-paper,#fff)",
        borderBottom: "1px solid var(--site-hairline,rgba(0,0,0,.14))",
      }}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-full max-w-[100rem] items-center justify-between px-6 md:px-12"
      >
        {brand && (
          <a
            href={brandHref}
            className={"outline-none focus-visible:underline " + brandClassName}
            style={{ color: "var(--site-ink,#111)" }}
          >
            {brand}
          </a>
        )}

        <ul className="flex items-center gap-7 md:gap-9">
          {links.map((l) => (
            <li key={l.id}>
              <a
                href={`#${l.id}`}
                data-active={active === l.id}
                aria-current={active === l.id ? "location" : undefined}
                className="ssn-link relative inline-block py-1 text-sm outline-none focus-visible:opacity-70 md:text-[0.95rem]"
                style={{ color: "var(--site-ink,#111)" }}
              >
                {l.label}
                <span aria-hidden className="ssn-squiggle absolute inset-x-0 -bottom-2 h-[7px]">
                  {underline ?? <Squiggle />}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <style jsx>{`
        .ssn-squiggle {
          display: block;
          clip-path: inset(0 100% 0 0);
          transition: clip-path 420ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ssn-link:hover .ssn-squiggle,
        .ssn-link:focus-visible .ssn-squiggle,
        .ssn-link[data-active="true"] .ssn-squiggle {
          clip-path: inset(0 0 0 0);
        }
        @media (prefers-reduced-motion: reduce) {
          .ssn-squiggle {
            transition: none;
          }
        }
      `}</style>
    </header>
  );
}
