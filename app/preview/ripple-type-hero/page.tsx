import type { Metadata } from "next";
import RippleTypeHeroPreview from "./preview-client";

/**
 * PUBLIC LIVE PREVIEW for the RippleTypeHero Framer Marketplace listing.
 *
 * This is the URL that goes in the listing's "Preview URL" field, so it follows Framer's
 * component listing guidance deliberately:
 *   - ONE visible instance, nothing else on the page
 *   - no branding, navigation, ads or unrelated content
 *   - the preview stays focused on the component itself
 *
 * It renders the Framer component file VERBATIM (`framer/RippleTypeHero.framer.tsx`, resolved
 * through the committed `framer-shim`), spreading its own `defaultProps` — so what a visitor sees
 * here is exactly what a buyer gets when they drop the component on a Framer canvas. Rendering the
 * site-side `src/components/RippleTypeHero.tsx` instead would be a proxy that can silently drift
 * from the thing being sold.
 */

export const metadata: Metadata = {
  title: "RippleTypeHero — live preview",
  description:
    "Pointer-driven WebGL water that refracts large typography. Click the surface to seed a drop; the Rain control toggles an ambient downpour.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <RippleTypeHeroPreview />;
}
