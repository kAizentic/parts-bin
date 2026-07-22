"use client";

/**
 * RippleTypeHero — a pointer-driven WebGL water-ripple hero whose large typography is
 * REFRACTED by the ripples. Clicking the surface seeds a randomized drop (a main impact,
 * a rebound, and a scatter of splash droplets); each ripple is rendered on a flat,
 * orthographic ISOMETRIC plane (no horizon) so every drop reads as the same dimensional
 * ellipse. The water is otherwise invisible against the ground — it is only revealed where
 * a ripple crest reflects the light or focuses a (chromatic) caustic. The headline is drawn
 * into the scene as a texture and displaced by the surface tilt, so it ripples with the
 * water; it fades in on mount. A "Rain" CTA toggles an ambient downpour.
 *
 * Ripples fire ONLY on click, at the cursor position — not on cursor movement.
 *
 * CROSS-TRACK NOTE: this bin is the GSAP section track; this component is a raw-WebGL2
 * hybrid (its own rAF loop + ping-pong height-field simulation), like RibbonPeelRevealWith*.
 * It needs no gsap/three — just WebGL2 (EXT_color_buffer_float).
 *
 * Theming (token seam): `--site-paper` = the dark ground the water sits on (this is a
 * DARK-ground component — the reflection-only water only reads on a dark paper, like
 * XrayBlendCopy's dark section); `--site-ink` = the typography; `--site-accent` = the ripple
 * light / highlight hue. Prop seam: `text`, `ctaLabel`, `relief` · `glow` · `caustics`.
 *
 * Reduced-motion: no simulation, no rAF — the headline renders as a static, legible DOM
 * <h1> on the ground and the CTA is hidden. (An <h1> is always present for a11y/SEO; it is
 * visually hidden in the motion path, where the canvas carries the visible type.)
 *
 * effect_type: canvas-webgl (pointer-ripple) + kinetic-type.
 */
import { useEffect, useRef, useState } from "react";

export default function RippleTypeHero({
  text = "RIPPLE",
  ctaLabel = "Rain",
  relief = 16,
  glow = 0.5,
  caustics = 0,
  minHeightVh = 100,
  fontFamily,
  className = "",
  onCta,
}: {
  /** the large headline; drawn into the scene and rippled by the water */
  text?: string;
  /** font-family for the headline canvas; omit to inherit the wrapper's computed
   *  font (so a host `font-display` class themes it) — falls back to a sans stack */
  fontFamily?: string;
  /** label for the CTA that toggles the rain downpour; empty string hides it */
  ctaLabel?: string;
  /** ripple relief — surface-normal exaggeration; also drives how hard the type warps (2–16) */
  relief?: number;
  /** reflection / highlight gain on the crests (0.5–5) */
  glow?: number;
  /** caustic focus gain under the crest (0–120) */
  caustics?: number;
  /** hero height in vh */
  minHeightVh?: number;
  className?: string;
  /** fired in addition to toggling rain when the CTA is pressed */
  onCta?: (rainOn: boolean) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const apiRef = useRef<{ toggleRain: () => void }>({ toggleRain: () => {} });
  const [rainOn, setRainOn] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const reduceMotion = !matchMedia("(prefers-reduced-motion: no-preference)").matches;
    setReduced(reduceMotion);

    // resolve a CSS color string (hex/rgb/token value) to linear-ish [r,g,b] 0..1
    const probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    const pctx = probe.getContext("2d")!;
    const resolveColor = (str: string, fb: [number, number, number]): [number, number, number] => {
      const s = (str || "").trim();
      if (!s) return fb;
      pctx.fillStyle = "#000";
      pctx.fillStyle = s;
      pctx.fillRect(0, 0, 1, 1);
      const d = pctx.getImageData(0, 0, 1, 1).data;
      return [d[0] / 255, d[1] / 255, d[2] / 255];
    };
    const readTokens = () => {
      const cs = getComputedStyle(wrap);
      return {
        paper: resolveColor(cs.getPropertyValue("--site-paper"), [0.016, 0.024, 0.039]),
        ink: resolveColor(cs.getPropertyValue("--site-ink"), [0.91, 0.95, 1.0]),
        accent: resolveColor(cs.getPropertyValue("--site-accent"), [0.62, 0.8, 1.0]),
      };
    };

    const glCtx = canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!glCtx) return;
    if (!glCtx.getExtension("EXT_color_buffer_float")) return;
    // non-null alias: the WebGL helper functions below are hoisted above the guard,
    // so a nullable `gl` wouldn't narrow inside them under strict null-checks.
    const gl: WebGL2RenderingContext = glCtx;

    // ---------- shader plumbing ----------
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "");
      return s;
    };
    const program = (vs: string, fs: string) => {
      const p = gl.createProgram()!;
      gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(p, 0, "a_pos");
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "");
      return p;
    };

    const VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main(){ v_uv = a_pos*0.5+0.5; gl_Position = vec4(a_pos,0.0,1.0); }`;

    const DROP_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_center;
uniform float u_radius;
uniform float u_strength;
uniform float u_aspect;
out vec4 o;
const float PI = 3.141592653589793;
void main(){
  vec4 info = texture(u_tex, v_uv);
  vec2 d = v_uv - u_center; d.x *= u_aspect;
  float drop = max(0.0, 1.0 - length(d)/u_radius);
  drop = 0.5 - cos(drop*PI)*0.5;
  info.r += drop * u_strength;
  o = info;
}`;

    const UPDATE_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texel;
out vec4 o;
void main(){
  vec4 info = texture(u_tex, v_uv);
  float l = texture(u_tex, v_uv - vec2(u_texel.x,0.0)).r;
  float r = texture(u_tex, v_uv + vec2(u_texel.x,0.0)).r;
  float u = texture(u_tex, v_uv + vec2(0.0,u_texel.y)).r;
  float dn= texture(u_tex, v_uv - vec2(0.0,u_texel.y)).r;
  float avg = (l+r+u+dn)*0.25;
  info.g += (avg - info.r) * 2.0;
  info.g *= 0.9925;
  info.r += info.g;
  info.r *= 0.9992;
  o = info;
}`;

    const RENDER_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texel;
uniform float u_slope;
uniform float u_spec;
uniform float u_caustic;
uniform vec2  u_scale;
uniform sampler2D u_text;
uniform float u_textAlpha;
uniform vec3 u_paper;
uniform vec3 u_ink;
uniform vec3 u_accent;
out vec4 o;

const float REFRACT = 0.03;
const float WARP    = 0.04;

const vec3 VIEWDIR = normalize(vec3(0.0, 0.95, 0.32));
const vec3 L1   = normalize(vec3(-0.42, 0.78, 0.46));
const vec3 L2   = normalize(vec3( 0.50, 0.72, 0.48));
const vec3 L3   = normalize(vec3( 0.04, 1.00, 0.10));

float causticAt(vec2 uv){
  float rc = texture(u_tex, uv).r;
  float rl = texture(u_tex, uv - vec2(u_texel.x,0.0)).r;
  float rr = texture(u_tex, uv + vec2(u_texel.x,0.0)).r;
  float ru = texture(u_tex, uv + vec2(0.0,u_texel.y)).r;
  float rd = texture(u_tex, uv - vec2(0.0,u_texel.y)).r;
  float lap = (rl + rr + ru + rd) - 4.0*rc;
  float c = max(0.0, -lap) * u_caustic;
  return c + c*c*0.7;
}

void main(){
  vec2 fuv = clamp(vec2(0.5) + (v_uv - vec2(0.5)) * u_scale, 0.0, 1.0);

  float hL = texture(u_tex, fuv - vec2(u_texel.x,0.0)).r;
  float hR = texture(u_tex, fuv + vec2(u_texel.x,0.0)).r;
  float hU = texture(u_tex, fuv + vec2(0.0,u_texel.y)).r;
  float hD = texture(u_tex, fuv - vec2(0.0,u_texel.y)).r;
  float gx = hR - hL;
  float gz = hU - hD;
  float grad = length(vec2(gx, gz));
  vec3  n = normalize(vec3(-gx*u_slope, 1.0, -gz*u_slope));
  vec3  refl = reflect(-VIEWDIR, n);
  float disturb = smoothstep(0.0005, 0.018, grad);

  // hero typography, displaced (rippled) by the surface tilt, faded in
  vec2 warp = clamp(vec2(gx, gz) * u_slope * WARP, -0.06, 0.06);
  vec4 tx = texture(u_text, vec2(v_uv.x, 1.0 - v_uv.y) + warp);

  vec3 col = u_paper;                                   // the site's dark ground
  col = mix(col, u_ink, tx.a * u_textAlpha);            // the type (tokenized ink)

  // chromatic caustics: R/G/B refract by slightly different amounts -> prismatic fringe
  vec2 disp = vec2(gx, gz) * u_slope;
  float cR = causticAt(clamp(fuv + disp * REFRACT * 0.86, 0.0, 1.0));
  float cG = causticAt(clamp(fuv + disp * REFRACT * 1.00, 0.0, 1.0));
  float cB = causticAt(clamp(fuv + disp * REFRACT * 1.18, 0.0, 1.0));
  vec3 caustic = vec3(cR, cG, cB);
  caustic = caustic / (1.0 + caustic);                 // soft rolloff, keeps the fringe
  vec3 causticTint = mix(u_accent, vec3(1.0), 0.35);

  // specular reflection of the light lobes (reveals the crest)
  float d1 = max(dot(refl, L1), 0.0);
  float d2 = max(dot(refl, L2), 0.0);
  float d3 = max(dot(refl, L3), 0.0);
  float core = pow(d1, 600.0) + 0.6*pow(d2, 600.0);
  float ring = pow(d1, 80.0)  + 0.6*pow(d2, 80.0) + 0.7*pow(d3, 120.0);
  float sky  = smoothstep(0.20, 0.90, refl.y);
  float fres = pow(1.0 - max(dot(VIEWDIR, n), 0.0), 4.0);

  col += u_accent * 0.09 * disturb;                    // refracted water body
  col += caustic * causticTint * 0.9 * disturb;        // chromatic caustics
  col += u_accent * core * u_spec * 3.2;
  col += u_accent * ring * u_spec * 1.00 * disturb;
  col += u_accent * sky  * u_spec * 0.60 * disturb;
  col += u_accent * fres * 0.50 * disturb;

  o = vec4(col, 1.0);
}`;

    let dropP: WebGLProgram, updateP: WebGLProgram, renderP: WebGLProgram;
    try {
      dropP = program(VS, DROP_FS);
      updateP = program(VS, UPDATE_FS);
      renderP = program(VS, RENDER_FS);
    } catch (e) {
      return; // shader failure — leave the a11y <h1> as the fallback
    }

    const U = (p: WebGLProgram, names: string[]) => {
      const o: Record<string, WebGLUniformLocation | null> = {};
      for (const n of names) o[n] = gl.getUniformLocation(p, n);
      return o;
    };
    const dU = U(dropP, ["u_tex", "u_center", "u_radius", "u_strength", "u_aspect"]);
    const uU = U(updateP, ["u_tex", "u_texel"]);
    const rU = U(renderP, ["u_tex", "u_texel", "u_slope", "u_spec", "u_caustic", "u_scale", "u_text", "u_textAlpha", "u_paper", "u_ink", "u_accent"]);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // ---------- ping-pong sim targets ----------
    let simW = 720, simH = 720, aspect = 1;
    const targets = [
      { tex: gl.createTexture()!, fbo: gl.createFramebuffer()! },
      { tex: gl.createTexture()!, fbo: gl.createFramebuffer()! },
    ];
    let srcI = 0;
    function sizeTargets() {
      for (const t of targets) {
        gl.bindTexture(gl.TEXTURE_2D, t.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, simW, simH, 0, gl.RGBA, gl.HALF_FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // ---------- isometric mapping ----------
    const SQUASH = 0.6, ZOOM = 0.9;
    let scaleU = ZOOM, scaleV = ZOOM;
    const computeScale = () => {
      scaleV = ZOOM;
      scaleU = Math.min(1.0, ZOOM * SQUASH * aspect);
    };

    // ---------- hero typography texture ----------
    let tokens = readTokens();
    const textTex = gl.createTexture()!;
    const textCanvas = document.createElement("canvas");
    const tctx = textCanvas.getContext("2d")!;
    const textStart = performance.now();
    function renderHeroText() {
      textCanvas.width = canvas!.width;
      textCanvas.height = canvas!.height;
      tctx.clearRect(0, 0, textCanvas.width, textCanvas.height);
      const cx = textCanvas.width / 2, cy = textCanvas.height * 0.46;
      const fs = Math.min(textCanvas.width * 0.135, textCanvas.height * 0.3);
      const inherited = (getComputedStyle(wrap!).fontFamily || "").trim();
      const family =
        fontFamily ||
        (inherited && !/^(serif|sans-serif|monospace)$/i.test(inherited)
          ? inherited
          : '"Helvetica Neue", "Segoe UI", Arial, sans-serif');
      tctx.font = `700 ${fs}px ${family}`;
      tctx.textAlign = "center";
      tctx.textBaseline = "middle";
      try { (tctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${fs * 0.05}px`; } catch (e) {}
      tctx.fillStyle = "rgba(255,255,255,1)"; // white mask; hue comes from u_ink
      tctx.fillText(text, cx, cy);
      gl.bindTexture(gl.TEXTURE_2D, textTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(wrap!.clientWidth * dpr));
      const h = Math.max(1, Math.floor(wrap!.clientHeight * dpr));
      canvas!.width = w;
      canvas!.height = h;
      aspect = wrap!.clientWidth / Math.max(1, wrap!.clientHeight);
      computeScale();
      sizeTargets();
      tokens = readTokens();
      renderHeroText();
    }

    // ---------- passes ----------
    const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3);
    const pending: { x: number; y: number; radius: number; strength: number }[] = [];
    const RADIUS_SCALE = 1.0;
    const dropAt = (u: number, v: number, radius: number, strength: number) =>
      pending.push({ x: u, y: v, radius: radius * RADIUS_SCALE, strength });

    function applyDrop(d: { x: number; y: number; radius: number; strength: number }) {
      const dst = 1 - srcI;
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets[dst].fbo);
      gl.viewport(0, 0, simW, simH);
      gl.useProgram(dropP);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets[srcI].tex);
      gl.uniform1i(dU.u_tex, 0);
      gl.uniform2f(dU.u_center, d.x, d.y);
      gl.uniform1f(dU.u_radius, d.radius);
      gl.uniform1f(dU.u_strength, d.strength);
      gl.uniform1f(dU.u_aspect, 1.0);
      draw();
      srcI = dst;
    }
    function update() {
      const dst = 1 - srcI;
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets[dst].fbo);
      gl.viewport(0, 0, simW, simH);
      gl.useProgram(updateP);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets[srcI].tex);
      gl.uniform1i(uU.u_tex, 0);
      gl.uniform2f(uU.u_texel, 1 / simW, 1 / simH);
      draw();
      srcI = dst;
    }
    function renderFrame() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas!.width, canvas!.height);
      gl.useProgram(renderP);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets[srcI].tex);
      gl.uniform1i(rU.u_tex, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, textTex);
      gl.uniform1i(rU.u_text, 1);
      gl.uniform2f(rU.u_texel, 1 / simW, 1 / simH);
      gl.uniform1f(rU.u_slope, relief);
      gl.uniform1f(rU.u_spec, glow);
      gl.uniform1f(rU.u_caustic, caustics);
      gl.uniform2f(rU.u_scale, scaleU, scaleV);
      gl.uniform3f(rU.u_paper, tokens.paper[0], tokens.paper[1], tokens.paper[2]);
      gl.uniform3f(rU.u_ink, tokens.ink[0], tokens.ink[1], tokens.ink[2]);
      gl.uniform3f(rU.u_accent, tokens.accent[0], tokens.accent[1], tokens.accent[2]);
      let ta = reduceMotion ? 0 : Math.min(1, Math.max(0, (performance.now() - textStart - 300) / 1500));
      ta = ta * ta * (3 - 2 * ta);
      gl.uniform1f(rU.u_textAlpha, ta);
      draw();
    }

    // ---------- seeding ----------
    const seedSplash = (u: number, v: number) => {
      dropAt(u, v, 0.032 + Math.random() * 0.01, -(0.42 + Math.random() * 0.22));
      const n = 3 + ((Math.random() * 4) | 0);
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const r = 0.02 + Math.random() * 0.06;
        const su = u + Math.cos(ang) * r;
        const sv = v + Math.sin(ang) * r;
        setTimeout(() => dropAt(su, sv, 0.011 + Math.random() * 0.012, -(0.1 + Math.random() * 0.16)), 50 + Math.random() * 200);
      }
      setTimeout(() => dropAt(u, v, 0.017, -(0.18 + Math.random() * 0.12)), 200 + Math.random() * 120);
    };
    const screenToField = (px: number, py: number) => ({
      u: 0.5 + (px - 0.5) * scaleU,
      v: 0.5 + ((1 - py) - 0.5) * scaleV,
    });
    const onPointerDown = (e: PointerEvent) => {
      const rect = canvas!.getBoundingClientRect();
      const f = screenToField((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
      seedSplash(f.u, f.v);
    };

    // rain toggle exposed to the CTA
    let rain = false;
    let rainAccum = 0;
    apiRef.current.toggleRain = () => { rain = !rain; };

    resize();
    // re-draw the headline once webfonts load (e.g. Oswald via next/font)
    let aliveFonts = true;
    const df = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    if (df?.ready) df.ready.then(() => { if (aliveFonts) renderHeroText(); });
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(resize); ro.observe(wrap); }
    window.addEventListener("resize", resize);

    let raf = 0;
    if (reduceMotion) {
      // static, legible: no simulation, no listeners; the DOM <h1> carries the type
      renderFrame();
    } else {
      canvas.addEventListener("pointerdown", onPointerDown);
      const frame = () => {
        if (rain) {
          rainAccum += 1;
          if (rainAccum > 8) {
            rainAccum = 0;
            if (Math.random() < 0.9)
              dropAt(0.5 + (Math.random() - 0.5) * scaleU, 0.5 + (Math.random() - 0.5) * scaleV, 0.012 + Math.random() * 0.014, -(0.14 + Math.random() * 0.18));
          }
        }
        while (pending.length) applyDrop(pending.shift()!);
        update();
        renderFrame();
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      // opening ripples so the type ripples as it fades in
      setTimeout(() => dropAt(0.5, 0.5, 0.05, -0.42), 650);
      setTimeout(() => dropAt(0.42, 0.52, 0.035, -0.3), 1100);
      setTimeout(() => dropAt(0.6, 0.47, 0.035, -0.3), 1500);
    }

    return () => {
      aliveFonts = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      if (ro) ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      const lose = gl.getExtension("WEBGL_lose_context");
      if (lose) lose.loseContext();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, relief, glow, caustics, fontFamily]);

  const toggleRain = () => {
    apiRef.current.toggleRain();
    const next = !rainOn;
    setRainOn(next);
    onCta?.(next);
  };

  return (
    <section
      ref={wrapRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        minHeight: `${minHeightVh}vh`,
        overflow: "hidden",
        background: "var(--site-paper, #04060a)",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: reduced ? "none" : "block", width: "100%", height: "100%", position: "absolute", inset: 0, cursor: "crosshair", touchAction: "none" }}
      />
      {/* a11y/SEO heading — visually hidden while the canvas carries the visible type;
          made visible & styled under reduced-motion (the static fallback) */}
      <h1
        ref={h1Ref}
        style={
          reduced
            ? {
                position: "absolute", inset: 0, margin: 0, display: "grid", placeItems: "center",
                textAlign: "center", padding: "0 6vw",
                font: `700 clamp(2.5rem, 13vw, 12rem)/1 "Helvetica Neue", "Segoe UI", Arial, sans-serif`,
                letterSpacing: "0.04em", color: "var(--site-ink, #e8f2ff)",
              }
            : { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", clipPath: "inset(50%)", whiteSpace: "nowrap", border: 0, padding: 0, margin: "-1px" }
        }
      >
        {text}
      </h1>
      {ctaLabel && !reduced && (
        <button
          type="button"
          onClick={toggleRain}
          aria-pressed={rainOn}
          style={{
            position: "absolute", left: "50%", top: "60%", transform: "translate(-50%,0)", zIndex: 2,
            cursor: "pointer",
            font: `500 0.875rem/1 ui-sans-serif, system-ui, sans-serif`,
            letterSpacing: "0.32em", textTransform: "uppercase",
            color: "var(--site-ink, #d2e4fa)",
            padding: "14px 40px", borderRadius: 999,
            background: rainOn ? "color-mix(in srgb, var(--site-accent, #6f9fe0) 42%, transparent)" : "color-mix(in srgb, var(--site-accent, #6f9fe0) 16%, transparent)",
            border: `1px solid color-mix(in srgb, var(--site-accent, #6f9fe0) ${rainOn ? 70 : 34}%, transparent)`,
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            boxShadow: "0 6px 26px rgba(0,0,0,0.45)",
            transition: "background .25s, border-color .25s",
          }}
        >
          {ctaLabel}
        </button>
      )}
    </section>
  );
}
