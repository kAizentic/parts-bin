import {
  EditorialIndexHero,
  VelocityMarquee,
  StickyGrowMedia,
  StickyScrubGallery,
  DiagonalBorderSweep,
  RibbonPeelRevealWithGlobe,
  DossierStatGrid,
  ScrubRevealGrid,
  StackingCards,
  InvertChapterBand,
  ShineButton,
  GradientBorderCard,
  HoverRollLink,
} from "../src";

const G = {
  ember: "linear-gradient(135deg,#e8452b 0%,#8f1f12 100%)",
  slate: "linear-gradient(135deg,#26313d 0%,#0e0e12 100%)",
  sand: "linear-gradient(135deg,#c9b48a 0%,#7d6a44 100%)",
  ink: "linear-gradient(135deg,#2a2a32 0%,#0e0e12 100%)",
  teal: "linear-gradient(135deg,#1f6f6b 0%,#0b2b2a 100%)",
  plum: "linear-gradient(135deg,#5a2a4d 0%,#1c0f19 100%)",
};

function SectionLabel({ n, name, note }: { n: string; name: string; note: string }) {
  return (
    <div className="mx-auto max-w-5xl px-6 pt-28 pb-10">
      <div className="flex items-baseline gap-4 border-b pb-4" style={{ borderColor: "var(--site-hairline)" }}>
        <span className="font-display text-sm tracking-[0.3em]" style={{ color: "var(--site-accent)" }}>
          {n}
        </span>
        <h2 className="font-display text-2xl font-semibold uppercase tracking-wide">{name}</h2>
        <span className="ml-auto text-sm" style={{ color: "var(--site-muted)" }}>
          {note}
        </span>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <main>
      {/* 01 — Hero */}
      <EditorialIndexHero
        eyebrow="COMPONENT LIBRARY"
        index="00"
        total="21"
        title={"PARTS\nBIN"}
        subtitle="React · Next · GSAP — token-driven, reduced-motion-safe"
        titleClassName="font-display font-semibold text-[clamp(3.5rem,15vw,15.5rem)] leading-[0.9]"
        subtitleClassName="font-body text-[clamp(1rem,2.4vw,1.6rem)]"
      />

      {/* 02 — Velocity marquee */}
      <VelocityMarquee
        items={["Scroll", "Reveal", "Sticky", "Kinetic", "Editorial", "Reduced-motion-safe"]}
        separator="·"
        className="font-display uppercase text-[clamp(2rem,8vw,6rem)] py-8"
      />

      {/* 03 — StickyGrowMedia */}
      <SectionLabel n="03" name="StickyGrowMedia" note="grows while held, then rests" />
      <StickyGrowMedia word="WORK" restWidth="46vw" grownWidth="92vw" growDistancePx={1000}>
        <div
          className="grid aspect-video w-full place-items-center rounded-lg"
          style={{ background: G.ember }}
        >
          <span className="font-display text-2xl uppercase tracking-widest text-white/90">Featured</span>
        </div>
      </StickyGrowMedia>

      {/* 04 — StickyScrubGallery */}
      <SectionLabel n="04" name="StickyScrubGallery" note="each row wipes open, holds, collapses" />
      <StickyScrubGallery
        cursorLabel="View"
        rows={[
          { id: "r1", label: "Northwind", metaLeft: "Brand · Web", metaRight: "2026", media: G.teal },
          { id: "r2", label: "Meridian", metaLeft: "Editorial", metaRight: "2026", media: G.sand },
          { id: "r3", label: "Halcyon", metaLeft: "Product", metaRight: "2025", media: G.plum },
        ]}
      />

      {/* 05 — DiagonalBorderSweep */}
      <SectionLabel n="05" name="DiagonalBorderSweep" note="two border halves bound a growing reveal window" />
      <DiagonalBorderSweep
        current={
          <div className="px-6 text-center">
            <p className="font-display text-[clamp(2rem,7vw,5rem)] uppercase">Keep scrolling</p>
          </div>
        }
        next={
          <div className="px-6 text-center">
            <p className="font-display text-[clamp(2rem,7vw,5rem)] uppercase">Revealed</p>
          </div>
        }
      />

      {/* 06 — RibbonPeelRevealWithGlobe */}
      <SectionLabel n="06" name="RibbonPeelRevealWithGlobe" note="the front sheet peels into a slinky, revealing a cursor-driven porcelain Earth globe with crosshatched continents" />
      <RibbonPeelRevealWithGlobe
        current={
          <div className="grid h-full w-full place-items-center" style={{ background: G.slate }}>
            <p className="font-display text-[clamp(2rem,6vw,4.5rem)] uppercase text-white/90">Old World</p>
          </div>
        }
        title="New World"
      />

      {/* 07 — DossierStatGrid */}
      <SectionLabel n="07" name="DossierStatGrid" note="archival label→value grid on a hairline frame" />
      <div className="mx-auto max-w-5xl px-6 pb-24">
        <DossierStatGrid
          eyebrow="Specification"
          index="07"
          total="21"
          columns={3}
          entries={[
            { label: "Components", value: "21", detail: "Sections + atoms" },
            { label: "Dependencies", value: "GSAP", detail: "+ CSS-only atoms" },
            { label: "Theming", value: "4 tokens", detail: "--site-*" },
            { label: "Motion", value: "matchMedia", detail: "reduced-motion safe" },
            { label: "Primitive", value: "sticky", detail: "not pin:true" },
            { label: "License", value: "MIT", detail: "attribution-friendly" },
          ]}
          labelClassName="font-body text-xs uppercase tracking-[0.18em]"
          valueClassName="font-display text-[clamp(1.5rem,3vw,2.75rem)] leading-none"
        />
      </div>

      {/* 08 — ScrubRevealGrid */}
      <SectionLabel n="08" name="ScrubRevealGrid" note="images grow from a corner, captions slide in" />
      <div className="mx-auto max-w-6xl px-6 pb-24">
        <ScrubRevealGrid
          eyebrow="Archive"
          items={[
            { id: "g1", media: G.ember, caption: "Ember", span: "md:col-span-7" },
            { id: "g2", media: G.slate, caption: "Slate", span: "md:col-span-5" },
            { id: "g3", media: G.teal, caption: "Teal", span: "md:col-span-5" },
            { id: "g4", media: G.plum, caption: "Plum", span: "md:col-span-7" },
          ]}
        />
      </div>

      {/* 09 — StackingCards */}
      <SectionLabel n="09" name="StackingCards" note="each card rolls up over the last" />
      <StackingCards
        headerClear={4}
        cards={[
          <div key="c1" className="grid h-full place-items-center px-6" style={{ background: G.slate }}>
            <span className="font-display text-4xl uppercase text-white/90">Discover</span>
          </div>,
          <div key="c2" className="grid h-full place-items-center px-6" style={{ background: G.teal }}>
            <span className="font-display text-4xl uppercase text-white/90">Design</span>
          </div>,
          <div key="c3" className="grid h-full place-items-center px-6" style={{ background: G.ember }}>
            <span className="font-display text-4xl uppercase text-white/90">Deliver</span>
          </div>,
        ]}
      />

      {/* 10 — InvertChapterBand */}
      <SectionLabel n="10" name="InvertChapterBand" note="chapter a page by background inversion" />
      <InvertChapterBand invert clipReveal>
        <div className="mx-auto max-w-3xl px-6 py-40 text-center">
          <p className="font-display text-[clamp(1.75rem,5vw,3.5rem)] leading-tight">
            The band flips paper ↔ ink as it enters — no decoration, just contrast.
          </p>
        </div>
      </InvertChapterBand>

      {/* 11 — CSS-only atoms */}
      <SectionLabel n="11" name="CSS-only atoms" note="no GSAP — ShineButton · GradientBorderCard · HoverRollLink" />
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-10 px-6 pb-40">
        <ShineButton>Get started</ShineButton>
        <GradientBorderCard>
          <div className="px-8 py-6">
            <p className="font-display text-lg uppercase tracking-wide">Rotating border</p>
            <p className="text-sm" style={{ color: "var(--site-muted)" }}>
              A 1px conic-gradient hairline.
            </p>
          </div>
        </GradientBorderCard>
        <HoverRollLink>Hover me →</HoverRollLink>
      </div>

      <footer className="border-t px-6 py-16 text-center" style={{ borderColor: "var(--site-hairline)" }}>
        <p className="font-display text-sm uppercase tracking-[0.3em]" style={{ color: "var(--site-muted)" }}>
          Parts Bin · MIT
        </p>
      </footer>
    </main>
  );
}
