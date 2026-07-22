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

## Rig → demo propagation (manual seam)

The `animation-rig` Apply writes tuned call-site props to the **vault** `RibbonPeelReveal.usage.tsx`
(+ a sidecar JSON), NOT to this repo's `app/page.tsx`. The demo hardcodes its own call-site props, so
a tune (e.g. `travelVh`) reaches the live demo only when that value is **manually forwarded** into the
demo's component call and pushed. Read the applied value from the rig sidecar, then update `page.tsx`.
