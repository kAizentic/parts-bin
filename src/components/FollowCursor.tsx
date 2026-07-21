"use client";

/**
 * FollowCursor — a custom disc that lerps after the pointer and swells to show a
 * label over any `[data-cursor]` element.
 *
 * Pattern — a zone-gated "view project" cursor.
 * ZONE-GATED: the stylized cursor only appears over a `[data-cursor-zone]` ancestor
 * (e.g. show a "view project" cursor only over the works area); elsewhere the
 * native cursor is used. Hard-won correctness: re-arm on `pointermove`;
 * never hide on a child `pointerout`. Gated to
 * `(prefers-reduced-motion: no-preference) and (hover:hover) and (pointer:fine)`.
 *
 * Mount once at the page root, wrap the zones in `[data-cursor-zone]`, and add
 * `data-cursor="Label"` to interactive targets inside them.
 * Add this CSS so the native cursor hides ONLY inside zones (the disc takes over there):
 *   @media (hover:hover) and (pointer:fine){ .cursor-enabled [data-cursor-zone], .cursor-enabled [data-cursor-zone] *{ cursor:none } }
 *   @media (prefers-reduced-motion:reduce){ .follow-cursor{ display:none } }
 * Theming: `--site-ink` (disc) / `--site-paper` (label). effect_type: cursor-follow.
 *
 * Deps: gsap, @gsap/react.
 */
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export default function FollowCursor({
  defaultLabel = "View",
  rootSelector = "body",
}: {
  defaultLabel?: string;
  rootSelector?: string;
}) {
  const dot = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = dot.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)", () => {
        const root = document.querySelector(rootSelector);
        root?.classList.add("cursor-enabled");
        gsap.set(el, { xPercent: -50, yPercent: -50, opacity: 0, scale: 0.32 });
        const xT = gsap.quickTo(el, "x", { duration: 0.35, ease: "power3" });
        const yT = gsap.quickTo(el, "y", { duration: 0.35, ease: "power3" });
        let visible = false;
        const move = (e: PointerEvent) => {
          xT(e.clientX); yT(e.clientY);
          const inZone = !!(e.target as HTMLElement)?.closest?.("[data-cursor-zone]");
          if (inZone && !visible) { visible = true; gsap.to(el, { opacity: 1, duration: 0.25, ease: "power2.out", overwrite: "auto" }); }
          else if (!inZone && visible) { visible = false; gsap.to(el, { opacity: 0, duration: 0.2, overwrite: "auto" }); }
        };
        const over = (e: PointerEvent) => {
          const hit = (e.target as HTMLElement)?.closest?.("[data-cursor]");
          if (hit && hit.closest("[data-cursor-zone]")) {
            if (label.current) label.current.textContent = hit.getAttribute("data-cursor") || defaultLabel;
            gsap.to(el, { scale: 1, duration: 0.32, ease: "power3.out" });
          } else gsap.to(el, { scale: 0.32, duration: 0.32, ease: "power3.out" });
        };
        const leave = () => { visible = false; gsap.to(el, { opacity: 0, duration: 0.25, overwrite: "auto" }); };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerover", over);
        document.documentElement.addEventListener("mouseleave", leave);
        return () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerover", over);
          document.documentElement.removeEventListener("mouseleave", leave);
          root?.classList.remove("cursor-enabled");
        };
      });
      return () => mm.revert();
    },
    { scope: dot },
  );

  return (
    <div
      ref={dot}
      aria-hidden
      className="follow-cursor pointer-events-none fixed left-0 top-0 z-[60] flex h-20 w-20 items-center justify-center rounded-full"
      style={{ background: "var(--site-ink,#111)", color: "var(--site-paper,#fff)", willChange: "transform" }}
    >
      <span ref={label} className="px-2 text-center text-[0.62rem] uppercase leading-tight tracking-[0.12em]">
        {defaultLabel}
      </span>
    </div>
  );
}
