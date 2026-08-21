/**
 * RippleTypeHero — Framer code component port.
 *
 * Source of truth: parts-bin `src/components/RippleTypeHero.tsx`. The simulation,
 * shaders and isometric mapping are UNCHANGED from that file; this port only adapts
 * the seams that differ between a Next.js site and the Framer canvas. Diff summary:
 *
 *   1. Theme tokens -> explicit props. The site version reads `--site-paper`/`--site-ink`/
 *      `--site-accent` off the wrapper via getComputedStyle. Framer has no token layer,
 *      so those become three ControlType.Color props (the CSS-var read is kept as the
 *      fallback, so the component still themes correctly if dropped into a tokenized page).
 *   2. Live tunables. The site version lists relief/glow/caustics/text/fontFamily in the
 *      effect deps, which tears down and rebuilds the WebGL context on every change. On the
 *      Framer canvas a designer DRAGS those sliders, so a teardown per frame is a real
 *      defect here. All tunables now flow through a ref read inside the render loop; the
 *      GL context initialises exactly once. Text/font changes redraw only the type texture.
 *   3. Sizing. `minHeightVh` is gone — Framer sizes the frame. Layout annotations below
 *      declare the intrinsic canvas size and that the component accepts any width/height,
 *      and `props.style` is spread onto the root so Framer's sizing actually applies.
 *   4. `className` dropped (no meaning in Framer); `onCta` is a ControlType.EventHandler.
 *
 * Requires WebGL2 + EXT_color_buffer_float. On failure, or under reduced motion, it
 * degrades to a static legible <h1> — never a blank frame.
 */

import { addPropertyControls, ControlType } from "framer"
import { useEffect, useRef, useState } from "react"

type RGB = [number, number, number]

interface Props {
    text: string
    fontFamily: string
    ctaLabel: string
    relief: number
    glow: number
    caustics: number
    paperColor: string
    inkColor: string
    accentColor: string
    onCta?: (rainOn: boolean) => void
    style?: React.CSSProperties
}

/**
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
export function RippleTypeHero(props: Props) {
    const {
        text,
        fontFamily,
        ctaLabel,
        relief,
        glow,
        caustics,
        paperColor,
        inkColor,
        accentColor,
        onCta,
        style,
    } = props

    const wrapRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const apiRef = useRef<{ toggleRain: () => void }>({ toggleRain: () => {} })
    const redrawTextRef = useRef<(() => void) | null>(null)

    const [rainOn, setRainOn] = useState(false)
    const [reduced, setReduced] = useState(false)

    // Every tunable the render loop reads, updated in place so prop changes never
    // re-run the GL init effect. (Framer canvas: sliders are dragged, not set once.)
    const live = useRef({
        relief,
        glow,
        caustics,
        paper: [0.016, 0.024, 0.039] as RGB,
        ink: [0.91, 0.95, 1.0] as RGB,
        accent: [0.62, 0.8, 1.0] as RGB,
        text,
        fontFamily,
    })
    live.current.relief = relief
    live.current.glow = glow
    live.current.caustics = caustics
    live.current.text = text
    live.current.fontFamily = fontFamily

    // ---- colour resolution: prop wins, CSS token is the fallback ----
    useEffect(() => {
        const probe = document.createElement("canvas")
        probe.width = probe.height = 1
        const pctx = probe.getContext("2d")
        if (!pctx) return

        const resolve = (str: string, fb: RGB): RGB => {
            const s = (str || "").trim()
            if (!s) return fb
            pctx.fillStyle = "#000"
            pctx.fillStyle = s
            pctx.fillRect(0, 0, 1, 1)
            const d = pctx.getImageData(0, 0, 1, 1).data
            return [d[0] / 255, d[1] / 255, d[2] / 255]
        }

        const cs = wrapRef.current ? getComputedStyle(wrapRef.current) : null
        const token = (name: string) =>
            cs ? cs.getPropertyValue(name).trim() : ""

        live.current.paper = resolve(
            paperColor || token("--site-paper"),
            [0.016, 0.024, 0.039]
        )
        live.current.ink = resolve(
            inkColor || token("--site-ink"),
            [0.91, 0.95, 1.0]
        )
        live.current.accent = resolve(
            accentColor || token("--site-accent"),
            [0.62, 0.8, 1.0]
        )
    }, [paperColor, inkColor, accentColor])

    // Text / font changes redraw only the type texture — no GL teardown.
    useEffect(() => {
        redrawTextRef.current?.()
    }, [text, fontFamily])

    // ---- one-time WebGL init ----
    useEffect(() => {
        const wrap = wrapRef.current
        const canvas = canvasRef.current
        if (!wrap || !canvas) return

        const reduceMotion = !matchMedia("(prefers-reduced-motion: no-preference)")
            .matches
        setReduced(reduceMotion)

        const glCtx = canvas.getContext("webgl2", {
            antialias: false,
            alpha: false,
            premultipliedAlpha: false,
        })
        if (!glCtx) return
        if (!glCtx.getExtension("EXT_color_buffer_float")) return
        const gl: WebGL2RenderingContext = glCtx

        // ---------- shader plumbing ----------
        const compile = (type: number, src: string) => {
            const s = gl.createShader(type)!
            gl.shaderSource(s, src)
            gl.compileShader(s)
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
                throw new Error(gl.getShaderInfoLog(s) || "")
            return s
        }
        const program = (vs: string, fs: string) => {
            const p = gl.createProgram()!
            gl.attachShader(p, compile(gl.VERTEX_SHADER, vs))
            gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs))
            gl.bindAttribLocation(p, 0, "a_pos")
            gl.linkProgram(p)
            if (!gl.getProgramParameter(p, gl.LINK_STATUS))
                throw new Error(gl.getProgramInfoLog(p) || "")
            return p
        }

        const VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main(){ v_uv = a_pos*0.5+0.5; gl_Position = vec4(a_pos,0.0,1.0); }`

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
}`

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
}`

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

  vec3 col = u_paper;                                   // the ground
  col = mix(col, u_ink, tx.a * u_textAlpha);            // the type

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
}`

        let dropP: WebGLProgram, updateP: WebGLProgram, renderP: WebGLProgram
        try {
            dropP = program(VS, DROP_FS)
            updateP = program(VS, UPDATE_FS)
            renderP = program(VS, RENDER_FS)
        } catch (e) {
            return // shader failure — the a11y <h1> is the fallback
        }

        const U = (p: WebGLProgram, names: string[]) => {
            const o: Record<string, WebGLUniformLocation | null> = {}
            for (const n of names) o[n] = gl.getUniformLocation(p, n)
            return o
        }
        const dU = U(dropP, [
            "u_tex",
            "u_center",
            "u_radius",
            "u_strength",
            "u_aspect",
        ])
        const uU = U(updateP, ["u_tex", "u_texel"])
        const rU = U(renderP, [
            "u_tex",
            "u_texel",
            "u_slope",
            "u_spec",
            "u_caustic",
            "u_scale",
            "u_text",
            "u_textAlpha",
            "u_paper",
            "u_ink",
            "u_accent",
        ])

        const vao = gl.createVertexArray()
        gl.bindVertexArray(vao)
        const buf = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buf)
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 3, -1, -1, 3]),
            gl.STATIC_DRAW
        )
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

        // ---------- ping-pong sim targets ----------
        let simW = 720,
            simH = 720,
            aspect = 1
        const targets = [
            { tex: gl.createTexture()!, fbo: gl.createFramebuffer()! },
            { tex: gl.createTexture()!, fbo: gl.createFramebuffer()! },
        ]
        let srcI = 0
        function sizeTargets() {
            for (const t of targets) {
                gl.bindTexture(gl.TEXTURE_2D, t.tex)
                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    gl.RGBA16F,
                    simW,
                    simH,
                    0,
                    gl.RGBA,
                    gl.HALF_FLOAT,
                    null
                )
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
                gl.texParameteri(
                    gl.TEXTURE_2D,
                    gl.TEXTURE_WRAP_S,
                    gl.CLAMP_TO_EDGE
                )
                gl.texParameteri(
                    gl.TEXTURE_2D,
                    gl.TEXTURE_WRAP_T,
                    gl.CLAMP_TO_EDGE
                )
                gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo)
                gl.framebufferTexture2D(
                    gl.FRAMEBUFFER,
                    gl.COLOR_ATTACHMENT0,
                    gl.TEXTURE_2D,
                    t.tex,
                    0
                )
                gl.clearColor(0, 0, 0, 1)
                gl.clear(gl.COLOR_BUFFER_BIT)
            }
            gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        }

        // ---------- isometric mapping ----------
        const SQUASH = 0.6,
            ZOOM = 0.9
        let scaleU = ZOOM,
            scaleV = ZOOM
        const computeScale = () => {
            scaleV = ZOOM
            scaleU = Math.min(1.0, ZOOM * SQUASH * aspect)
        }

        // ---------- hero typography texture ----------
        const textTex = gl.createTexture()!
        const textCanvas = document.createElement("canvas")
        const tctx = textCanvas.getContext("2d")!
        const textStart = performance.now()
        function renderHeroText() {
            if (!canvas!.width || !canvas!.height) return
            textCanvas.width = canvas!.width
            textCanvas.height = canvas!.height
            tctx.clearRect(0, 0, textCanvas.width, textCanvas.height)
            const cx = textCanvas.width / 2,
                cy = textCanvas.height * 0.46
            const fs = Math.min(
                textCanvas.width * 0.135,
                textCanvas.height * 0.3
            )
            const inherited = (
                getComputedStyle(wrap!).fontFamily || ""
            ).trim()
            const family =
                live.current.fontFamily ||
                (inherited &&
                !/^(serif|sans-serif|monospace)$/i.test(inherited)
                    ? inherited
                    : '"Helvetica Neue", "Segoe UI", Arial, sans-serif')
            tctx.font = `700 ${fs}px ${family}`
            tctx.textAlign = "center"
            tctx.textBaseline = "middle"
            try {
                ;(
                    tctx as CanvasRenderingContext2D & { letterSpacing: string }
                ).letterSpacing = `${fs * 0.05}px`
            } catch (e) {}
            tctx.fillStyle = "rgba(255,255,255,1)" // white mask; hue comes from u_ink
            tctx.fillText(live.current.text, cx, cy)
            gl.bindTexture(gl.TEXTURE_2D, textTex)
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                textCanvas
            )
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        }
        // let the text/font effect redraw the texture without touching the GL context
        redrawTextRef.current = renderHeroText

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            const w = Math.max(1, Math.floor(wrap!.clientWidth * dpr))
            const h = Math.max(1, Math.floor(wrap!.clientHeight * dpr))
            canvas!.width = w
            canvas!.height = h
            aspect = wrap!.clientWidth / Math.max(1, wrap!.clientHeight)
            computeScale()
            sizeTargets()
            renderHeroText()
        }

        // ---------- passes ----------
        const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3)
        const pending: {
            x: number
            y: number
            radius: number
            strength: number
        }[] = []
        const RADIUS_SCALE = 1.0
        const dropAt = (
            u: number,
            v: number,
            radius: number,
            strength: number
        ) => pending.push({ x: u, y: v, radius: radius * RADIUS_SCALE, strength })

        function applyDrop(d: {
            x: number
            y: number
            radius: number
            strength: number
        }) {
            const dst = 1 - srcI
            gl.bindFramebuffer(gl.FRAMEBUFFER, targets[dst].fbo)
            gl.viewport(0, 0, simW, simH)
            gl.useProgram(dropP)
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, targets[srcI].tex)
            gl.uniform1i(dU.u_tex, 0)
            gl.uniform2f(dU.u_center, d.x, d.y)
            gl.uniform1f(dU.u_radius, d.radius)
            gl.uniform1f(dU.u_strength, d.strength)
            gl.uniform1f(dU.u_aspect, 1.0)
            draw()
            srcI = dst
        }
        function update() {
            const dst = 1 - srcI
            gl.bindFramebuffer(gl.FRAMEBUFFER, targets[dst].fbo)
            gl.viewport(0, 0, simW, simH)
            gl.useProgram(updateP)
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, targets[srcI].tex)
            gl.uniform1i(uU.u_tex, 0)
            gl.uniform2f(uU.u_texel, 1 / simW, 1 / simH)
            draw()
            srcI = dst
        }
        function renderFrame() {
            const L = live.current
            gl.bindFramebuffer(gl.FRAMEBUFFER, null)
            gl.viewport(0, 0, canvas!.width, canvas!.height)
            gl.useProgram(renderP)
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, targets[srcI].tex)
            gl.uniform1i(rU.u_tex, 0)
            gl.activeTexture(gl.TEXTURE1)
            gl.bindTexture(gl.TEXTURE_2D, textTex)
            gl.uniform1i(rU.u_text, 1)
            gl.uniform2f(rU.u_texel, 1 / simW, 1 / simH)
            gl.uniform1f(rU.u_slope, L.relief)
            gl.uniform1f(rU.u_spec, L.glow)
            gl.uniform1f(rU.u_caustic, L.caustics)
            gl.uniform2f(rU.u_scale, scaleU, scaleV)
            gl.uniform3f(rU.u_paper, L.paper[0], L.paper[1], L.paper[2])
            gl.uniform3f(rU.u_ink, L.ink[0], L.ink[1], L.ink[2])
            gl.uniform3f(rU.u_accent, L.accent[0], L.accent[1], L.accent[2])
            let ta = reduceMotion
                ? 0
                : Math.min(
                      1,
                      Math.max(0, (performance.now() - textStart - 300) / 1500)
                  )
            ta = ta * ta * (3 - 2 * ta)
            gl.uniform1f(rU.u_textAlpha, ta)
            draw()
        }

        // ---------- seeding ----------
        const seedSplash = (u: number, v: number) => {
            dropAt(
                u,
                v,
                0.032 + Math.random() * 0.01,
                -(0.42 + Math.random() * 0.22)
            )
            const n = 3 + ((Math.random() * 4) | 0)
            for (let i = 0; i < n; i++) {
                const ang = Math.random() * Math.PI * 2
                const r = 0.02 + Math.random() * 0.06
                const su = u + Math.cos(ang) * r
                const sv = v + Math.sin(ang) * r
                setTimeout(
                    () =>
                        dropAt(
                            su,
                            sv,
                            0.011 + Math.random() * 0.012,
                            -(0.1 + Math.random() * 0.16)
                        ),
                    50 + Math.random() * 200
                )
            }
            setTimeout(
                () => dropAt(u, v, 0.017, -(0.18 + Math.random() * 0.12)),
                200 + Math.random() * 120
            )
        }
        const screenToField = (px: number, py: number) => ({
            u: 0.5 + (px - 0.5) * scaleU,
            v: 0.5 + (1 - py - 0.5) * scaleV,
        })
        const onPointerDown = (e: PointerEvent) => {
            const rect = canvas!.getBoundingClientRect()
            const f = screenToField(
                (e.clientX - rect.left) / rect.width,
                (e.clientY - rect.top) / rect.height
            )
            seedSplash(f.u, f.v)
        }

        // rain toggle exposed to the CTA
        let rain = false
        let rainAccum = 0
        apiRef.current.toggleRain = () => {
            rain = !rain
        }

        resize()
        let aliveFonts = true
        const df = (
            document as Document & { fonts?: { ready?: Promise<unknown> } }
        ).fonts
        if (df?.ready)
            df.ready.then(() => {
                if (aliveFonts) renderHeroText()
            })
        let ro: ResizeObserver | null = null
        if (typeof ResizeObserver !== "undefined") {
            ro = new ResizeObserver(resize)
            ro.observe(wrap)
        }
        window.addEventListener("resize", resize)

        let raf = 0
        if (reduceMotion) {
            // static, legible: no simulation, no listeners; the DOM <h1> carries the type
            renderFrame()
        } else {
            canvas.addEventListener("pointerdown", onPointerDown)
            const frame = () => {
                if (rain) {
                    rainAccum += 1
                    if (rainAccum > 8) {
                        rainAccum = 0
                        if (Math.random() < 0.9)
                            dropAt(
                                0.5 + (Math.random() - 0.5) * scaleU,
                                0.5 + (Math.random() - 0.5) * scaleV,
                                0.012 + Math.random() * 0.014,
                                -(0.14 + Math.random() * 0.18)
                            )
                    }
                }
                while (pending.length) applyDrop(pending.shift()!)
                update()
                renderFrame()
                raf = requestAnimationFrame(frame)
            }
            raf = requestAnimationFrame(frame)
            // opening ripples so the type ripples as it fades in
            setTimeout(() => dropAt(0.5, 0.5, 0.05, -0.42), 650)
            setTimeout(() => dropAt(0.42, 0.52, 0.035, -0.3), 1100)
            setTimeout(() => dropAt(0.6, 0.47, 0.035, -0.3), 1500)
        }

        return () => {
            aliveFonts = false
            redrawTextRef.current = null
            cancelAnimationFrame(raf)
            window.removeEventListener("resize", resize)
            if (ro) ro.disconnect()
            canvas.removeEventListener("pointerdown", onPointerDown)
            const lose = gl.getExtension("WEBGL_lose_context")
            if (lose) lose.loseContext()
        }
        // Intentionally empty: every prop reaches the loop through `live` / redrawTextRef,
        // so the GL context initialises exactly once. See diff note 2 in the header.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const toggleRain = () => {
        apiRef.current.toggleRain()
        const next = !rainOn
        setRainOn(next)
        onCta?.(next)
    }

    return (
        <div
            ref={wrapRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                background: paperColor || "var(--site-paper, #04060a)",
                ...style,
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    display: reduced ? "none" : "block",
                    width: "100%",
                    height: "100%",
                    position: "absolute",
                    inset: 0,
                    cursor: "crosshair",
                    touchAction: "none",
                }}
            />
            {/* a11y heading — visually hidden while the canvas carries the visible
                type; becomes the visible, styled static fallback under reduced motion */}
            <h1
                style={
                    reduced
                        ? {
                              position: "absolute",
                              inset: 0,
                              margin: 0,
                              display: "grid",
                              placeItems: "center",
                              textAlign: "center",
                              padding: "0 6vw",
                              font: `700 clamp(2.5rem, 13vw, 12rem)/1 ${
                                  fontFamily ||
                                  '"Helvetica Neue", "Segoe UI", Arial, sans-serif'
                              }`,
                              letterSpacing: "0.04em",
                              color: inkColor || "var(--site-ink, #e8f2ff)",
                          }
                        : {
                              position: "absolute",
                              width: 1,
                              height: 1,
                              overflow: "hidden",
                              clip: "rect(0 0 0 0)",
                              clipPath: "inset(50%)",
                              whiteSpace: "nowrap",
                              border: 0,
                              padding: 0,
                              margin: -1,
                          }
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
                        position: "absolute",
                        left: "50%",
                        top: "60%",
                        transform: "translate(-50%,0)",
                        zIndex: 2,
                        cursor: "pointer",
                        font: `500 0.875rem/1 ui-sans-serif, system-ui, sans-serif`,
                        letterSpacing: "0.32em",
                        textTransform: "uppercase",
                        color: inkColor || "var(--site-ink, #d2e4fa)",
                        padding: "14px 40px",
                        borderRadius: 999,
                        background: `color-mix(in srgb, ${
                            accentColor || "var(--site-accent, #6f9fe0)"
                        } ${rainOn ? 42 : 16}%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${
                            accentColor || "var(--site-accent, #6f9fe0)"
                        } ${rainOn ? 70 : 34}%, transparent)`,
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        boxShadow: "0 6px 26px rgba(0,0,0,0.45)",
                        transition: "background .25s, border-color .25s",
                    }}
                >
                    {ctaLabel}
                </button>
            )}
        </div>
    )
}

// SHIPPING DEFAULTS -- hand-tuned on a live bench and approved by eye, then promoted here
// (2026-08-20); `text` was deliberately set back to "RIPPLE" on 2026-08-21 after that session.
// For a Marketplace component the defaults ARE the
// first thing a buyer sees on drop, so these are the listing's presentation, not dev leftovers.
// The look is deliberately monochrome: with a near-black accent the crests are carried almost
// entirely by the caustic term, which stays 35% white regardless of accent
// (causticTint = mix(u_accent, vec3(1.0), 0.35)). Measured luminance range 31.3 vs 42.9 for a
// saturated accent -- restrained, not washed out. Do not "fix" the accent to something brighter
// without re-tuning it on a bench; this tune was approved by hand.
RippleTypeHero.defaultProps = {
    text: "RIPPLE",
    fontFamily: "",
    ctaLabel: "Rain",
    relief: 16,
    glow: 4.5,
    caustics: 110,
    paperColor: "#04060A",
    inkColor: "#FEFEFE",
    accentColor: "#171717",
}

addPropertyControls(RippleTypeHero, {
    text: {
        type: ControlType.String,
        title: "Headline",
        defaultValue: "RIPPLE",
        description:
            "Drawn into the scene and refracted by the water — not a DOM layer.",
    },
    fontFamily: {
        type: ControlType.String,
        title: "Font",
        defaultValue: "",
        placeholder: "inherit",
        description:
            "CSS font-family for the headline. Leave empty to inherit the frame's font.",
    },
    ctaLabel: {
        type: ControlType.String,
        title: "CTA",
        defaultValue: "Rain",
        description: "Toggles an ambient downpour. Empty hides the button.",
    },
    paperColor: {
        type: ControlType.Color,
        title: "Ground",
        defaultValue: "#04060A",
        description:
            "The water is reflection-only, so it reads on a **dark** ground.",
    },
    inkColor: {
        type: ControlType.Color,
        title: "Type",
        defaultValue: "#FEFEFE",
    },
    accentColor: {
        type: ControlType.Color,
        title: "Light",
        defaultValue: "#171717",
        description: "Ripple highlight and caustic hue.",
    },
    relief: {
        type: ControlType.Number,
        title: "Relief",
        defaultValue: 16,
        min: 2,
        max: 16,
        step: 0.5,
        description:
            "Surface-normal exaggeration — also how hard the type warps.",
    },
    glow: {
        type: ControlType.Number,
        title: "Glow",
        defaultValue: 4.5,
        min: 0.5,
        max: 5,
        step: 0.1,
        description: "Reflection gain on the crests.",
    },
    caustics: {
        type: ControlType.Number,
        title: "Caustics",
        defaultValue: 110,
        min: 0,
        max: 120,
        step: 1,
        description: "Chromatic focus under the crest. 0 is off.",
    },
    onCta: {
        type: ControlType.EventHandler,
        title: "On CTA",
    },
})

export default RippleTypeHero
