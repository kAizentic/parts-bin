import type { ComponentType } from "react";
import EditorialIndexHero from "./EditorialIndexHero";
import DossierStatGrid from "./DossierStatGrid";

/**
 * FigureChapter — a "museum chapter" composition (not a new effect).
 *
 * EditorialIndexHero as the chapter opener, a flat two-tone mark behind the
 * type as ground (a placeholder where a design might put bespoke portrait /
 * illustration art), then a DossierStatGrid and a biography/seal sidebar. The
 * band colour arrives via a `--site-*` token override on the wrapper, so both
 * composed parts retheme with zero prop changes. An archival "museum study" layout.
 */
export type Dossier = { label: string; value: string; detail?: string };

export default function FigureChapter({
  id,
  index,
  total,
  name,
  kanji,
  romaji,
  Mon,
  monBg,
  crestColor,
  dossier,
  bio,
  seal,
  band = "band-cream",
}: {
  id: string;
  index: string;
  total: string;
  /** display name, `\n` for the intentional two-line break */
  name: string;
  kanji: string;
  romaji: string;
  Mon: ComponentType<{ bg?: string; className?: string }>;
  /** the band's paper colour — the crest's negative space */
  monBg: string;
  /**
   * Crest colour — set explicitly, NOT inherited. `currentColor` would resolve to
   * `--site-ink`, i.e. the same colour as the display type sitting on top of it, so
   * the crest either vanishes into the band or eats the headline. It wants the
   * third colour in the palette: black under cream type on vermilion, vermilion
   * under black type on cream.
   */
  crestColor: string;
  dossier: Dossier[];
  bio: string[];
  seal?: { kanji: string; gloss: string };
  band?: string;
}) {
  return (
    <section id={id} className={band}>
      {/* Chapter opener: crest sits BEHIND the display type, as the source's
          portrait does — type stays the foreground, art is the ground. */}
      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[82vmin] w-[82vmin] -translate-x-1/2 -translate-y-1/2"
          style={{ color: crestColor, opacity: 0.85 }}
        >
          <Mon bg={monBg} className="h-full w-full" />
        </div>
        <div className="relative">
          <p className="font-jp px-6 pt-[10vh] text-center text-[clamp(1.6rem,4vw,2.6rem)] md:px-12">
            {kanji}
          </p>
          {/* transparent: the crest is the ground, the type is the figure. The
              hero's default paper fill would paint straight over it. */}
          <EditorialIndexHero
            eyebrow={romaji}
            index={index}
            total={total}
            title={name}
            titleClassName="font-display text-[clamp(3.5rem,15vw,15.5rem)]"
            background="transparent"
            className="!py-[6vh]"
          />
        </div>
      </div>

      <DossierStatGrid
        entries={dossier}
        eyebrow="Dossier"
        index={index}
        total={total}
        columns={3}
        labelClassName="text-xs uppercase tracking-[0.18em]"
        valueClassName="font-display text-[clamp(1.5rem,3vw,2.75rem)] leading-none"
      />

      <div className="mx-auto max-w-[100rem] px-6 pb-24 md:px-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_minmax(240px,340px)] md:gap-16">
          <div className="max-w-[62ch]">
            {bio.map((p, i) => (
              <p
                key={i}
                className={
                  "font-editorial " +
                  (i === 0
                    ? "text-[clamp(1.25rem,2.2vw,1.6rem)] leading-[1.5]"
                    : "mt-6 text-[1.0625rem] leading-[1.7]")
                }
                style={i === 0 ? undefined : { color: "var(--site-muted)" }}
              >
                {p}
              </p>
            ))}
          </div>

          {seal && (
            <aside
              className="self-start border-t pt-5"
              style={{ borderColor: "var(--site-hairline)" }}
            >
              <span className="eyebrow mb-4 block">Seal</span>
              <p className="font-jp text-[clamp(2rem,4vw,3rem)] leading-tight">{seal.kanji}</p>
              <p className="mt-3 text-sm" style={{ color: "var(--site-muted)" }}>
                {seal.gloss}
              </p>
            </aside>
          )}
        </div>
      </div>
    </section>
  );
}
