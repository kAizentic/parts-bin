"use client";

/**
 * RibbonPeelRevealWithSphere — RibbonPeelReveal with a WebGL sphere as the revealed object.
 * As the front ribbon peels away, a lit sphere (fresnel cyan/magenta rim + studio key light)
 * GROWS from half size to full, SPINS exactly `spinDeg` (default 180°) and settles to face
 * front, carrying a FLAT billboard type plate (eyebrow + wordmark + tagline) that swings
 * around WITH it — the type is a child of the sphere so it inherits the grow/spin but is
 * never baked/wrapped onto the surface. A soft multiply shadow falls from the sphere onto the
 * back depth ribbon and grows with it.
 *
 * The whole thing runs off ONE scroll playhead: RibbonPeelReveal's `onProgress` drives the
 * sphere's target. The load-bearing timing rule — the ribbon must be fully gone (`peelEnd`,
 * default 0.68) BEFORE the sphere finishes rotating (`settleEnd`, default 1.0) — is what sells
 * the sphere as *contained within* the coil structure rather than pasted over a cleared stage.
 *
 * CROSS-TRACK NOTE: this bin is the GSAP section track; this one component additionally needs
 * `three` (dynamically imported, so callers who only use RibbonPeelReveal pay nothing). It is
 * the deliberate hybrid — the ribbon wipe is DOM/CSS, the revealed payload is WebGL.
 *
 * Theming: inherits `--site-paper` / `--site-ink` (the ribbon). Sphere + type colours are
 * explicit props (they're the focal object, not chrome). Reduced-motion: stacked static
 * sections; the sphere is parked full-size and faced.
 *
 * Deps: gsap, @gsap/react, gsap/ScrollTrigger, three.  effect_type: pin/scrub full-bleed reveal + spatial-object.
 */
import { useEffect, useRef } from "react";
import RibbonPeelReveal from "./RibbonPeelReveal";

type TitlePart = { text: string; italic?: boolean };

export default function RibbonPeelRevealWithSphere({
  // ---- front-sheet ("old way") content ----
  current,
  // ---- revealed sphere type plate ----
  eyebrow = "",
  title = "",
  titleParts,
  titleColor = "#E9D8A6",
  tagline = [],
  taglineColor = "rgba(233,216,166,0.92)",
  // ---- sphere look ----
  sphereColors = {},
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
  // ---- sphere motion ----
  spinDeg = 180,
  growFrom = 0.5,
  settleStart = 0.05,
  settleEnd = 1.0,
  shadow = true,
  className = "",
}: {
  current: React.ReactNode;
  eyebrow?: string;
  /** big wordmark; use `titleParts` instead to italicise a substring of it */
  title?: string;
  titleParts?: TitlePart[];
  titleColor?: string;
  tagline?: string[];
  taglineColor?: string;
  sphereColors?: { deep?: number; mid?: number; hi?: number; cyan?: number; mag?: number };
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
  /** total spin in degrees; type starts hidden on the back and swings to face (default 180) */
  spinDeg?: number;
  /** sphere scale at scroll 0 (default 0.5 = half size) */
  growFrom?: number;
  /** scroll fraction the sphere begins growing/spinning (default 0.05) */
  settleStart?: number;
  /** scroll fraction the sphere finishes facing front (default 1.0 — AFTER peelEnd) */
  settleEnd?: number;
  shadow?: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const setTRef = useRef<(t: number) => void>(() => {});

  const parts: TitlePart[] = titleParts ?? (title ? [{ text: title }] : []);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      if (disposed || !canvasRef.current || !wrapRef.current) return;
      THREE.ColorManagement.enabled = false; // hand-tuned colours render as picked

      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0, 0, 3.2);

      const c = sphereColors;
      const uniforms = {
        uDeep: { value: new THREE.Color(c.deep ?? 0x07061a) },
        uMid: { value: new THREE.Color(c.mid ?? 0x66677f) },
        uHi: { value: new THREE.Color(c.hi ?? 0xd2d9ff) },
        uCyan: { value: new THREE.Color(c.cyan ?? 0x150b47) },
        uMag: { value: new THREE.Color(c.mag ?? 0xc3bbbe) },
      };
      const mat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: `
          varying vec3 vN; varying vec3 vView;
          void main(){
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 uDeep, uMid, uHi, uCyan, uMag;
          varying vec3 vN; varying vec3 vView;
          void main(){
            vec3 key = normalize(vec3(-0.45, 0.55, 0.85));
            float L  = clamp(dot(vN, key), 0.0, 1.0);
            float La = pow(L, 0.85);
            vec3 col = mix(uDeep, uMid, smoothstep(0.0, 0.5, La));
            col = mix(col, uHi, smoothstep(0.5, 1.0, La));
            col += uMid * 0.05;
            float fres = pow(1.0 - clamp(dot(vN, vView), 0.0, 1.0), 3.0);
            vec3 rim = mix(uMag, uCyan, smoothstep(-0.6, 0.6, vN.x));
            col += fres * rim * 0.85;
            gl_FragColor = vec4(col, 1.0);
          }`,
      });
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), mat);
      scene.add(sphere);

      // ---- flat billboard type plate: a CHILD of the sphere (rotates & grows with it, stays flat) ----
      const buildTextTexture = () => {
        const cv = document.createElement("canvas");
        cv.width = 1200; cv.height = 1200;
        const g = cv.getContext("2d")!;
        const cx = 600;
        g.textBaseline = "middle";
        if (eyebrow) {
          g.textAlign = "center";
          try { g.letterSpacing = "12px"; } catch (e) {}
          g.fillStyle = "rgba(210,224,220,0.9)";
          g.font = '500 34px "JetBrains Mono", monospace';
          g.fillText(eyebrow, cx, 402);
        }
        // wordmark (optional italic parts) centred as one run
        try { g.letterSpacing = "0px"; } catch (e) {}
        g.textAlign = "left";
        g.fillStyle = titleColor;
        const upr = '700 232px "Space Grotesk", sans-serif';
        const ita = 'italic 500 232px "Space Grotesk", sans-serif';
        const widths = parts.map((p) => { g.font = p.italic ? ita : upr; return g.measureText(p.text).width; });
        const total = widths.reduce((a, b) => a + b, 0);
        let x = cx - total / 2;
        parts.forEach((p, i) => { g.font = p.italic ? ita : upr; g.fillText(p.text, x, 600); x += widths[i]; });
        // tagline
        g.textAlign = "center";
        try { g.letterSpacing = "3px"; } catch (e) {}
        g.fillStyle = taglineColor;
        g.font = '400 44px "JetBrains Mono", monospace';
        tagline.forEach((line, i) => g.fillText(line, cx, 772 + i * 60));
        const tex = new THREE.CanvasTexture(cv);
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        return tex;
      };

      let plane: import("three").Mesh | null = null;
      (async () => {
        try { await (document as any).fonts?.ready; } catch (e) {}
        if (disposed) return;
        plane = new THREE.Mesh(
          new THREE.PlaneGeometry(1.9, 1.9),
          new THREE.MeshBasicMaterial({ map: buildTextTexture(), transparent: true, depthWrite: false }),
        );
        plane.position.set(0, 0, 1.02);
        sphere.add(plane);
      })();

      const SPIN = (spinDeg * Math.PI) / 180;
      let targetT = 0, curT = 0;
      setTRef.current = (t: number) => { targetT = Math.max(0, Math.min(1, t)); };

      const resize = () => {
        const w = wrap.clientWidth || 1, h = wrap.clientHeight || 1;
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.setSize(w, h, false);
        camera.aspect = w / h; camera.updateProjectionMatrix();
      };
      window.addEventListener("resize", resize); resize();

      renderer.setAnimationLoop(() => {
        curT += (targetT - curT) * 0.18;
        sphere.scale.setScalar(growFrom + (1 - growFrom) * curT);
        sphere.rotation.y = SPIN * (1 - curT); // linear: still rotating after the ribbon clears
        sphere.rotation.x = 0.05 * (1 - curT);
        if (shadowRef.current) shadowRef.current.style.setProperty("--shadowScale", (0.5 + 0.5 * curT).toFixed(3));
        renderer.render(scene, camera);
      });

      // reduced-motion: RibbonPeelReveal never fires onProgress → park the sphere faced & full
      if (!matchMedia("(prefers-reduced-motion: no-preference)").matches) setTRef.current(1);

      cleanup = () => {
        renderer.setAnimationLoop(null);
        window.removeEventListener("resize", resize);
        renderer.dispose();
        mat.dispose();
        sphere.geometry.dispose();
        if (plane) {
          plane.geometry.dispose();
          (plane.material as import("three").Material).dispose();
        }
      };
    })();

    return () => { disposed = true; cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // dark "abyss" the porcelain depth ribbon reads against — the revealed scene's ground
  const abyss = (
    <div
      aria-hidden="true"
      style={{
        position: "absolute", inset: 0,
        background:
          "radial-gradient(120% 90% at 50% 42%, rgba(21,11,71,.06), transparent 55%)," +
          "radial-gradient(140% 120% at 78% 88%, rgba(195,187,190,.07), transparent 60%)," +
          "linear-gradient(160deg, #0A0E1A 0%, #120A28 68%, #05040f 100%)",
      }}
    />
  );

  const sphereScene = (
    <div style={{ position: "relative", display: "grid", placeItems: "center", width: "100%", height: "100%" }}>
      {shadow && (
        <div
          ref={shadowRef}
          aria-hidden="true"
          style={{
            position: "absolute", zIndex: 0, pointerEvents: "none",
            top: "50%", left: "50%",
            width: "min(84vw,84vh)", aspectRatio: "1 / 1", borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(0,0,0,.55) 0%, rgba(0,0,0,.34) 40%, rgba(0,0,0,.13) 56%, transparent 70%)",
            filter: "blur(14px)",
            transform: "translate(-47%,-42%) scale(var(--shadowScale,.5))",
            mixBlendMode: "multiply", opacity: 0.7,
          }}
        />
      )}
      <div ref={wrapRef} style={{ position: "relative", zIndex: 1, width: "min(84vw,84vh)", aspectRatio: "1 / 1" }}>
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      </div>
      {/* edge vignette over the revealed scene (sits above the sphere, below the peeling sheet) */}
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
      next={sphereScene}
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
        // sphere grows/spins over [settleStart, settleEnd]; ribbon (peelEnd) finishes first
        const t = Math.min(1, Math.max(0, (p - settleStart) / (settleEnd - settleStart)));
        setTRef.current(t);
      }}
    />
  );
}
