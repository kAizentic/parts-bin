"use client";

/**
 * StackingCards — a "roll-up" stack where each card sticks a little lower than the
 * last, covering the previous one and leaving its top edge peeking.
 *
 * Pattern — a roll-up card stack (e.g. sticky tops at 224 → 288 → 352, +64px each):
 * each card is `position: sticky` with
 * a staggered `top`, an opaque background, and an increasing z-index, so as you
 * scroll each card rolls up to cover ~90% of the one beneath. Pure CSS — no JS, no
 * scroll trap.
 *
 * Theming: `--site-paper` / `--site-hairline`. Pair with a sticky section header.
 * Reduced-motion safe (sticky alone is not motion). effect_type: pin (sticky stack).
 */
import type { ReactNode } from "react";

export default function StackingCards({
  cards,
  /** rem of each card left peeking below the one above it. */
  peek = 3.4,
  /** rem cleared at the top (e.g. fixed nav + a sticky section header). */
  headerClear = 7,
  minVh = 58,
  className = "",
}: {
  cards: ReactNode[];
  peek?: number;
  headerClear?: number;
  minVh?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {cards.map((card, i) => (
        <div
          key={i}
          className="sticky"
          style={{
            top: `${headerClear + i * peek}rem`,
            zIndex: 10 + i,
            background: "var(--site-paper,#fff)",
            borderTop: "1px solid var(--site-hairline,rgba(0,0,0,.14))",
            minHeight: `${minVh}vh`,
          }}
        >
          {card}
        </div>
      ))}
    </div>
  );
}
