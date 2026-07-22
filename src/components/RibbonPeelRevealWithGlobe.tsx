"use client";

/**
 * RibbonPeelRevealWithGlobe — RibbonPeelReveal with a canvas Earth GLOBE as the revealed object.
 * As the front ribbon peels away, a porcelain globe (same tint as the ribbon front) is uncovered,
 * its continents drawn as a NAVY CROSSHATCH engraving with a crisp coastline. The globe's rotation
 * FOLLOWS THE CURSOR (yaw + pitch, eased, with a gentle idle drift) and it GROWS from `growFrom`→
 * full over the reveal so it reads as *contained within* the coil structure, not pasted over a
 * cleared stage. Pure 2D canvas (orthographic projection) — no WebGL, no `three`.
 *
 * The whole thing runs off ONE scroll playhead: RibbonPeelReveal's `onProgress` drives the globe's
 * grow target. The load-bearing timing rule — the ribbon must be fully gone (`peelEnd`, default
 * 0.68) BEFORE the globe finishes growing (`settleEnd`, default 1.0) — is what sells the
 * "contained within" read (same rule as the WithSphere sibling).
 *
 * Continent geometry is Natural Earth 110m GeoJSON, fetched at runtime from `landUrl` / `coastUrl`
 * (default `/ne_110m_land.json` + `/ne_110m_coastline.json`) — ship those two files with your app
 * (this bin's demo serves them from `public/`). Until they load, the globe is a plain porcelain
 * disc. This is the one asset dependency, analogous to WithSphere needing `three`.
 *
 * Theming: the ribbon inherits `--site-paper` / `--site-ink`; the globe's own porcelain/navy are
 * explicit props (`globePaper` / `globeInk`) since it's the focal object, not chrome. Reduced
 * motion: stacked static sections; the globe is parked full-size (onProgress never fires).
 *
 * Deps: gsap, @gsap/react, gsap/ScrollTrigger.  effect_type: pin/scrub full-bleed reveal + spatial-object.
 */
import { useEffect, useRef } from "react";
import RibbonPeelReveal from "./RibbonPeelReveal";

const DEG = Math.PI / 180;

// hex → [r,g,b]
function norm(hex: string): [number, number, number] {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((x) => x + x).join("");
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}
function hexa(hex: string, a: number) { const c = norm(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function shade(hex: string, pct: number) {
  const c = norm(hex), f = pct / 100;
  const m = (v: number) => Math.max(0, Math.min(255, Math.round(v + (pct < 0 ? v * f : (255 - v) * f))));
  return `rgb(${m(c[0])},${m(c[1])},${m(c[2])})`;
}
// flatten a GeoJSON FeatureCollection into an array of rings ([[lon,lat],...])
function ringsOf(fc: any): number[][][] {
  const out: number[][][] = [];
  if (!fc || !fc.features) return out;
  for (const f of fc.features) {
    const g = f.geometry; if (!g) continue;
    const polys =
      g.type === "Polygon" ? [g.coordinates]
      : g.type === "MultiPolygon" ? g.coordinates
      : g.type === "LineString" ? [[g.coordinates]]
      : g.type === "MultiLineString" ? [g.coordinates] : [];
    for (const poly of polys) for (const ring of poly) out.push(ring);
  }
  return out;
}

type TitlePart = { text: string; italic?: boolean };

export default function RibbonPeelRevealWithGlobe({
  // ---- front-sheet ("old way") content ----
  current,
  // ---- label held in front of the revealed globe (the "new world" plate) ----
  title = "",
  titleColor = "#3a3d45",
  // ---- revealed globe look ----
  globePaper = "#ECEAE3",
  globeInk = "#0b1524",
  landUrl = "/ne_110m_land.json",
  coastUrl = "/ne_110m_coastline.json",
  // ---- ribbon knobs (forwarded) ----
  coils = 7,
  arc = 0.32,
  tilt = 3,
  tiltEnd = 0,
  backTilt = 0,
  backTiltEnd = -3,
  peelStart = 0.03,
  peelEnd = 0.68,
  travelVh = 820,
  // ---- globe reveal motion ----
  growFrom = 0.62,
  settleStart = 0.05,
  settleEnd = 1.0,
  className = "",
}: {
  current: React.ReactNode;
  /** label held static in front of the revealed globe (the "new world" plate) */
  title?: string;
  /** colour of that label — dark, reads on the porcelain globe (default #3a3d45) */
  titleColor?: string;
  /** globe fill — the porcelain disc, matches the ribbon front (default #ECEAE3) */
  globePaper?: string;
  /** globe engraving colour — the crosshatch + coastline, the backmost background navy (default #0b1524) */
  globeInk?: string;
  /** URL of a Natural Earth 110m land GeoJSON (default /ne_110m_land.json) */
  landUrl?: string;
  /** URL of a Natural Earth 110m coastline GeoJSON (default /ne_110m_coastline.json) */
  coastUrl?: string;
  coils?: number;
  arc?: number;
  tilt?: number;
  /** front tilt once fully thinned — animates tilt→tiltEnd over the peel (default 0, level) */
  tiltEnd?: number;
  backTilt?: number;
  /** back tilt once fully thinned — animates backTilt→backTiltEnd over the peel (default -3, 3° left) */
  backTiltEnd?: number;
  peelStart?: number;
  /** ribbon fully gone by this scroll fraction — keep it BEFORE settleEnd (default 0.68) */
  peelEnd?: number;
  travelVh?: number;
  /** globe scale at scroll 0 (default 0.62 = grows to full by settleEnd) */
  growFrom?: number;
  /** scroll fraction the globe begins growing (default 0.05) */
  settleStart?: number;
  /** scroll fraction the globe reaches full size — keep it AFTER peelEnd (default 1.0) */
  settleEnd?: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setTRef = useRef<(t: number) => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;
    let land: any = null, coast: any = null, ready = false;
    Promise.all([
      fetch(landUrl).then((r) => r.json()),
      fetch(coastUrl).then((r) => r.json()),
    ]).then(([l, c]) => { if (!disposed) { land = l; coast = c; ready = true; } }).catch(() => { ready = false; });

    let W = 0, H = 0, R = 0, cx = 0, cy = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const b = wrap.getBoundingClientRect();
      W = b.width; H = b.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      R = Math.min(W, H) * 0.5 * 0.94; cx = W / 2; cy = H / 2;
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(wrap);

    // rotation state (yaw λ, pitch φ) + eased cursor targets; grow target from the scroll playhead
    let yaw = -30, pitch = -12, tYaw = -30, tPitch = -12, lastMove = performance.now();
    let targetGrow = 0, curGrow = 0;
    setTRef.current = (t: number) => { targetGrow = Math.max(0, Math.min(1, t)); };
    // reduced motion: onProgress never fires → park the globe full-size
    if (!matchMedia("(prefers-reduced-motion: no-preference)").matches) { targetGrow = 1; curGrow = 1; }

    // project lon/lat(deg) → screen + rotated coords; v = visible (front hemisphere, x2>0)
    function project(lon: number, lat: number) {
      const cl = Math.cos(lat * DEG), sl = Math.sin(lat * DEG), lo = lon * DEG;
      const x = cl * Math.cos(lo), y = cl * Math.sin(lo), z = sl;
      const a = -yaw * DEG, ca = Math.cos(a), sa = Math.sin(a);       // yaw about z
      const x1 = x * ca - y * sa, y1 = x * sa + y * ca, z1 = z;
      const b = pitch * DEG, cb = Math.cos(b), sb = Math.sin(b);      // pitch about y
      const x2 = x1 * cb + z1 * sb, y2 = y1, z2 = -x1 * sb + z1 * cb; // camera looks +x
      return { x: cx + y2 * R, y: cy - z2 * R, v: x2 > 0, x2, y2, z2 };
    }
    type P = ReturnType<typeof project>;
    // limb crossing (x2=0) between a visible and a hidden point → rim screen point + rim angle
    function crossPoint(vis: P, hid: P) {
      const t = vis.x2 / (vis.x2 - hid.x2);
      let yy = vis.y2 + (hid.y2 - vis.y2) * t, zz = vis.z2 + (hid.z2 - vis.z2) * t;
      const m = Math.hypot(yy, zz) || 1; yy /= m; zz /= m;
      return { x: cx + yy * R, y: cy - zz * R, a: Math.atan2(-zz, yy) };
    }
    // walk the SHORT rim arc a1→a2 as lineTo's (direction-safe)
    function rimArc(a1: number, a2: number) {
      let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const steps = Math.max(1, Math.ceil(Math.abs(d) / 0.1));
      for (let s = 1; s <= steps; s++) { const a = a1 + (d * s) / steps; ctx!.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
    }
    // coastline stroke path: BROKEN at the limb (only the visible arc)
    function drawRings(rgs: number[][][]) {
      for (const ring of rgs) {
        let started = false;
        for (let i = 0; i < ring.length; i++) {
          const p = project(ring[i][0], ring[i][1]);
          if (!p.v) { started = false; continue; }
          if (!started) { ctx!.moveTo(p.x, p.y); started = true; } else ctx!.lineTo(p.x, p.y);
        }
      }
    }
    // land clip path: each ring clipped to the visible hemisphere, hugging the silhouette (rim arc)
    // where it crosses the limb — no chord glitch, correct even-odd parity for wrap-arounds.
    function pathLand(rgs: number[][][]) {
      for (const ring of rgs) {
        const p = ring.map((c) => project(c[0], c[1]));
        const n = p.length; if (n < 2) continue;
        let start = -1; for (let i = 0; i < n; i++) { if (p[i].v) { start = i; break; } }
        if (start < 0) continue;
        let pen = false, exitAngle = 0;
        for (let k = 0; k <= n; k++) {
          const i = (start + k) % n, cur = p[i], prev = p[(i - 1 + n) % n];
          if (cur.v) {
            if (!pen) {
              if (k === 0) { ctx!.moveTo(cur.x, cur.y); }
              else { const c = crossPoint(cur, prev); rimArc(exitAngle, c.a); ctx!.lineTo(c.x, c.y); ctx!.lineTo(cur.x, cur.y); }
              pen = true;
            } else ctx!.lineTo(cur.x, cur.y);
          } else if (pen) {
            const c = crossPoint(prev, cur); ctx!.lineTo(c.x, c.y); exitAngle = c.a; pen = false;
          }
        }
        ctx!.closePath();
      }
    }

    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      // ease rotation toward the cursor; gentle idle drift; smooth-follow the grow target
      if (now - lastMove > 2600) tYaw += 0.06;
      yaw += (tYaw - yaw) * 0.08;
      pitch += (tPitch - pitch) * 0.08;
      curGrow += (targetGrow - curGrow) * 0.18;
      wrap.style.setProperty("--globeScale", (growFrom + (1 - growFrom) * curGrow).toFixed(3));

      ctx.clearRect(0, 0, W, H);
      if (R <= 0) return;

      // porcelain disc + soft top-left light
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.closePath();
      const g = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.45, R * 0.1, cx, cy, R * 1.05);
      g.addColorStop(0, globePaper); g.addColorStop(1, shade(globePaper, -10));
      ctx.fillStyle = g; ctx.fill();
      ctx.clip();

      if (ready) {
        // continents: crosshatch engraving clipped to the land shapes + coastline outline
        ctx.save();
        ctx.beginPath(); pathLand(ringsOf(land));
        ctx.clip("evenodd");
        ctx.lineWidth = 0.7; ctx.strokeStyle = hexa(globeInk, 0.34);
        const hs = 5.5, S = 2 * R;
        ctx.beginPath(); // ╲ slope +1
        for (let c = -S; c <= S; c += hs) { ctx.moveTo(cx + c - S, cy - S); ctx.lineTo(cx + c + S, cy + S); }
        ctx.stroke();
        ctx.beginPath(); // ╱ slope −1 (the cross)
        for (let c = -S; c <= S; c += hs) { ctx.moveTo(cx + c + S, cy - S); ctx.lineTo(cx + c - S, cy + S); }
        ctx.stroke();
        ctx.restore();
        ctx.beginPath(); drawRings(ringsOf(coast));
        ctx.lineJoin = "round"; ctx.lineWidth = 1.1; ctx.strokeStyle = hexa(globeInk, 0.85); ctx.stroke();
      }

      // gentle single top-left light to round the sphere + soft rim
      const sg = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.45, R * 0.15, cx, cy, R * 1.02);
      sg.addColorStop(0, hexa(globeInk, 0)); sg.addColorStop(0.72, hexa(globeInk, 0)); sg.addColorStop(1, hexa(globeInk, 0.13));
      ctx.fillStyle = sg; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.lineWidth = 1.2; ctx.strokeStyle = hexa(globeInk, 0.6); ctx.stroke();
    };
    raf = requestAnimationFrame(frame);

    // cursor drives rotation — map pointer over the canvas wrap to yaw/pitch (follows the cursor)
    const onMove = (e: PointerEvent) => {
      const b = wrap.getBoundingClientRect();
      if (!b.width || !b.height) return;
      const nx = (e.clientX - b.left) / b.width - 0.5, ny = (e.clientY - b.top) / b.height - 0.5;
      tYaw = -30 - nx * 300;                              // move right → globe turns right
      tPitch = Math.max(-58, Math.min(58, ny * 120));     // move down → tilt down toward cursor
      lastMove = performance.now();
    };
    window.addEventListener("pointermove", onMove);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // dark ground the porcelain globe + depth ribbon read against (the revealed scene's floor)
  const abyss = (
    <div
      aria-hidden="true"
      style={{
        position: "absolute", inset: 0,
        background:
          "radial-gradient(120% 90% at 50% 42%, #1b2130 0%, #070810 72%)," +
          "linear-gradient(160deg, #0A0E1A 0%, #0d1024 68%, #05040f 100%)",
      }}
    />
  );

  const globeScene = (
    <div style={{ position: "relative", display: "grid", placeItems: "center", width: "100%", height: "100%" }}>
      <div
        ref={wrapRef}
        style={{
          position: "relative", zIndex: 1,
          width: "min(84vw,84vh)", aspectRatio: "1 / 1",
          transform: "scale(var(--globeScale,0.62))",
          filter: "drop-shadow(0 34px 90px rgba(0,0,0,.55))",
        }}
      >
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      </div>
      {/* the "new world" plate — held static in front of the globe (matches the rig bench) */}
      {title && (
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 3, display: "grid", placeItems: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              color: titleColor,
              font: '600 clamp(1.1rem,2.6vw,1.6rem)/1.4 ui-sans-serif, system-ui, "Segoe UI", sans-serif',
              letterSpacing: "0.14em", textAlign: "center",
            }}
          >
            {title}
          </div>
        </div>
      )}
      {/* edge vignette over the revealed scene (above the globe, below the peeling sheet) */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
          background: "radial-gradient(120% 100% at 50% 46%, transparent 52%, rgba(0,0,0,.55) 100%)",
        }}
      />
    </div>
  );

  return (
    <RibbonPeelReveal
      className={className}
      current={current}
      next={globeScene}
      backdrop={abyss}
      coils={coils}
      arc={arc}
      tilt={tilt}
      tiltEnd={tiltEnd}
      backTilt={backTilt}
      backTiltEnd={backTiltEnd}
      depthRibbon
      peelStart={peelStart}
      peelEnd={peelEnd}
      travelVh={travelVh}
      onProgress={(p) => {
        const t = Math.min(1, Math.max(0, (p - settleStart) / (settleEnd - settleStart)));
        setTRef.current(t);
      }}
    />
  );
}
