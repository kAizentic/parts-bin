# Parts Bin

A library of **token-driven, brand-agnostic, reduced-motion-safe** React / Next.js
section components — the scroll-animation building blocks behind editorial marketing
sites. Drop one into a page, set four CSS custom properties on an ancestor, and it
inherits your brand. Every animated component degrades to a fully legible static
layout under `prefers-reduced-motion`.

21 components across scroll-scrubbed reveals, sticky layouts, editorial type, kinetic
motion, and a few dependency-free CSS atoms.

> **Status:** early public release (`0.1.0`). Copy-in friendly — the components are
> small, self-contained `.tsx` files with no build step required; you can vendor a
> single file into `app/components/` or consume the barrel export.

## Requirements

- **React 18+** and a bundler that understands `"use client"` (Next.js App Router, etc.).
- **GSAP 3.12+** and `@gsap/react` (peer deps). `gsap/SplitText` and `gsap/ScrollTrigger`
  are used by some components — both ship free with GSAP 3.13+.
- **Tailwind CSS.** Several components use Tailwind utility classes internally for layout
  (grid placement, spacing, responsive breakpoints). Your app should have Tailwind
  configured with these files in its `content` glob, or those layout classes won't apply.
- **`three`** *(optional)* — only for `RibbonPeelRevealWithSphere`, which imports it
  dynamically, so DOM/CSS-only consumers never pull it in.

## Live demo

This repo is also a runnable Next.js showcase.

```bash
npm install
npm run dev     # http://localhost:3000
```

The demo lives in `app/` and composes ~15 of the components with placeholder media;
`src/` is the library itself (the only thing published to npm — see `files` in
`package.json`).

---

## Design principles

These are the rules the whole library is built on — the reason the components feel
consistent and don't fight each other or your CSS:

1. **Token-driven theming, never hard-coded color.** Components read four CSS custom
   properties (below). Set them once on an ancestor; retheme with zero prop changes.
2. **Reduced-motion is a first-class layout, not an afterthought.** Every animated
   component is wrapped in `gsap.matchMedia()` and ships a real static fallback —
   nothing is ever left stranded at `opacity: 0` outside the `no-preference` branch.
3. **`position: sticky` + ScrollTrigger `scrub`, not GSAP `pin: true`.** Hard pinning
   caused top cutoffs, post-section jump-backs, and short rollouts. Sticky is the
   robust primitive; `overflow-x: clip` on an ancestor keeps oversized display type
   from leaking horizontal scroll.
4. **One owner per animated property.** When a scrub animates size, it animates
   `width` — never a transform — so a parallax effect that owns `transform` never
   fights it. Mixing two owners on one property is the classic source of jitter.
5. **Match the scroll *distance*, not just the effect.** A scrubbed effect played over
   the wrong scroll length feels wrong even when the effect is right ("grows, but too
   fast"). The components expose the distance as a knob (`growDistancePx`, `travelVh`,
   per-row spans) so you can tune duration independently.

## Theming contract

Set these on a wrapping element (all have fallbacks):

| Token             | Role                          |
| ----------------- | ----------------------------- |
| `--site-paper`    | background                    |
| `--site-ink`      | text / marks                  |
| `--site-muted`    | secondary text                |
| `--site-hairline` | 1px dividers                  |
| `--site-accent`   | *(optional)* highlight; falls back to `--site-ink` |

Pass display/body **fonts** via your own `className`s on the components.

## Install

```bash
npm i gsap @gsap/react
# optional — only if you use RibbonPeelRevealWithSphere (dynamically imported):
npm i three
```

Then either **copy the file(s) you want** out of `src/components/` into your app, or
consume the barrel:

```tsx
import { StickyGrowMedia, VelocityMarquee, DiagonalBorderSweep } from "parts-bin";
```

Register the GSAP plugins once per module (the components do this internally, but your
bundler needs them present):

```tsx
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);
```

Pair with [Lenis](https://github.com/darkroomengineering/lenis) smooth scroll
(`lerp ~0.1`) for the intended momentum feel on the velocity/scrub components.

## Quick example

```tsx
export default function Page() {
  return (
    <main
      style={{
        // set the brand once; every component below inherits it
        ["--site-paper" as string]: "#101014",
        ["--site-ink" as string]: "#f2eee4",
        ["--site-muted" as string]: "#8a8a90",
        ["--site-hairline" as string]: "#2a2a30",
        ["--site-accent" as string]: "#e8452b",
      }}
    >
      <VelocityMarquee items={["Design", "Build", "Ship"]} separator="·" />
      <StickyGrowMedia word="WORK" restWidth="46vw" grownWidth="92vw">
        <video src="/hero.mp4" autoPlay muted loop playsInline />
      </StickyGrowMedia>
    </main>
  );
}
```

See `src/examples/` for tuned call-site presets of the more configurable components.

## Components

### Scroll-scrubbed reveals & transitions
| Component | What it does |
| --- | --- |
| `DiagonalBorderSweep` | Pinned section transition: two 5-layer border halves sweep in from opposite corners and bound a growing window that reveals the next section. |
| `RibbonPeelReveal` | The front sheet is sliced into a side-profile "slinky" of arced coils that thins to nothing, wiping the current section away to reveal the next (a moving mask edge, not a fade). |
| `RibbonPeelRevealWithSphere` | `RibbonPeelReveal` with a lit WebGL sphere as the revealed object, spun to face and carrying a flat billboard type-plate. *Also needs `three`* (dynamically imported). |
| `StickyScrubGallery` | A pinned "selected work" gallery: each row's media wipes open to full width, holds, then collapses as the next opens. |
| `StickyGrowMedia` | A hero media card that grows while held in the viewport, then rests; with mouse parallax. |
| `ScrubRevealGrid` | Asymmetric grid whose images grow from a corner and captions slide in — scrubbed or play-once; upgradable to a connected edge-to-edge zig-zag. |
| `XrayBlendCopy` | A sticky statement that "x-rays" images behind it via `mix-blend-mode: exclusion`, swapping headings with hysteresis. |
| `InvertChapterBand` | Full-bleed section that inverts `--site-paper` ↔ `--site-ink` on scrub — chapter a long page by background inversion. |

### Sticky / stacking layout
| Component | What it does |
| --- | --- |
| `StackingCards` | Roll-up stack: each card sticks a little lower, covering the one beneath and leaving its top edge peeking. Pure CSS. |
| `StickyHeaderList` | Sticky section header while a list of rich rows (media · number · name · sub-list) scrolls past. |
| `WordSwapSticky` | A large statement that holds with the viewport and swaps heading-1 → heading-2 with rising SplitText words. |

### Editorial type & data
| Component | What it does |
| --- | --- |
| `EditorialIndexHero` | Oversized condensed display hero — eyebrow, archival index numeral, giant per-line-rising title. Flat ink, no gradient fill. |
| `DossierStatGrid` | Museum-dossier label→value grid on a hairline frame with an index numeral and crosshair corner markers; cells reveal-stagger. |
| `FigureChapter` | A composition (no new effect): `EditorialIndexHero` + `DossierStatGrid` + bio/seal sidebar, all retheming from one `--site-*` override. |

### Kinetic & entrance
| Component | What it does |
| --- | --- |
| `VelocityMarquee` | Infinite word band whose speed tracks scroll velocity (reverses on scroll-up, eases back to base drift) — not a CSS keyframe marquee. |
| `NewsRoll` | A card row that rolls in from the left edge, hinging about the top-left corner (keep rotation near 1.5°). |
| `ScrollSpyNav` | Fixed nav with a hand-drawn underline that draws L→R on hover and stays drawn for the in-view section (IntersectionObserver at the viewport midline). |
| `FollowCursor` | A custom disc that lerps after the pointer and shows labels — zone-gated to `[data-cursor-zone]` ancestors; native cursor elsewhere. |

### CSS-only atoms (no GSAP — see [NOTICE.md](./NOTICE.md))
| Component | What it does |
| --- | --- |
| `ShineButton` | CTA with a diagonal light sheen that sweeps on hover/focus. Renders `<a>` or `<button>`. |
| `GradientBorderCard` | Card with a 1px rotating conic-gradient hairline border. |
| `HoverRollLink` | Link whose text vertical-rolls on hover: two stacked copies, one rolls out as the other rolls in. |

## Accessibility & mobile

- **Every** animated component removes motion under `prefers-reduced-motion: reduce`
  and lands in a legible static state (the *resolved* end state, never a blank one).
- Scrub/grow components additionally gate on `min-width: 768px` where the motion only
  makes sense on larger viewports; below that they render static.
- `FollowCursor` is gated to `(hover: hover) and (pointer: fine)` — it never shows on
  touch.

## License

MIT © 2026 Michael McConnell. See [LICENSE](./LICENSE) and
[NOTICE.md](./NOTICE.md) for third-party attributions.
