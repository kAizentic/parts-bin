"use client";

/**
 * HoverRollLink — a link/label whose text VERTICAL-ROLLS on hover/focus.
 *
 * Pattern — a vertical-roll link (the label is rendered twice):
 * two stacked copies of the label; on hover the top copy rolls up and out while the
 * duplicate rolls in from below. Pure CSS (transforms + `overflow:hidden` clip),
 * no gsap/framer-motion — a tactile micro-interaction for nav items and inline CTAs.
 *
 * Theming: inherits text color; `--site-accent` tints the incoming copy (falls back
 * to currentColor). Renders `<a>` when `href` is set, else `<button>`.
 * Reduced-motion: no roll — a plain color/underline shift on hover instead.
 *
 * Deps: none (CSS via styled-jsx).  effect_type: hover-roll (CSS-only).
 */
import { type ReactNode } from "react";

export default function HoverRollLink({
  children,
  href,
  onClick,
  ariaLabel,
  className = "",
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
}) {
  const inner = (
    <span className="roll">
      <span className="roll__top">{children}</span>
      <span className="roll__btm" aria-hidden>{children}</span>
      <style jsx>{`
        .roll {
          position: relative;
          display: inline-block;
          overflow: hidden;
          vertical-align: bottom;
          line-height: 1.1;
        }
        .roll__top,
        .roll__btm {
          display: block;
          transition: transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .roll__btm {
          position: absolute;
          inset: 0;
          transform: translateY(110%);
          color: var(--site-accent, currentColor);
        }
        :global(a):hover .roll__top,
        :global(a):focus-visible .roll__top,
        :global(button):hover .roll__top,
        :global(button):focus-visible .roll__top {
          transform: translateY(-110%);
        }
        :global(a):hover .roll__btm,
        :global(a):focus-visible .roll__btm,
        :global(button):hover .roll__btm,
        :global(button):focus-visible .roll__btm {
          transform: translateY(0%);
        }
        @media (prefers-reduced-motion: reduce) {
          .roll__top,
          .roll__btm {
            transition: none;
          }
          .roll__btm {
            display: none;
          }
        }
      `}</style>
    </span>
  );

  return href ? (
    <a href={href} aria-label={ariaLabel} className={"inline-block " + className}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={"inline-block " + className}>
      {inner}
    </button>
  );
}
