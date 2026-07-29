# Parts Bin — Context

A library of token-driven, brand-agnostic React/Next scroll-animation section components, plus a
runnable Next.js showcase (`app/page.tsx`) that composes them with placeholder content. `src/` is the
publishable library; `app/` is the demo.

## Demo showcase conventions (`app/page.tsx`)

When a component **graduates into the demo**, wire its placeholder copy with the site's **default
demo typography** — do not carry over a component's or authoring-tool's own font choices:

- **Display text** → `font-display uppercase text-[clamp(...)]` (Oswald, via `tailwind.config.ts`).
  Match the sizing of neighbouring reveal sections (e.g. `text-[clamp(2rem,6vw,4.5rem)]`).
- **Body/eyebrow text** → `font-body` (Inter), small, tracked.
- Components that render their own text (e.g. `RibbonPeelRevealWithGlobe`'s `title`) expose a
  `*ClassName` prop so the demo can pass these classes — the component's built-in font is only a
  fallback for standalone/library use.

Rationale: the showcase must read as one cohesive site; a graduated part inheriting the rig/bench
typography looks pasted-in. The component stays typography-agnostic; the demo supplies the type.

## Theming a section against the global (dark) theme

The demo's global tokens are a **dark** theme (`--site-paper: #0e0e12`, `--site-ink: #f2eee4`).
Components that read `--site-paper` as a *material tint* (e.g. `RibbonPeelReveal`'s porcelain back
ribbon) will therefore render dark unless the section overrides those tokens. Wrap such a section in
a div that sets `--site-paper`/`--site-ink` to the intended values (section 06 sets them to the
rig's porcelain-on-dark `#ECEAE3` / `#23262B`).

## Rig → demo propagation (automatic — apply → push → live)

The tune lives in **`app/tunes/ribbon-peel-reveal.json`** (a flat knob object). `app/page.tsx` imports
it and spreads it onto `<RibbonPeelRevealWithGlobe {...ribbonPeelTune} …>`, so the demo always renders
whatever that file says. The `animation-rig` Apply is configured to write this exact file (its
`serve.py` `DEMO_TUNE_PATH` points here), so the loop is just:

1. Tune in the rig, click **Apply** → it overwrites `app/tunes/ribbon-peel-reveal.json`.
2. `git push` this repo.
3. Netlify redeploys → the live demo reflects the tune.

No hand-editing `page.tsx`. Only *content/theme* props (`current`, `title`, `titleClassName`, the
`--site-*` override) stay in `page.tsx`; the *motion tune* comes entirely from the JSON. If you rig a
DIFFERENT component later, point that rig's `DEMO_TUNE_PATH` at its own tune file under `app/tunes/`
and spread it the same way. (The vault still keeps its own `usage.tsx` + sidecar copy as the
source-of-truth record; only this JSON drives the live demo.)

**`HopperHoneycombField` was wired the same way** (`app/tunes/hopper-honeycomb.json`) until it was pulled
from the showcase — it is still exported from `src/index.ts` and the tune file is still committed, but
`app/page.tsx` no longer renders it, so `publish-check` stage 4 reports it as a *skip* ("no showcase
slot"), not a failure. Re-wiring it is the import + one section block. The wrinkle to remember if you do:
its lab tunes single colour *channels* (`uLampG`, `uVioletB`, `uLilacB`) while the component takes whole
colours, so those three are folded into `lamp`/`material`/`sheen` by a channel-alias map inside the
component. Any tune key it cannot apply is logged in dev rather than dropped — the point of the loop is
that what you tuned is what ships, and a silent drop breaks that quietly enough to survive a look.

**The bench states which files Apply writes**, fetched from the rig server's `GET /targets` rather than
hardcoded in the UI, with any target inside a deployable repo flagged. Which files a rig session touches
has genuinely varied — one rig wrote only the private lab, another wrote this repo's live tune — with
nothing on screen saying which, so a tune could land somewhere other than where it was meant to.

## Before pushing — `npm run publish-check`

This repo is a **sanitized derivative** of a private component bin, not a mirror of it. The
private copies carry teardown source attributions ("generalised from <site>"), internal
failure-log pointers and wiki links. The public copies must not, and that difference used to
be maintained by hand and by memory.

```
npm run publish-check        # leak gate → typecheck → build → wiring   (~17s)
npm run publish-check:self   # proves the leak gate FIRES, not just that it passes
```

The leak gate is the reason the script exists — a public git history cannot be un-pushed, so
this is the one failure that is not recoverable. It found a live one on its first run (a brand
wordmark in a JSDoc comment). The rest of the stages are ordinary correctness checks.

Two notes on how it is built:

- **Patterns come from what is actually in the private copies**, not from imagination, and each
  carries a `why` so a hit explains itself. `uiverse.io` MIT attributions are explicitly ALLOWED
  — they are a credibility signal, not a leak.
- **Precision was tuned deliberately**, because a gate that cries wolf gets ignored. Wiki links
  are anchored to real vault namespaces so `[[g.coordinates]]` (array indexing) does not trip
  them, and source sites are matched by name so `gl.compileShader` does not look like a domain.
  `--self-test` asserts both directions: fires on injected leaks, silent on the clean tree.

Stage 5 (headless render — live GL context, no horizontal overflow at 400px) is **opt-in**; a
public showcase repo should not carry a browser as a dev dependency just for a pre-push check:
`npm i -D playwright && npx playwright install chromium`.

If a leak is found: fix the **public** copy. The private one is allowed to keep its provenance —
that asymmetry is the point, and "syncing" the two would re-introduce the leak.
