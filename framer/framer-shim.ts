/**
 * Local stand-in for the `framer` runtime module.
 *
 * `RippleTypeHero.framer.tsx` is written to be pasted verbatim into a Framer project, so it
 * imports `addPropertyControls` / `ControlType` from "framer" — a module that only exists inside
 * Framer. This shim lets the SAME FILE also render on the public preview route without editing it,
 * which matters: the preview must show the artifact a buyer actually gets, not a near-copy that
 * can drift from it.
 *
 * Wired via the `"framer"` entry in tsconfig `paths`; Next resolves tsconfig paths natively, so no
 * webpack alias is needed. Committed on purpose — the earlier `node_modules/framer` stub was a
 * throwaway and would vanish on the next `npm install`, breaking the Netlify build.
 *
 * `addPropertyControls` is a no-op here: property controls only mean anything on the Framer canvas.
 */

export const ControlType = {
  Array: "array",
  Boolean: "boolean",
  Color: "color",
  ComponentInstance: "componentinstance",
  Date: "date",
  Enum: "enum",
  EventHandler: "eventhandler",
  File: "file",
  Font: "font",
  Image: "image",
  Link: "link",
  Number: "number",
  Object: "object",
  Padding: "padding",
  BorderRadius: "borderradius",
  ResponsiveImage: "responsiveimage",
  RichText: "richtext",
  String: "string",
  Transition: "transition",
} as const;

export function addPropertyControls(
  _component: unknown,
  _controls: Record<string, Record<string, unknown>>
): void {
  /* no-op outside Framer */
}
