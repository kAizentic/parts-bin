"use client";

/**
 * ShineButton — a CTA with a diagonal light sheen that sweeps across on hover.
 *
 * Pattern (generalised from the uiverse.io CSS-button idiom — MIT, attribution-friendly):
 * a `::before` highlight bar skewed and parked off the left edge, translated fully across
 * on `:hover`/`:focus-visible`. Pure CSS — no JS, no deps. The sweep is the only motion;
 * everything else (fill, text) is static, so it degrades cleanly.
 *
 * Theming: `--site-ink` (fill) / `--site-paper` (label) / `--site-accent` (sheen, falls
 * back to a translucent paper). Pass font via your own class. Renders as <a> when `href`
 * is set, else <button>.
 * Reduced-motion: under `prefers-reduced-motion: reduce` the sweep is removed (instant,
 * no transform). effect_type: hover-sheen (CSS-only).
 */
import type { ReactNode } from "react";

export default function ShineButton({
  children,
  href,
  onClick,
  className = "",
  ariaLabel,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
}) {
  const inner = (
    <>
      <span className="shine-btn__label">{children}</span>
      <span aria-hidden className="shine-btn__sheen" />
      <style jsx>{`
        .shine-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 0.85rem 1.6rem;
          border: 1px solid var(--site-ink, #111);
          border-radius: 0.6rem;
          background: var(--site-ink, #111);
          color: var(--site-paper, #fff);
          font: inherit;
          letter-spacing: 0.02em;
          cursor: pointer;
          text-decoration: none;
          isolation: isolate;
        }
        .shine-btn__label {
          position: relative;
          z-index: 1;
        }
        .shine-btn__sheen {
          position: absolute;
          top: 0;
          left: 0;
          z-index: 0;
          width: 45%;
          height: 100%;
          transform: translateX(-180%) skewX(-20deg);
          background: linear-gradient(
            90deg,
            transparent,
            var(--site-accent, rgba(255, 255, 255, 0.55)),
            transparent
          );
          transition: transform 0.6s ease;
          pointer-events: none;
        }
        .shine-btn:hover .shine-btn__sheen,
        .shine-btn:focus-visible .shine-btn__sheen {
          transform: translateX(320%) skewX(-20deg);
        }
        @media (prefers-reduced-motion: reduce) {
          .shine-btn__sheen {
            display: none;
          }
        }
      `}</style>
    </>
  );

  if (href) {
    return (
      <a href={href} aria-label={ariaLabel} className={`shine-btn ${className}`}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={`shine-btn ${className}`}>
      {inner}
    </button>
  );
}
