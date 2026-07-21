"use client";

/**
 * GradientBorderCard — a card whose 1px border is a slowly rotating conic gradient.
 *
 * Pattern (generalised from the uiverse.io animated-border idiom — MIT): a wrapper paints
 * a conic-gradient and a `@property`-driven angle spins it; an inset panel masks all but a
 * hairline ring, so only the border animates (cheap — one element rotates a background-image
 * via a registered custom property, GPU-friendly). Pure CSS — no JS, no deps.
 *
 * Theming: `--site-paper` (panel) / `--site-ink` (text) / `--site-accent` (the live arc of
 * the gradient; falls back to ink) / `--site-hairline` (the dim rest of the ring).
 * Reduced-motion: under `prefers-reduced-motion: reduce` the angle is frozen to a static
 * accent border (no spin). effect_type: animated-border (CSS-only).
 */
import type { ReactNode } from "react";

export default function GradientBorderCard({
  children,
  className = "",
  radius = 1,
  speed = 6,
}: {
  children: ReactNode;
  className?: string;
  /** rem corner radius */
  radius?: number;
  /** seconds per full rotation */
  speed?: number;
}) {
  return (
    <div className={`gbc ${className}`} style={{ ["--gbc-r" as string]: `${radius}rem`, ["--gbc-speed" as string]: `${speed}s` }}>
      <div className="gbc__panel">{children}</div>
      <style jsx>{`
        @property --gbc-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        .gbc {
          --gbc-angle: 0deg;
          position: relative;
          padding: 1px;
          border-radius: var(--gbc-r, 1rem);
          background: conic-gradient(
            from var(--gbc-angle),
            var(--site-hairline, rgba(0, 0, 0, 0.14)),
            var(--site-accent, var(--site-ink, #111)) 0.12turn,
            var(--site-hairline, rgba(0, 0, 0, 0.14)) 0.3turn
          );
          animation: gbc-spin var(--gbc-speed, 6s) linear infinite;
        }
        .gbc__panel {
          border-radius: calc(var(--gbc-r, 1rem) - 1px);
          background: var(--site-paper, #fff);
          color: var(--site-ink, #111);
          padding: 1.5rem;
          height: 100%;
        }
        @keyframes gbc-spin {
          to {
            --gbc-angle: 360deg;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .gbc {
            animation: none;
            background: linear-gradient(
              var(--site-accent, var(--site-ink, #111)),
              var(--site-accent, var(--site-ink, #111))
            );
          }
        }
      `}</style>
    </div>
  );
}
