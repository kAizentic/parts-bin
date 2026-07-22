// Parts Bin — public barrel export.
// Every component is a default export in its own file; re-exported here by name.

// — Scroll-scrubbed section reveals & transitions —
export { default as DiagonalBorderSweep } from "./components/DiagonalBorderSweep";
export { default as RibbonPeelReveal } from "./components/RibbonPeelReveal";
export { default as RibbonPeelRevealWithSphere } from "./components/RibbonPeelRevealWithSphere"; // also needs `three`
export { default as RibbonPeelRevealWithGlobe } from "./components/RibbonPeelRevealWithGlobe"; // canvas globe; serves /ne_110m_*.json
export { default as RippleTypeHero } from "./components/RippleTypeHero"; // raw WebGL2 water-ripple type hero (pointer-driven)
export { default as StickyScrubGallery } from "./components/StickyScrubGallery";
export { default as StickyGrowMedia } from "./components/StickyGrowMedia";
export { default as ScrubRevealGrid } from "./components/ScrubRevealGrid";
export { default as XrayBlendCopy } from "./components/XrayBlendCopy";
export { default as InvertChapterBand } from "./components/InvertChapterBand";

// — Sticky / stacking layout —
export { default as StackingCards } from "./components/StackingCards";
export { default as StickyHeaderList } from "./components/StickyHeaderList";
export { default as WordSwapSticky } from "./components/WordSwapSticky";

// — Editorial type & data —
export { default as EditorialIndexHero } from "./components/EditorialIndexHero";
export { default as DossierStatGrid } from "./components/DossierStatGrid";
export { default as FigureChapter } from "./components/FigureChapter";

// — Kinetic & entrance —
export { default as VelocityMarquee } from "./components/VelocityMarquee";
export { default as NewsRoll } from "./components/NewsRoll";
export { default as ScrollSpyNav } from "./components/ScrollSpyNav";
export { default as FollowCursor } from "./components/FollowCursor";

// — CSS-only atoms (no GSAP; adapted from uiverse.io, MIT — see NOTICE.md) —
export { default as ShineButton } from "./components/ShineButton";
export { default as GradientBorderCard } from "./components/GradientBorderCard";
export { default as HoverRollLink } from "./components/HoverRollLink";
