"use client";

/**
 * HopperHoneycombField — a honeycomb of hopper crystals: an array of genuinely DEEP stepped
 * hexagonal wells, resolved per-pixel by a parallax-occlusion raymarch rather than shaded onto
 * a flat plane. That is what produces the defining cue — one camera over the field centre, so a
 * cell's apparent view angle depends on where it sits on screen. Centre cells are seen straight
 * down (terraces concentric); edge cells obliquely, their floors displaced toward screen centre
 * and their near rims occluding their own interiors. The panel also curves away, so the surface
 * recedes rather than merely being shaded as if it did.
 *
 * A thin-film oxide sits on top of the steps: interference phase is thickness / dot(normal, view),
 * so the colour bands MOVE with viewing angle, which is what separates oxidised metal from a
 * static rainbow texture. Because the well is raymarched, every terrace is seen at its own angle
 * for free and the banding wraps down the tube by itself.
 *
 * The field is STATIC at rest — per-cell unevenness is a frozen hash and the grain is fixed, so
 * nothing moves until the pointer does. Two interactions:
 *   hover — a convex lens: domain magnification toward the cursor, with the bump gradient folded
 *           into BOTH the normal and the view ray, so the tented area is genuinely looked at from
 *           a new angle
 *   click — a ring that sweeps the seam network outward AND pops each cell toward the camera as
 *           it passes, on one shared speed function so the two cannot drift apart. The pop is a
 *           real vertical displacement, so a lifted cell shifts under parallax and occludes its
 *           neighbours; on the way back it sinks PAST its resting plane before settling, which
 *           reads as a rebound rather than a deflation.
 *
 * CROSS-TRACK NOTE: this bin is the GSAP section track; this component is a raw-WebGL2 piece
 * (single fullscreen fragment shader, its own rAF loop), like RippleTypeHero and
 * RibbonPeelRevealWith*. It needs no gsap/three — just WebGL2.
 *
 * Theming (token seam): three whole colours, not a palette. `lamp` is the source BEHIND the
 * panel (it reads as the light escaping up through the tubes); `material` is the solid that
 * light reveals; `sheen` is the neon edge caught on the terrace risers. There is no key light
 * and no sky — every reflected term is scaled by one illuminant derived from the lamp, so the
 * material is a colour being REVEALED rather than an independent fill. Each falls back to
 * `--site-accent` / `--site-material` / `--site-sheen` when the prop is omitted.
 * This is a DARK-ground component: it wants `--site-paper` near-black to read.
 *
 * Reduced-motion: the field is drawn once as a still and the rAF loop never starts; hover and
 * the click cascade are not wired. Nothing animates, and the piece loses nothing structural
 * because it is static at rest by design.
 *
 * effect_type: canvas-webgl (parallax-occlusion relief) + pointer-cascade.
 */
import { useEffect, useRef } from "react";

const VERT = `#version 300 es
void main(){
  // fullscreen triangle from gl_VertexID — no buffers
  vec2 p = vec2((gl_VertexID == 1) ? 3.0 : -1.0,
                (gl_VertexID == 2) ? 3.0 : -1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;      // screen-uv space
uniform float uHover;      // 0..1 eased presence
uniform float uRows;       // cell rows down the viewport
uniform float uReduced;    // 1.0 = prefers-reduced-motion
uniform vec4  uPulses[6];  // xy = uv centre, z = birth time, w = active
uniform int   uDebug;      // 0 = normal; 1/2 dump geometry channels for inspection
uniform vec3  uLamp;      // the source colour (token seam)
uniform vec3  uMaterial;  // the solid the source reveals (token seam)
uniform vec3  uSheen;     // the neon edge on the risers (token seam)

/* ── rig knobs ─────────────────────────────────────────────────────────────
   Promoted from shader constants to uniforms so the tuning bench can drive
   them live (animation-rig, 2026-07-27). Every default below is the value the
   constant already held, so the rig's zero state is the delivered render. */
uniform float uCurve;       // panel curvature: extra depth at the frame edge. 0 = flat
uniform float uRimGain;     // neon-sheen gain on the risers: the lit-violet level lever
uniform float uRimPow;      // rim falloff exponent (illum^uRimPow) — tune WITH uIllumFloor
uniform float uIllumFloor;  // illumination floor: sets the radial falloff ratio
uniform float uDip;         // cascade undershoot: how far a cell sinks past rest on the way back
uniform float uRoseB;       // blue of the oxide's rose excursion: the LIT-band hue (36-50+)
uniform float uShadowBlue;  // extra blue in the deepest shadow: the darkest band's hue
uniform float uMagentaB;    // blue of the mid-field floor tint: candidate lit-band lever
uniform float uVioletSat;   // saturation lift on the dim violets — most of the "neon" read
uniform float uSeptumDark;  // septum brightness AT THE MOUTH — the "border" lever
uniform float uSeptumRamp;  // septum brightness across the rest of its width
uniform float uR0;          // hex radius where the well mouth begins: interior vs seam width

#define TAU 6.28318530718

const vec2 K0 = vec2(0.8660254,  0.5);
const vec2 K1 = vec2(0.8660254, -0.5);
const vec2 K2 = vec2(0.0,        1.0);
const vec2 S  = vec2(1.7320508,  1.0);   // flat-top lattice cell

// ── well geometry, in grid units (one cell is 1.0 flat-to-flat) ───────────
// Measured off the reference by sampling a row across one cell chord: ~5 ridges
// per side, then a broad luminance plateau across the middle — a large FLAT
// FLOOR at ~1/3 of the mouth radius. Without that floor the terraces run to a
// point, which crowds the inner rings and makes the outer ones read too thick.
const float N     = 5.0;    // terraces per side, floor edge → mouth
const float RF    = 0.165;  // flat floor radius in ct
/* R0/S0 set the seam thickness: the dark band runs ct = R0 → 1, so a smaller R0 means a
   smaller well mouth and a correspondingly thicker black border. R0 is a uniform now, so
   the interior-versus-seam balance is tunable live.

   S0 and the seam ramps below are expressed as FRACTIONS of the septum's width rather than
   as the absolute constants they used to be (0.865, 0.935, 0.907). Those were all derived
   from R0 = 0.775, and leaving them absolute would have quietly broken the profile as R0
   moved — at R0 above 0.865 the groove would have started INSIDE the well. Fractions keep
   the seam's shape identical at every mouth size; only its width changes. */
#define R0        uR0
#define SEPT(f)   (uR0 + (f) * (1.0 - uR0))   // a fraction f across the septum
#define S0        SEPT(0.40)                  // groove starts 40% across the septum
// RW sets the bright-ridge width: the rendered line comes out wider than the
// riser itself (oblique projection plus light spilling onto the tread), so the
// measured duty cycle lands well above 2*RW. Reference duty is ~0.50.
const float RW    = 0.10;   // riser half-width, as a fraction of one terrace
const float DEPTH = 0.62;   // well depth — deep enough to read as a tube
// Depth vs terrace level is CURVED, not linear: outer steps are shallow, inner
// steps carry most of the drop. With equal-height steps the mouth-to-first-tread
// wall is as tall as any other, and a tall wall seen obliquely projects into a
// fat band right against the seam. Also a truer funnel cross-section.
const float DCURVE = 1.85;
const float GD    = 0.055;  // seam groove depth
const float PARLX = 0.78;   // view-ray slope per unit screen height (the FOV)
const int   STEPS = 42;     // linear search steps (spans LIFT above the rim + DEPTH below)
// Curvature pushes the far cells deeper, so the march has to run further for them.
// The STEP SIZE is held constant and the COUNT grows instead — a curvature-dependent
// dt would change the sampling density with radius, which is the same class of
// artifact as the pulse-gated start plane (a sampling change masquerading as an
// effect). Only the pixels that need the extra reach pay for it.
const int   STEPS_MAX = 112;
const int   REFINE= 4;      // bisection steps
// Peak height of the click cascade's per-cell pop, in the same units as DEPTH. The
// march has to start this far ABOVE the rim plane while a pulse is alive, or a lifted
// cell's raised top sits behind the ray's origin and is simply never intersected.
const float LIFT  = 0.20;

float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// nearest lattice centre of the two interleaved rectangular lattices
vec4 getHex(vec2 p){
  vec4 hC = floor(vec4(p, p - S * 0.5) / S.xyxy) + 0.5;
  vec4 h  = vec4(p - hC.xy * S, p - (hC.zw + 0.5) * S);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hC.xy)
                                           : vec4(h.zw, hC.zw + 0.5);
}

// hex distance AND the facet it belongs to, in one pass:
// hexDist == max(|p·K0|, |p·K1|, |p·K2|); the argmax names the facet normal.
vec3 hexFacet(vec2 p){
  float d0 = dot(p, K0), d1 = dot(p, K1), d2 = dot(p, K2);
  float m = abs(d0);  vec2 n = K0 * sign(d0);
  float a = abs(d1);  if (a > m) { m = a; n = K1 * sign(d1); }
  a = abs(d2);        if (a > m) { m = a; n = K2 * sign(d2); }
  return vec3(n, m);
}

/* ── the heightfield ───────────────────────────────────────────────────────
   Depth below the rim plane, as a function of the hex radius ct ALONE. Because
   it depends only on ct, and d(ct)/dp is exactly 2 * facetNormal, the surface
   gradient is analytic — no finite differencing.

   Radially outward from a cell's centre:  floor → N stepped terraces (tread,
   soft riser, tread, …) → flat rim land → seam groove down to ct = 1, which is
   the boundary shared with the neighbour, so the groove forms one continuous
   crack around every cell.                                                  */

// value-only, for the raymarch inner loop
float reliefD(float ct, float D){
  float u  = clamp((R0 - ct) / (R0 - RF), 0.0, 1.0);   // 0 at mouth, 1 at floor
  float s  = u * N, fl = floor(s), f = s - fl;
  // Riser at the START of each terrace (f = 0 → 2*RW), not its middle. Centring
  // it left a half-terrace of flat tread just inside the mouth, which read as a
  // fat outermost band against the seam. Starting at f = 0 keeps depth continuous
  // with the septum (x = 0 there) while putting a ridge right at the mouth edge.
  float x  = clamp(f / (2.0 * RW), 0.0, 1.0);
  float lv = (fl + x * x * (3.0 - 2.0 * x)) / N;
  float y  = clamp((ct - S0) / (1.0 - S0), 0.0, 1.0);
  return D * pow(lv, DCURVE) + GD * (y * y * (3.0 - 2.0 * y));
}

// full version, evaluated once at the hit point
float relief(float ct, float D, out float dDdct, out float lv, out float f, out float gs){
  float u  = clamp((R0 - ct) / (R0 - RF), 0.0, 1.0);   // 0 at mouth, 1 at floor
  float s  = u * N, fl = floor(s);
  f = s - fl;
  float x   = clamp(f / (2.0 * RW), 0.0, 1.0);       // riser at terrace start
  float ss  = x * x * (3.0 - 2.0 * x);
  float dss = 6.0 * x * (1.0 - x) / (2.0 * RW);      // d(ss)/df
  lv = (fl + ss) / N;
  float y   = clamp((ct - S0) / (1.0 - S0), 0.0, 1.0);
  gs = y * y * (3.0 - 2.0 * y);
  float dgs = 6.0 * y * (1.0 - y) / (1.0 - S0);
  // chain rule through the curve: d(depth)/dct = D*P*lv^(P-1) * dlv/dct, with
  // dlv/dct = -dss/(R0-RF). dss is already 0 on the flat floor (u clamps to 1 →
  // f = 0 → x = 0) and beyond the mouth.
  dDdct = -D * DCURVE * pow(max(lv, 1e-4), DCURVE - 1.0) * dss / (R0 - RF) + GD * dgs;
  return D * pow(lv, DCURVE) + GD * gs;
}

/* ── the cascade jump ──────────────────────────────────────────────────────
   Each cell pops toward the camera as the click's ring passes over it, so the
   jump wave and the seam sweep travel outward at exactly the same speed: the
   ring is at grid radius age*SWEEP, so the cell at radius rr is reached at
   age = rr/SWEEP, and the pop is driven by the local age (age - rr/SWEEP).

   This is a real VERTICAL DISPLACEMENT of the cell's heightfield, not a fake:
   because the whole field is resolved by a raymarch, a lifted cell is genuinely
   nearer the camera, so it shifts under parallax and occludes its neighbours on
   the far side. The offset is constant WITHIN a cell, so its gradient is zero and
   the analytic normal needs no extra work — only the march's start plane moves. */
float sweepSpeed(){ return mix(3.4, 2.1, uReduced); }

float cellLift(vec2 id, float t){
  float lift = 0.0;
  for (int i = 0; i < 6; i++){
    vec4 pu = uPulses[i];
    if (pu.w < 0.5) continue;
    float age = t - pu.z;
    if (age < 0.0 || age > 7.0) continue;
    float rr = length(id * S - pu.xy * uRows);       // cell centre is exactly id * S
    float ta = age - rr / sweepSpeed();              // local age: 0 as the ring arrives
    if (ta < 0.0) continue;                          // wave has not reached this cell
    // k = 13 puts the peak 0.077s behind the ring, tight enough to read as coincident.
    float k = 13.0;
    float x = ta * k;
    /* x*exp(1-x) alone peaks at exactly 1.0 when x = 1 and returns to rest from above,
       which reads as a pop-and-settle. The (1 - uDip*x) factor makes it cross zero and
       SINK past the resting plane before coming back, so the cell rebounds like a struck
       membrane rather than deflating — the ripple read. The dip is a real displacement
       downward, so a sunk cell is genuinely further from the camera and its neighbours
       occlude it, exactly as the pop is genuinely nearer.

       Renormalised so the peak stays LIFT whatever the dip is. The peak of
       x(1-cx)e^(1-x) is the smaller root of  c*x^2 - (1+2c)x + 1 = 0, which is closed
       form — so the dip knob changes the SHAPE without also changing the height, and
       tuning one does not silently retune the other. */
    float c  = max(uDip, 1e-4);
    float xp = ((1.0 + 2.0 * c) - sqrt((1.0 + 2.0 * c) * (1.0 + 2.0 * c) - 4.0 * c)) / (2.0 * c);
    float nrmz = xp * (1.0 - c * xp) * exp(1.0 - xp);
    lift += LIFT * (x * (1.0 - c * x) * exp(1.0 - x) / max(nrmz, 1e-4)) * exp(-age * 0.45);
  }
  // Clamped both ways now: overlapping pulses can neither stack a cell out of the frame
  // nor drive it so far under that it punches through the floor of the well.
  return clamp(lift, -LIFT * 0.85, LIFT * 1.55);
}

/* ── panel curvature ───────────────────────────────────────────────────────
   The terraces already imply a strongly oblique view at the frame edges, but
   the panel itself never receded: the view ray is linear in screen position,
   which is a FLAT sheet under one camera. This bends it.

   Curvature is a real DEPTH OFFSET in the heightfield, not a reshaped ray, so
   the surface genuinely recedes: silhouettes, parallax and occlusion all agree
   with it because they come out of the same march. (Shaping the ray slope
   instead is one line, but the surface does not actually move, so a receding
   cell would still occlude its neighbours as if the sheet were flat.)

   Quadratic in the same aspect-corrected screen radius the illuminant uses.
   The illumination stays keyed on SCREEN radius rather than surface
   arc-length (Michael's call, 2026-07-27): the lamp is a fixed screen-space
   source, so the calibrated 0.44 radial falloff survives the panel bending. */
float curveDepth(vec2 p){
  vec2 u = p / max(uRows, 1e-3);                     // grid units back to screen uv
  float r2 = dot(u * vec2(0.86, 1.0), u * vec2(0.86, 1.0));
  return uCurve * r2;
}
// Analytic gradient of the above: d(uCurve * (0.7396*px^2 + py^2) / rows^2)/dp.
// The heightfield's normal is analytic, so the curvature must be folded in the
// same way or the bent regions light as though they were still flat.
vec2 curveGrad(vec2 p){
  return uCurve * 2.0 * vec2(0.7396 * p.x, p.y) / max(uRows * uRows, 1e-6);
}

// depth at a horizontal position, for the march
float depthAt(vec2 p, float D, float t){
  vec4 hx = getHex(p);
  float d = reliefD(clamp(hexFacet(hx.xy).z * 2.0, 0.0, 1.0), D);
  return d - cellLift(hx.zw, t) + curveDepth(p);     // lifted cell = smaller depth
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 uv   = (frag - 0.5 * uRes) / uRes.y;

  float t    = uTime;
  float rows = uRows;

  // The field is STATIC: no breath, no drift, no depth pulse. Time drives only
  // the click sweep, so between interactions the surface holds perfectly still.
  vec2  pg = uv * rows;                    // entry point on the rim plane
  float D  = DEPTH;

  /* ── where the source is ─────────────────────────────────────────────────
     Computed up here because the oxide film needs it too, not just the shading.
     hr is the screen radius in the source's own aspect-corrected space; spill is the
     broad illumination field and illum is the single scalar every reflected term is
     scaled by. (The orange lamp itself uses a much TIGHTER field, further down.) */
  float hr    = length(uv * vec2(0.86, 1.0));
  float spill = smoothstep(1.16, 0.02, hr);
  // Floor and exponent are set by matching the reference's radial luminance profile,
  // whose outer-over-inner ratio is 0.47. The neon rim's steeper illum^1.7 compounds
  // into that, so the two have to be tuned together.
  float illum = uIllumFloor + (1.0 - uIllumFloor) * pow(spill, 1.20);

  // ── hover: convex lens ------------------------------------------------
  vec2  dv = pg - uMouse * rows;
  float rm = length(dv);
  float R  = 1.90;
  float g  = exp(-(rm * rm) / (R * R)) * uHover;

  // magnify toward the cursor: cells swell as if the sheet is tented up
  vec2 p0 = pg - dv * (0.46 * g);
  // ∇ of the gaussian bump — tilts the normal AND the view ray
  vec2 bumpGrad = (-2.0 / (R * R)) * dv * g;

  // ── the view ray ------------------------------------------------------
  // One camera over the field centre: the ray's horizontal slope grows with
  // distance from screen centre, so centre cells are seen straight down and
  // edge cells obliquely. Tenting the surface under the cursor also swings the
  // local view angle, which is what makes the bulge read as real relief.
  vec2 par = uv * PARLX + bumpGrad * 0.30;

  // ── parallax-occlusion march ------------------------------------------
  // March down from the rim plane until the ray depth overtakes the surface
  // depth, then bisect. Pixels that start on the rim/seam land hit at t = 0
  // and skip the loop entirely.
  /* The cascade lifts cells ABOVE the rim plane, so the march has to start above it —
     otherwise a popped cell's top sits behind the ray origin and is never intersected.
     This start plane is CONSTANT rather than switched on with the pulse: gating it made
     the step size itself change the moment a click landed, which shifted every hit point
     in the frame by a fraction of a step. Measured, that registered as "displacement" out
     at radius 9.5 while the ring was still at 1.36 — a sampling artifact masquerading as
     the effect. A fixed range means clicking cannot perturb a cell the wave has not
     reached yet. STEPS is raised to keep dt at its original 0.0221 over the longer span. */
  const float tMin = -LIFT * 1.55;

  /* Far plane. Curvature deepens the whole cell, so a curved edge cell sits past
     the flat-panel D and would simply never be intersected — the same failure as
     the LIFT start-plane bug, at the other end of the march. Sampled at the point
     the ray actually reaches rather than at its entry, since the ray drifts
     outward (where curvature is deepest) as it descends. */
  float cNear = curveDepth(p0);
  // + the cascade's undershoot: a dipped cell sits BELOW the rest plane, so the far end of
  // the march has to clear it or a sinking cell is never intersected and reads as a hole.
  // Same failure as the LIFT start plane, mirrored to the other end of the ray.
  float far   = D + curveDepth(p0 + par * (D + cNear)) + LIFT * 0.85 + 0.03;

  float lo = tMin, hi = tMin;
  if (tMin < depthAt(p0 + par * tMin, D, t)) {
    float dt = (D - tMin) / float(STEPS);         // calibrated 0.0221, held constant
    int   nst = min(int(ceil((far - tMin) / dt)), STEPS_MAX);
    bool  found = false;
    float tp = tMin;
    for (int i = 1; i <= STEPS_MAX; i++) {
      if (i > nst) break;
      float tc = tMin + float(i) * dt;
      if (tc >= depthAt(p0 + par * tc, D, t)) { lo = tp; hi = tc; found = true; break; }
      tp = tc;
    }
    if (!found) { lo = far; hi = far; }    // ray never escaped: bottom out
    for (int k = 0; k < REFINE; k++) {
      float m = 0.5 * (lo + hi);
      if (m >= depthAt(p0 + par * m, D, t)) hi = m; else lo = m;
    }
  }
  float tHit = hi;
  vec2  p    = p0 + par * tHit;             // the surface point we actually see

  // ── cell + facet at the hit point --------------------------------------
  vec4  hx  = getHex(p);
  vec3  fc  = hexFacet(hx.xy);
  vec2  fn  = fc.xy;                       // outward facet normal
  float ct  = clamp(fc.z * 2.0, 0.0, 1.0); // 0 = well floor, 1 = seam
  vec2  id  = hx.zw;
  // static per-cell variance — keeps the field organically uneven, but frozen
  float pulse   = hash21(id * 13.7 + 4.2);
  float cellVar = hash21(id * 3.77 + 11.0);   // used by both the oxide film and the glow

  float dDdct, lvl, f, gs;
  relief(ct, D, dDdct, lvl, f, gs);

  // ONE monotonic mask for everything outside the well mouth. Two separate masks
  // (a septum ramp that released, and a groove ramp that engaged later) left a gap
  // between them which rendered as a BRIGHT PINK RING sitting inside the black
  // seam — and the groove's own wall is steep, so the riser mask counted it as a
  // terrace riser and handed it full orange. One mask cannot leave a gap.
  // (no backticks in this string: the whole shader lives in a JS template literal)
  /* Fractions of the septum, not absolute offsets. R0 + 0.04 was fine at R0 = 0.775, but as
     the mouth widens those fixed offsets eat the entire remaining band — and one of them
     (the stage-2 ramp) actually INVERTS past R0 0.955, where edge0 overtakes edge1. */
  float septum = smoothstep(SEPT(0.02), SEPT(0.20), ct);

  // exact gradient: d(depth)/dp = d(depth)/dct * d(ct)/dp, and d(ct)/dp = 2 * fn
  vec2 grad = clamp(dDdct * 2.0 * fn, vec2(-14.0), vec2(14.0));
  // The panel's own bend tilts the surface as well. Added AFTER the clamp: that
  // clamp exists to bound the well's near-vertical risers, and folding a gentle
  // global tilt into it would let the steep faces swallow the curvature entirely.
  grad += curveGrad(p);
  vec3 nrm  = normalize(vec3(grad, 1.0));
  nrm = normalize(vec3(nrm.xy - bumpGrad * 1.4, nrm.z));

  vec3  L = normalize(vec3(-0.60, 0.62, 0.50));
  vec3  H = normalize(L + normalize(vec3(-par, 1.0)));
  // half-lambert: the wells are lit from inside as much as from the key light,
  // so a hard terminator on the near wall reads as a hole, not a crystal
  float hl   = 0.5 + 0.5 * dot(nrm, L);
  float diff = hl * hl;
  float wall = smoothstep(0.02, 0.35, abs(dDdct));       // are we on a riser?

  /* Analytic LOD. The thinnest terraces — the ones parallax compresses on a
     well's near side — project to well under a pixel, and point-sampling them
     aliases into shimmer and stair-steps. Where the terrace period falls below
     roughly a pixel, fade the striping toward its own average (2*RW, the riser's
     duty share) so it resolves to a flat tone instead of a moiré. Specular is
     faded out entirely there; a sub-pixel highlight is pure aliasing energy. */
  float periodCt = (R0 - RF) / N;
  float lod  = clamp(fwidth(ct) / (periodCt * 0.85), 0.0, 1.0);
  wall = mix(wall, 2.0 * RW, lod);
  wall *= 1.0 - septum;          // the groove wall is not a terrace riser

  float spec = pow(max(dot(nrm, H), 0.0), 30.0) * wall * (1.0 - lod);

  /* ── bismuth: thin-film oxide iridescence ───────────────────────────────
     What actually reads as "bismuth" is not the stepped geometry (that is just a
     hopper crystal) — it is the oxide film on top of it, which interferes with
     itself and produces angle-dependent colour banding: gold at the rims through
     rose and magenta to violet and teal deeper in.

     Model it the cheap physical way rather than as a hand-painted gradient: the
     optical path through a film of thickness d seen at incidence angle t is d/cos(t),
     so the interference phase is thickness / dot(nrm, view). That single term is what
     makes the bands MOVE with viewing angle, which is the whole tell — a static
     rainbow texture reads as oil slick, not metal. Because the well is raymarched,
     each terrace inside a tube is seen at its own angle for free, so the banding
     wraps down the tube by itself.

     Thickness is deliberately non-uniform: real oxide is thicker where it grew
     longer, so it scales with depth into the tube (lvl), varies per cell, and steps
     per terrace ring — plus fine growth STRIATIONS along each facet. */
  vec3  V   = normalize(vec3(-par, 1.0));            // surface toward the camera
  // The floor here is an ALIASING guard, not physics: phase goes as 1/ndv, so a small ndv
  // pushes the banding to tens of cycles, where a steep riser crosses many colour periods
  // inside one pixel and shatters into rainbow confetti. 0.16 still left visible stripe
  // noise on the OBLIQUE peripheral cells — which is where this fails first, because that
  // is where both ndv is smallest and the terraces are most parallax-compressed. 0.34.
  float ndv = clamp(dot(nrm, V), 0.34, 1.0);

  // striations run along the facet, so measure across it: the in-facet tangent
  float tang = dot(hx.xy, vec2(-fn.y, fn.x));
  const float SF = 118.0;
  // ...and they are far finer than the terraces, so they need their OWN lod guard.
  // Reusing the terrace lod would leave them aliasing badly at cell scale.
  float striLod = clamp(fwidth(tang) * SF * 1.7, 0.0, 1.0);
  float stri    = sin(tang * SF + hash21(id * 5.17) * TAU) * (1.0 - striLod);

  /* lvl dominates on purpose: the oxide gradient should run smoothly DOWN the tube,
     following the geometry, which is what bismuth actually looks like. The per-ring
     hash is only a small dither on top — at 0.15 it was loud enough to break the
     gradient into unrelated stripes. cellVar is generous because adjacent real crystals
     oxidise to visibly different dominant hues, one gold, its neighbour rose. */
  float thick = 0.62 + 0.55 * cellVar + 1.15 * lvl
              + 0.06 * hash21(id * 7.31 + floor(ct * 20.0))   // per-ring dither
              + 0.085 * stri;
  float phase = thick / ndv;
  /* Deliberately NOT a full-spectrum RGB cosine palette. Three phase-shifted cosines
     necessarily sweep through green and teal, and against this piece's orange-and-violet
     scheme that reads as petrol on water rather than oxidised metal — measured, it put a
     quarter of the oxide hue in pure blue, and the teal stripes were the loudest thing in
     the frame. Ramp along the warm-to-violet arc instead, with a rose excursion on the
     second harmonic so the bands still CYCLE (that is the bismuth cue) without ever
     leaving the palette the rest of the render lives in. */
  float w1 = 0.5 + 0.5 * cos(TAU * phase);
  float w2 = 0.5 + 0.5 * cos(TAU * (phase * 2.0 + 0.25));
  vec3  irid = mix(vec3(0.30, 0.09, 0.54),                 // violet end of the film
                   vec3(1.12, 0.54, 0.10), w1);            // gold end
  /* Rose excursion. Its blue is the LIT bands' hue lever: where the film is strong the
     oxide, not cLilac, is what the rim light is tinted by, so the sheen constant barely
     moves bands 36-50+ while this does. At blue 0.55 it sits at hue 333 and drags the lit
     violet red; raising blue rotates it toward the reference's 329-332. */
  irid = mix(irid, vec3(1.00, 0.19, uRoseB), 0.38 * w2);
  /* Away from the source the oxide settles to its VIOLET end. Measured, 100% of the
     warm-classified pixels beyond hr 0.50 were the film's gold band and not the lamp at
     all — the lamp's own field is exactly zero out there. A gold crystal at the frame
     edge competes with the very source it is supposed to be reflecting, which is most of
     what still read as "orange spread" after the lamp had already been tightened twice. */
  irid = mix(vec3(0.30, 0.09, 0.54), irid, clamp(0.16 + 0.84 * spill, 0.0, 1.0));
  // Same discipline as the terrace LOD: where one pixel spans more than about half a
  // colour cycle, fade to the ramp's own mean instead of point-sampling the banding.
  // 1.6 was far too weak — it left rainbow stripe noise across the peripheral cells.
  float iridLod = clamp(fwidth(phase) * 4.2, 0.0, 1.0);
  irid = mix(irid, vec3(0.72, 0.30, 0.34), iridLod);

  /* Fresnel weighting, with a FLOOR. Interference does not vanish at normal incidence —
     the phase is just d/1 there — so gating the film purely on grazing angle left the
     terrace treads with no colour at all, and the treads are exactly where bismuth's
     banding is most legible. It is stronger on the walls, not exclusive to them. */
  // Also fade with the TERRACE lod: where the rings themselves are sub-pixel there is no
  // coherent film colour to show, only noise. This is the same guard the striping uses.
  float film = (0.78 + 0.36 * pow(1.0 - ndv, 1.9)) * (0.62 + 0.38 * wall)
             * (1.0 - septum) * (1.0 - 0.90 * lod);

  // occlusion: deeper terraces see less sky, and the inner corner where each
  // riser meets the tread below it is the darkest part of the step
  // treads sit back, risers catch the light — that contrast IS the terracing
  // contact shadow on the tread immediately inside each riser (gated by (1-wall)
  // so it darkens the shelf, not the bright ridge itself)
  // These multipliers COMPOUND on a tread — depth AO plus the contact shadow both
  // hit the same shelf, which drove the outermost tread to near-black. Only the
  // seam may be black; a sky-facing violet shelf must read violet, so each term
  // is shallow AND the wall factor favours TREADS, not risers: a horizontal shelf
  // sees the whole sky, a near-vertical riser sees very little of it. Having it
  // backwards was starving the treads of ambient to fake striping contrast — that
  // contrast is the orange source's job, not the ambient's.
  float corner = (1.0 - wall) * (1.0 - smoothstep(2.0 * RW, 2.0 * RW + 0.20, f));
  float ao = mix(1.0, 0.80, lvl) * (1.0 - 0.12 * corner) * mix(1.0, 0.78, wall);

  /* ── colour: TWO LAYERS, MIXED BUT NEVER BLENDED ────────────────────────
     The reference is not a violet→orange hue ramp. Lerping between them is the
     error: it manufactures salmon and olive mid-tones that appear nowhere in the
     source. It is a violet SOLID with a concentrated orange LIGHT behind it,
     shining up out of the tubes — two independent layers composited ADDITIVELY.

     Additive is the whole trick. Within one cell the risers face the source and
     go orange while the treads, shadowed from it, stay violet — the two hues sit
     side by side on adjacent terraces, unaveraged. Away from the source the
     violet simply survives instead of being tinted toward orange.            */
  // The source is a CONCENTRATED hotspot, not a wash. Reaching zero only at the
  // frame edge put the orange across the entire viewport: measured coverage of
  // clearly-orange pixels peaked at hr 0.40-0.50 (17.8%) rather than at the centre,
  // and was still 10% out at hr 0.70. A nearer outer radius plus a super-linear
  // falloff pulls it in while leaving the centre's own level alone.
  float field   = smoothstep(0.42, 0.02, hr);            // where the source is (tight: the lamp)
  // Peak deliberately below 1.0 so the centre never CLAMPS. Overdriving it past
  // the clamp flattens the whole core into one saturated plateau — that reads as
  // blown-out and overbearing, and it also swallows the per-cell variation,
  // because every cell in the middle pins to the same maximum.
  /* Per-cell variance MODULATES the source, it does not add to it. As an additive term it
     was radius-independent, so a lucky cellVar put up to +0.17 of glow on cells where the
     source field had already fallen to zero — orange kept appearing at the frame edges no
     matter how far the field was pulled in, and no amount of tightening could remove it.
     Multiplying means an unlit cell stays unlit and the variance only decides how bright
     the cells that ARE lit come out. Hover stays additive: the lens is meant to coax the
     source up locally. */
  float base    = pow(field, 1.55) * 0.86;
  float glow    = clamp(base * (0.60 + 0.80 * cellVar + 0.18 * (pulse - 0.5))
                        + 0.26 * g, 0.0, 1.0);

  /* ── the ONLY illuminant ────────────────────────────────────────────────
     There is no key light and no sky in this scene. The orange source sits behind
     the panel, and everything the eye sees is that light escaping through the tubes
     and reflecting off the oxide — so the violet is a MATERIAL COLOUR being revealed,
     not an independent ambient fill. Lighting the violet on its own is what made the
     field read as uniformly lit: measured, the radial luminance falloff was 0.65
     outer-over-inner where the reference is 0.47, and the first five radial bins were
     essentially flat.

     The spill field is deliberately BROADER than the orange's own field term:
     a direct view down a tube at the source is tight, while the light that bounces
     out and grazes neighbouring crystals carries much further. That difference is
     exactly what keeps the orange local while the violet still reads several cells
     out — the orange is the lamp, the violet is everything the lamp touches.

     spill and illum are declared at the top of main(), because the oxide film needs
     them before this point. */

  /* The reference's violet is a dark PLUM, not a blue-violet: measured over its violet
     population it is (78,13,67) — red slightly ABOVE blue, hue ~310 deg — at mean
     luminance 14.9. This render was (98,31,143), hue 276 deg, luminance 24.9: both far
     too bright and much too blue. Blue is also what desaturates the orange wherever the
     two meet, so pulling it down does double duty. */
  /* Re-measured 2026-07-27 against the reference's hue-by-luminance ramp, which is the
     structure a single "the violet is (78,13,67), hue 310" summary hides. Both images ramp
     from a cool shadow to a warm highlight, but the render's ramp sat 7-14 deg too red at
     EVERY brightness, and worst in the shadows:

        luminance   3-10   10-18  18-26  26-36  36-50  50+
        reference   283    304    317    323    329    332     (mass at 255-270 in the darks)
        render      297    310    324    333    337    339     (nothing at all below 285)

     The earlier "red above blue, dark plum" reading came from the reference's DARK
     population and is right about that population — it just got applied to the whole
     material, which killed the blue-violet the shadows are actually made of. Blue goes
     back into the solid; the sheen keeps red above blue, only less so. */
  vec3 cViolet  = uMaterial;
  // The neon sheen on the riser edges. Reference lit violet is (182,64,125): red above
  // blue, but by 1.46x, where this was running 1.60x — hence pink rather than violet.
  vec3 cLilac   = uSheen;
  vec3 cMagenta = vec3(0.97, 0.17, uMagentaB);   // the source seen almost head-on
  vec3 cOrange  = uLamp;
  vec3 cAmber   = vec3(1.00, 0.50, 0.10);   // hot-end tint; kept well short of yellow

  // ── layer A: the violet solid, lit from OUTSIDE ────────────────────────
  // Kept deliberately dark. Its blue channel is what desaturates the orange
  // where the two overlap — a brighter violet turns every hot cell peach.
  vec3 mat = cViolet * (0.82 + 0.36 * cellVar);
  // Sky ambient keyed on how UP-facing the surface is (nrm.z): treads and the
  // floor catch it fully, steep risers barely. This is what lifts the shelves out
  // of black without touching the risers the orange lands on.
  // The sky coefficient is the lever for overall violet brightness: it lands on
  // up-facing surfaces (treads, floor) and barely touches steep risers, whose
  // nrm.z is ~0.07 — so the violet can be lifted to match the reference without
  // adding blue to the faces the orange lands on.
  /* Kept SMALL. Sky ambient is keyed on nrm.z, so by construction it lights up-facing
     TREADS and starves near-vertical RISERS — and this scene has essentially no sky.
     It is a dark environment lit from within by the source below, so the risers are
     the lit surfaces and the treads are the dark ground between them. Driving overall
     violet brightness from this term (it was 2.05) filled the treads in and made every
     cell read as a solid violet tile: purple plastic, not a deep well. The reference
     is unambiguous — dark ground crossed by bright thin terrace lines, warm in the
     middle and violet-pink at the edges. Brightness belongs on the risers (below). */
  float sky = clamp(nrm.z, 0.0, 1.0);
  // 0.95 is bracketed, not guessed: 2.05 filled the treads into solid tiles, 0.50 put
  // 34.6% of the frame under 12% luminance against the reference's 19.8%.
  // The oxide sits on the SOLID, so it tints the base material too, not only the rim
  // light — tinting just the rim left every tread plain violet, and the treads are
  // exactly where bismuth's colour banding is easiest to read.
  float filmMix = film * (1.0 - 0.55 * glow);   // hot cells keep their incandescence
  /* A multiplicative tint CANNOT introduce a hue the base lacks — mat's green is 0.04, so
     multiplying a teal film into it just yields darker violet, which is why the oxide's
     own gold and teal bands never survived into the frame. Neutralise the base toward a
     desaturated plum in proportion to the film, so the interference colour has something
     to modulate. */
  // LERP toward the oxide colour, do not multiply by it. Multiplying cannot introduce a
  // hue the base lacks, and both cViolet and cLilac have near-zero green (0.04 and 0.18),
  // so every gold and teal band the film generated was being multiplied straight back to
  // violet — measured, gold and teal each stayed under 1.5% of the frame. Substituting
  // the hue at matched luminance is what actually lets the oxide read.
  vec3 matF = mix(mat, irid * 0.30, clamp(0.72 * filmMix, 0.0, 1.0));
  // Everything here is scaled by illum: no term lights the solid independently of the
  // source any more. The residual 0.10 is not ambient so much as a floor that keeps the
  // far crystals legible rather than crushing them to pure black.
  // Gains are ~1.8x the first pass at this structure. Scaling every illum-multiplied term
  // together is safe: the radial falloff is a RATIO, so it is invariant under a common
  // scale — brightness and falloff shape are independent knobs here, which is the whole
  // benefit of routing all of it through one illuminant.
  vec3 col = matF * (0.18 + 0.80 * diff + 0.47 * sky) * ao * illum;
  // The film's own reflection, additive because interference happens in a reflected lobe.
  // The Fresnel weight needs a FLOOR and a gentle exponent: most visible facets point at
  // the camera (mean n.v = 0.795), where pow(1-n.v, 2.6) evaluates to 0.017 and the whole
  // term silently does nothing.
  col += irid * (0.22 + 0.78 * pow(1.0 - ndv, 1.6)) * filmMix * 0.47 * illum;
  // violet-lilac catch on every riser, independent of the source, so peripheral
  // cells keep their terrace striping instead of going smooth
  // Faded out where the source is strong. Its job is keeping PERIPHERAL cells striped;
  // on a hot riser its blue is what dragged the orange population to hue 0 deg and
  // saturation 0.66 (reference: +3.9 deg, 0.737) — i.e. red-magenta rather than orange.
  // ...and THIS is now the main violet, not the ambient: gated by wall, so it lands
  // on risers only. That is what makes a peripheral cell read as bright violet-pink
  // terrace LINES on dark ground, the way the reference does, instead of a filled tile.
  // Faded where the source is strong, since its blue drags a hot cell toward magenta.
  /* The film TINTS the rim light rather than being added as a separate rainbow. Thin-film
     interference redistributes reflected light between wavelengths, it does not deposit
     new light, so a purely additive rainbow both washes the violet out and reads as a
     decal floating over the surface. Multiplying keeps the energy roughly constant and
     makes the colour feel like a property of the metal. mix() from white means the tint
     vanishes wherever the film term is weak, so head-on facets stay plain violet. */
  /* The neon sheen. This is the brightest violet in the frame and it lives on the riser
     edges, so it carries the "neon" read entirely. Two changes from before: it is scaled
     by illum (it used to be independent of the source, which is half of why the field
     looked evenly lit), and it is no longer almost entirely SUPPRESSED where the source is
     strong — that was backwards once the source became the only illuminant. A mild 0.40
     rollback remains so the very hottest cells still resolve as orange rather than pink.
     Reference lit violet is (182,65,126) at luminance 42; this was (144,50,97) at 32.6. */
  vec3  filmTint = mix(cLilac, irid * 1.15, clamp(filmMix, 0.0, 1.0));
  // Falls off STEEPER than the base (illum^1.7, not illum). At the same falloff as
  // everything else the neon rim was bright on every cell at every radius, which made the
  // field read uniformly magenta and left the orange with nothing to be the source OF.
  // Concentrating it is also what makes it read as more neon, not less: sheen is contrast.
  /* In a hot cell the rim is reflected SOURCE light, so it is warm there, not violet — tint
     it rather than dimming it. Suppressing brightness was the wrong lever and I reached for
     it twice: at a gain of 3.90 even a 90% rollback still left ~0.39 of cLilac's 0.74 blue
     landing on the hot risers, and orange saturation stayed pinned near 0.63 against the
     reference's 0.727. Warming the colour removes the blue at its source, and the hot cells
     KEEP their bright terrace edges — which is what the reference actually shows. */
  vec3 rimC = mix(filmTint, vec3(1.00, 0.44, 0.10), clamp(glow * 0.90, 0.0, 1.0));
  col += rimC * wall * (0.34 + 0.66 * diff) * uRimGain * pow(illum, uRimPow)
       * (1.0 - 0.30 * glow);

  // Metallic specular: tinted BY the film (a metal's highlight takes its colour from the
  // surface, unlike a dielectric's white one) and tightened, since bismuth's terrace
  // facets are flat and mirror-like rather than softly scattering.
  float specM = pow(max(dot(nrm, H), 0.0), 58.0) * wall * (1.0 - lod);
  // Specular is reflected SOURCE light, so it scales with illum like everything else.
  col += mix(cLilac, vec3(1.0, 0.78, 0.52), glow) * spec * 0.60 * illum;
  col += irid * specM * (0.30 + 0.70 * filmMix) * 1.50 * illum;

  // ── layer B: the orange source below, ADDED on top ─────────────────────
  // Keyed on DEPTH (how far into the tube we are looking) and weighted hard onto
  // the risers, which are the surfaces actually facing the light.
  // The tube fills with light rather than only glowing at the bottom, so depth
  // weighting stays flat — in the reference a hot cell is orange on every
  // terrace, right out to the mouth, not just in its innermost rings.
  // The tread coefficient is near ZERO on purpose. Letting the treads take even
  // a quarter of the orange turns them muddy brown — violet plus a little orange
  // is exactly the averaged mid-tone this whole model exists to avoid. Risers
  // face the source and take all of it; treads are shadowed from it and stay
  // pure violet. That is what puts the two hues on adjacent terraces unmixed.
  // flatter depth weighting so the OUTER terraces still catch the source — with a
  // steep weighting the outermost ridge went dim and merged into the black seam
  // Gain is deliberately modest now. With the hue-preserving rolloff above, anything
  // past ~2 lands in the same place in the core (the curve asymptotes), so extra gain
  // buys nothing there and only widens the halo — cutting it dims the mid-radius
  // cells, which is exactly where the spread was coming from.
  col += mix(cOrange, cAmber, glow * 0.06) * glow * (0.58 + 0.42 * lvl)
       * (0.05 + 1.95 * wall) * 2.35;

  // The floor is the one place you see the source almost directly, and it reads
  // pink-hot. Kept well below the lit ridges: it is now a LARGE area, so the gain
  // that suited a small centre dot floods it into pale salmon.
  float core = smoothstep(0.80, 1.0, lvl);
  // Magenta is for the MID-FIELD cells, where the source is glancing. A hot cell's
  // floor is seen straight down the tube and reads orange-amber, not pink — leaving
  // this mostly magenta at high glow is what made the centre of the field go pink.
  col += mix(cMagenta, vec3(1.0, 0.48, 0.14), glow * 0.88) * core * (0.16 + 0.50 * glow);

  // The septum — the flat top surface between two cell mouths — is a dark matte
  // band in the reference, NOT a lit rim. Brightening it turns the field into
  // plastic tiles with a picture frame around each one.
  // ── black seams between cells -----------------------------------------
  // ONE monotonic mask covering septum AND groove, so no gap can open between
  // them. Two masks — a septum ramp that released before a groove ramp engaged —
  // left a bright pink ring stranded inside the black seam. The ramp also starts
  // just OUTSIDE the mouth, so it cannot darken the outermost ridge.
  //
  // No glow haze over the top either: the source is BEHIND the panel, so it
  // escapes through the tubes and nowhere else. In the reference the septum stays
  // near-black even between two blazing cells, and a haze would bleed orange onto
  // the violet, re-introducing exactly the blending this model avoids.
  // Two stages, but BOTH monotonic in ct, so their product is monotonic and no
  // bright gap can open between them (that was the stranded-pink-ring bug):
  //   1. the septum is a dark violet SURFACE, not a void — crushing its full
  //      width to near-zero put 35% of the frame under 3% luminance, where the
  //      reference has 5.3%; the reference septum keeps visible tone
  //   2. only a thin crack at the shared boundary goes properly black
  // Three stages, ALL monotonic in ct, so the product stays monotonic and no
  // bright gap can reopen. A single flat septum tone dumps its whole area into one
  // luminance bucket as a spike, whereas the reference falls off gradually across
  // the septum — hence the long gentle stage 2. Stage 1 has to stay short and
  // steep, or the septum is barely darkened at the mouth and reads as a lit
  // picture-frame around every cell.
  float land = septum;              // alias kept for the debug channel
  // Both raised from 0.50 to compensate the lower sky-ambient above: the septum is
  // up-facing, so it took the same cut. Classifying the too-dark pixels through the
  // uDebug geometry channel showed 100% of them were septum — no tread or riser was
  // involved — so this multiplier, not the ambient, was the whole remaining deficit.
  // The crack multiplier below is deliberately NOT lifted: the crack stays black.
  /* The septum runs from the mouth (ct 0.775) to the crack — roughly 22% of the cell
     radius, a wide flat top-facing band. At 0.70 it kept most of the material's brightness
     and read as a lit BORDER drawn around every cell, which is the opposite of the intent:
     the honeycomb read comes from an illuminated tube interior against black, not from an
     outlined tile. Dropped hard at the mouth instead.

     The earlier note that crushing the septum spikes the dark histogram bucket is still
     true and is now a deliberate trade — matching that bucket was never worth an outline
     around every cell, and the reference's own seams are near-black between lit cells.
     Both stages stay monotonic in ct, so their product cannot reopen a bright gap
     (the stranded-pink-ring failure); only their levels moved. */
  col *= mix(1.0, uSeptumDark, septum);                       // drop at the mouth
  col *= mix(1.0, uSeptumRamp, smoothstep(SEPT(0.13), SEPT(0.71), ct));  // ramp to the crack
  // Widened from (0.93, 1.0). Lifting the two septum stages above fixed the mean but
  // left the seam a broad MID-dark band: the reference has more pixels below 8% (14.8%
  // vs 10.9%) and fewer in 12-20% (32.6% vs 38.2%), i.e. a blacker, wider crack with a
  // steeper shoulder rather than a uniformly grey seam. Still monotonic in ct.
  // Bracketed: (0.93,1.0) left only 3.3% of the frame below 3% luminance against the
  // reference's 5.2%; (0.88,0.98) overshot to 9.7%. This lands between them.
  float crack = smoothstep(SEPT(0.587), SEPT(0.955), ct);
  col *= mix(1.0, 0.07, crack);                               // black core

  // ── click: circular sweep confined to the seams ------------------------
  // Masked to the groove itself, which bottoms out exactly at ct = 1 — the
  // boundary shared with the neighbour — so the sweep rides the black seam
  // network and nothing else. Because the groove is real geometry, an oblique
  // cell also occludes its own far seam, which the march handles for free.
  // Masked to the dark border network: the crack itself takes the hot filament,
  // and the dark septum flanking it takes a dimmer glow. Both regions are the
  // ones already multiplied down to near-black above, so the sweep can only ever
  // light the outlines — never a cell face. Keying the filament on the groove
  // alone is not enough: an obliquely-viewed cell occludes its own crack bottom,
  // which cost the ring half its pixels.
  float seamFil  = smoothstep(0.20, 0.92, gs);                  // in the crack
  float seamBand = smoothstep(SEPT(-0.04), SEPT(0.22), ct);     // the dark band
  float sweep = 0.0;
  for (int i = 0; i < 6; i++){
    vec4 pu = uPulses[i];
    if (pu.w < 0.5) continue;
    float age = t - pu.z;
    if (age < 0.0 || age > 7.0) continue;
    vec2  pc  = pu.xy * rows;                            // same transform as pg
    float rr  = length(p - pc);
    float rad = age * sweepSpeed();   // same function the cascade jump uses, by construction
    float w   = 0.30 + 0.055 * rad;                      // front softens as it travels
    float ring = exp(-pow((rr - rad) / w, 2.0));
    sweep += ring * exp(-age * 0.60) * smoothstep(0.0, 0.10, age);
  }
  sweep = min(sweep, 2.0);
  col += (vec3(1.00, 0.86, 0.66) * seamFil  * 2.30
        + vec3(1.00, 0.36, 0.06) * seamBand * 0.95) * sweep;

  // ── grade --------------------------------------------------------------
  col += vec3(1.0, 0.60, 0.35) * g * 0.10;               // hover sheen
  col *= clamp(1.0 - 0.42 * pow(length(uv * vec2(0.80, 1.0)) * 1.26, 2.2), 0.0, 1.0);
  /* HUE-PRESERVING highlight rolloff. A per-channel Reinhard is what turned the hot
     centre pale yellow: with red far above 1.0 and green still in the near-linear
     part of the curve, red is compressed hard and green barely at all, so G/R almost
     doubles. Measured, the brightest central pixels were (255,179,167) with red
     CLIPPED in 99.3% of them — saturation 0.35, a pinkish white. No change to the
     colour constants can survive that, because the hue is being set by which channel
     ran out of range first.
     Instead: compress the MAX channel only, and scale all three by that one factor,
     so the ratio between them is exactly preserved. Below the knee it is the identity
     (the violet solid and the septum are untouched, which keeps the histogram
     calibration intact); above it, output approaches 1.0 asymptotically and therefore
     never clips at all. Saturation in the core costs luminance once red is pinned —
     that trade is the point, since the reference's hot cells are vivid orange, not
     white-hot. */
  /* Deep-shadow blue shift. Measured against the reference, the two images do not just sit
     at different hues — their hue RAMPS have different shapes. From the darkest luminance
     band to the next, the reference swings +21 deg while this render swung +12, so no
     single violet constant can fit both: pushing blue into the solid to fix the darkest
     band overshot the one above it to -10. The shortfall is specific to the near-black
     pixels (septum and far field), so it is corrected there and nowhere else — gated on
     the pixel's own luminance rather than on radius, because it is a property of how
     little light reached the surface, not of where the surface is.
     Applied BEFORE the tone curve so the ratio-preserving compression sees the final hue. */
  float shad = 1.0 - smoothstep(0.012, 0.080, dot(col, vec3(0.299, 0.587, 0.114)));
  col.b += col.b * uShadowBlue * shad;

  /* Saturation, same shadow gate. Hue was only half of what made the violets read wrong:
     the reference's two darkest bands sit at saturation 0.90/0.90 where this render ran
     0.82/0.73, and in a field this dark saturation is most of what reads as NEON. Pushing
     the dim pixels away from their own grey fixes it without touching the lit ridges,
     which already match. Extrapolating through mix() past 1.0 rather than scaling channels
     keeps the hue exactly where the ramp above just put it. */
  /* Its own, WIDER gate. Sharing the blue shift's gate coupled two independent problems:
     the blue belongs only to the near-black pixels (band 2 is already slightly too blue),
     while the saturation shortfall runs right through the mid-darks. One gate could satisfy
     either but not both, and the compromise value was worse for each than a dedicated
     ramp is for its own. */
  float lumc  = dot(col, vec3(0.299, 0.587, 0.114));
  float shadS = 1.0 - smoothstep(0.02, 0.34, lumc);
  col = max(mix(vec3(lumc), col, 1.0 + uVioletSat * shadS), 0.0);

  float peak = max(max(col.r, col.g), col.b);
  const float KNEE = 0.80;
  if (peak > KNEE) {
    float over    = peak - KNEE;
    float mapped  = KNEE + (1.0 - KNEE) * over / (over + (1.0 - KNEE));
    vec3  keepHue = col * (mapped / peak);        // one scalar: ratio exactly preserved
    vec3  toWhite = col / (1.0 + col * 0.42);     // per-channel: desaturates to white
    /* Only genuinely extreme peaks — specular pinpoints and the floor seen almost
       head-on — are allowed to bloom toward white. A strict ratio-preserve everywhere
       is over-correction: a fully saturated orange has a LUMINANCE CEILING near 52%,
       so it left the frame with 0% of pixels above 60% luminance where the reference
       has 7.1%, i.e. no highlights at all. The body of the field stays hue-locked
       (that is what keeps it neon orange rather than amber); only the top slides. */
    // Onset raised from 1.9: the orange layer's gain went to 2.95 to make the core read as
    // a lamp, which pushed far more of it into this desaturating branch — orange saturation
    // fell to 0.629 against the reference's 0.727. The bloom threshold is coupled to the
    // source gain and has to move with it, or brightening the lamp quietly whitens it.
    col = mix(keepHue, toWhite, smoothstep(2.9, 6.0, peak));
  }
  col  = pow(max(col, 0.0), vec3(0.88));
  col += (hash21(frag) - 0.5) * 0.030;                   // fixed grain, no flicker

  // geometry inspection: lets a measurement identify WHICH band a pixel is on,
  // instead of inferring it from screen position
  if (uDebug == 1) { fragColor = vec4(ct, lvl, wall, 1.0); return; }
  if (uDebug == 2) { fragColor = vec4(land, gs, f, 1.0); return; }
  if (uDebug == 3) { fragColor = vec4(irid, 1.0); return; }                    // oxide colour
  if (uDebug == 4) { fragColor = vec4(film, fract(phase), ndv, 1.0); return; } // its drivers

  fragColor = vec4(max(col, 0.0), 1.0);
}`;

/** "#rrggbb" -> [r,g,b] in 0..1, the space the shader's colour constants live in. */
function hexToRgb(hex: string, fallback: [number, number, number]): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export default function HopperHoneycombField({
  lamp,
  material,
  sheen,
  curvature = 1.2,
  dip = 0.62,
  mouthRadius = 0.96,
  cellPx,
  tune,
  interactive = true,
  minHeightVh = 100,
  className = "",
}: {
  /** the source behind the panel — the light escaping up through the tubes.
   *  Omit to read `--site-accent`. */
  lamp?: string;
  /** the solid the source reveals; sets the shadow hue, which is most of the frame.
   *  Omit to read `--site-material`. */
  material?: string;
  /** the neon edge caught on the terrace risers — the brightest non-source colour.
   *  Omit to read `--site-sheen`. */
  sheen?: string;
  /** how far the panel bends away from the camera at the frame edge (0 = a flat sheet) */
  curvature?: number;
  /** how far a cell sinks past its resting plane on the way back from the pop, before
   *  settling. Strongly nonlinear: 0.30 sinks ~6% of the pop height, 0.45 ~25%, 0.60 ~51% */
  dip?: number;
  /** where the well mouth begins, as a fraction of the hex radius — the interior-versus-seam
   *  balance. Higher = bigger lit interior and a thinner seam between cells (0.62–0.98) */
  mouthRadius?: number;
  /** target cell size in px; omit to size cells off the shorter viewport edge */
  cellPx?: number;
  /** a rig tune: shader uniform names → values, applied last so it overrides everything above.
   *  Written by the animation-rig's Apply and committed as JSON, so the loop is
   *  tune → Apply → push → live with no hand-editing of the call site. */
  tune?: Record<string, number>;
  /** wire the hover lens and the click cascade (ignored under reduced motion) */
  interactive?: boolean;
  /** height in vh */
  minHeightVh?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false });
    if (!gl) return;

    const reduceMotion = !matchMedia("(prefers-reduced-motion: no-preference)").matches;
    const live = interactive && !reduceMotion;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    const U = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = U("uRes"), uTime = U("uTime"), uMouse = U("uMouse"), uHover = U("uHover"),
      uRows = U("uRows"), uPulses = U("uPulses[0]");

    gl.uniform1f(U("uReduced"), reduceMotion ? 1 : 0);
    gl.uniform1i(U("uDebug"), 0);

    /* Colour seam: an explicit prop wins, else the CSS token, else the authored default.
       Read from the wrapper so a host theming scope applies. */
    const cs = getComputedStyle(wrap);
    const tok = (name: string) => cs.getPropertyValue(name).trim();
    const cLamp = hexToRgb(lamp ?? tok("--site-accent"), [1.0, 0.288, 0.02]);
    const cMaterial = hexToRgb(material ?? tok("--site-material"), [0.26, 0.032, 0.6]);
    const cSheen = hexToRgb(sheen ?? tok("--site-sheen"), [0.98, 0.24, 0.55]);

    /* Channel aliases. The LAB tunes single channels (it was matching a reference per
       luminance band); this component takes whole colours. Without this map a rig tune of
       the violet would be dropped on the floor — silently, because an unknown uniform name
       just resolves to null. Same failure class as a write-back that persists a subset. */
    const CHANNEL_ALIAS: Record<string, [number[], number]> = {
      uLampG: [cLamp, 1],       // green of the lamp
      uVioletB: [cMaterial, 2], // blue of the material
      uLilacB: [cSheen, 2],     // blue of the sheen
    };
    if (tune) {
      for (const [k, v] of Object.entries(tune)) {
        const alias = CHANNEL_ALIAS[k];
        if (alias && Number.isFinite(v)) alias[0][alias[1]] = v as number;
      }
    }
    gl.uniform3fv(U("uLamp"), cLamp);
    gl.uniform3fv(U("uMaterial"), cMaterial);
    gl.uniform3fv(U("uSheen"), cSheen);

    gl.uniform1f(U("uCurve"), curvature);
    gl.uniform1f(U("uDip"), dip);
    gl.uniform1f(U("uR0"), mouthRadius);

    /* The authored look. These are the values the piece was calibrated at and are deliberately
       NOT props: they are what makes it this material rather than a different one, and moving
       them independently mostly produces a worse version of the same thing. The three colours
       above are the seam; these are the recipe. */
    gl.uniform1f(U("uRimGain"), 1.5);
    gl.uniform1f(U("uRimPow"), 5.0);
    gl.uniform1f(U("uIllumFloor"), 0.0);
    gl.uniform1f(U("uRoseB"), 0.85);
    gl.uniform1f(U("uShadowBlue"), 0.41);
    gl.uniform1f(U("uMagentaB"), 0.815);
    gl.uniform1f(U("uVioletSat"), 0.6);
    gl.uniform1f(U("uSeptumDark"), 0.195);
    gl.uniform1f(U("uSeptumRamp"), 0.45);

    /* The rig tune, applied LAST so it wins over both the props and the recipe above.
       Keyed by the shader's own uniform names, deliberately untranslated — a knob-name →
       prop-name map would be a second copy of the truth, and those drift. Values that are
       not finite numbers (or not uniform-shaped names) are ignored rather than trusted. */
    if (tune) {
      const dropped: string[] = [];
      for (const [k, v] of Object.entries(tune)) {
        if (k in CHANNEL_ALIAS) continue;                       // already folded into a colour
        if (!/^u[A-Za-z0-9]+$/.test(k) || !Number.isFinite(v)) { dropped.push(k); continue; }
        const loc = U(k);
        if (loc) gl.uniform1f(loc, v as number);
        else dropped.push(k);
      }
      // A tune key this component cannot apply is worth saying out loud: the whole point of
      // the rig loop is that what you tuned is what ships, and a silent drop breaks that
      // quietly enough to survive a visual check.
      if (dropped.length && process.env.NODE_ENV !== "production") {
        console.warn(`[HopperHoneycombField] tune keys ignored (no such uniform): ${dropped.join(", ")}`);
      }
    }

    /* Supersample: the drawing buffer is larger than the CSS box so the compositor
       downsamples it. The shader's analytic LOD handles sub-pixel terraces, but the
       raymarched silhouettes and seam edges are hard geometric edges with no analytic
       filter — those only clean up with more samples. Capped by total pixels so a large
       display cannot blow the budget. */
    const SS_MAX = 1.6;
    const PX_CAP = 9.5e6;
    let W = 0, H = 0, rows = 8;

    function resize() {
      if (!canvas || !gl) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const base = canvas.clientWidth * dpr * canvas.clientHeight * dpr;
      let ss = Math.min(SS_MAX, Math.sqrt(PX_CAP / Math.max(base, 1)));
      ss = Math.max(1, ss);
      W = Math.max(1, Math.round(canvas.clientWidth * dpr * ss));
      H = Math.max(1, Math.round(canvas.clientHeight * dpr * ss));
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      gl.viewport(0, 0, W, H);
      gl.uniform2f(uRes, W, H);
      // Size cells off the SHORTER edge, so a narrow pane shows a field rather than four
      // huge cells, then clamp so they never get tiny or gigantic.
      const cssW = canvas.clientWidth || 1;
      const cssH = canvas.clientHeight || 1;
      const px = cellPx ?? Math.min(135, Math.max(63, Math.min(cssW, cssH) / 8.667));
      rows = cssH / px;
      gl.uniform1f(uRows, rows);
    }

    const ro = new ResizeObserver(() => {
      resize();
      if (!live) draw(0);          // a still has to be redrawn on resize; the loop is not running
    });
    ro.observe(canvas);
    resize();

    // ── pointer: smoothed lens centre + eased presence ──────────────────────
    const mouse = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let hover = 0, hoverTarget = 0, seeded = false;

    const MAX = 6;
    const pulses = new Float32Array(MAX * 4);
    let slot = 0;

    const toUv = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left - r.width * 0.5) / r.height,
        y: (r.height * 0.5 - (e.clientY - r.top)) / r.height,
      };
    };

    const onMove = (e: PointerEvent) => {
      const p = toUv(e);
      target.x = p.x; target.y = p.y;
      if (!seeded) { mouse.x = p.x; mouse.y = p.y; seeded = true; }
      hoverTarget = 1;
    };
    const onLeave = () => { hoverTarget = 0; };
    const onDown = (e: PointerEvent) => {
      const p = toUv(e);
      target.x = p.x; target.y = p.y;
      if (!seeded) { mouse.x = p.x; mouse.y = p.y; seeded = true; }
      if (e.pointerType !== "touch") hoverTarget = 1;
      const i = slot * 4;
      pulses[i] = p.x; pulses[i + 1] = p.y; pulses[i + 2] = clock; pulses[i + 3] = 1;
      slot = (slot + 1) % MAX;
    };

    if (live) {
      canvas.addEventListener("pointermove", onMove, { passive: true });
      canvas.addEventListener("pointerleave", onLeave, { passive: true });
      canvas.addEventListener("pointercancel", onLeave, { passive: true });
      canvas.addEventListener("pointerdown", onDown, { passive: true });
    }

    let clock = 0;
    function draw(t: number) {
      if (!gl) return;
      gl.uniform1f(uTime, t);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uHover, hover);
      gl.uniform4fv(uPulses, pulses);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    let raf = 0;
    let last = performance.now();
    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 1 / 20);   // clamp after a stall
      last = now;
      clock += dt;

      // exponential smoothing, framerate-independent
      const kM = 1 - Math.exp(-dt * 9.0);
      const kH = 1 - Math.exp(-dt * (hoverTarget > hover ? 5.0 : 3.0));
      mouse.x += (target.x - mouse.x) * kM;
      mouse.y += (target.y - mouse.y) * kM;
      hover += (hoverTarget - hover) * kH;

      for (let i = 0; i < MAX; i++) {
        if (pulses[i * 4 + 3] > 0.5 && clock - pulses[i * 4 + 2] > 7.0) pulses[i * 4 + 3] = 0;
      }

      draw(clock);
      raf = requestAnimationFrame(frame);
    }

    const onVis = () => { if (!document.hidden) last = performance.now(); };  // no time jump

    if (live) {
      document.addEventListener("visibilitychange", onVis);
      raf = requestAnimationFrame((now) => { last = now; frame(now); });
    } else {
      draw(0);                                   // one still, no loop
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointercancel", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      // free the context rather than waiting for GC — several of these on a page will
      // otherwise push the browser past its WebGL context limit and blank an earlier one
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [lamp, material, sheen, curvature, dip, mouthRadius, cellPx, interactive, tune]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ position: "relative", minHeight: `${minHeightVh}vh`, background: "var(--site-paper, #05010a)" }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", touchAction: "none" }}
      />
    </div>
  );
}
