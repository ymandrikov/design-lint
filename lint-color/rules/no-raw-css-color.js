// Rule 2 — No raw color values in component CSS or Tailwind arbitrary values.
// Use a var(--color-*) token instead.

import valueParser from "postcss-value-parser";

import { classifyParts } from "../classify.js";
import { isColor } from "../vendor/is-color.js";

export const id = 2;
export const name = "no-raw-css-color";

// checkToken(rawTok, parts, ctx) → message string or null.
// Flags a literal color hiding in a Tailwind arbitrary value (bg-[#ff0000],
// bg-[red], text-[color:red], bg-[var(--x,red)]) or an arbitrary-property
// candidate ([color:red], [background-color:#123], [--my-color:red]). It
// consumes the shared classification (verdict "raw") instead of re-scanning the
// token — one definition of "literal color" for classes and CSS declarations.
export function checkToken(rawTok, parts, ctx) {
  const { tokens, ansi } = ctx;
  if (classifyParts(parts, tokens) !== "raw") return null;
  return `${ansi.red(rawTok)} — raw color in arbitrary value; use a ${ansi.blue("var(--color-*)")} token`;
}

// findRawColor(value) → matched color string or null.
// Inspects a CSS declaration / style-object value via postcss-value-parser so
// color detection never sees selectors or at-rule preludes. url(...) references
// are skipped — a `#id` fragment inside url() is not a color (finding #8). Every
// other token is checked against the shared is-color, so named colors (`red`)
// are flagged like hex and color functions. Returns the first raw color found.
export function findRawColor(value) {
  let found = null;
  valueParser(value).walk((node) => {
    if (found) return false;
    if (node.type === "function") {
      // Don't descend into url() — its argument is a reference, not a color.
      if (node.value.toLowerCase() === "url") return false;
      // A color-function call (rgb/hsl/oklch/color-mix/…) is itself a raw color.
      if (isColor(node.value + "(")) {
        found = valueParser.stringify(node);
        return false;
      }
      // Otherwise descend (e.g. a raw color inside a gradient).
    } else if (node.type === "word" && isColor(node.value)) {
      found = node.value;
    }
  });
  return found;
}

// checkValue(value, ctx) → message string or null.
// The caller owns the declaration node, ignore detection, and line numbers.
export function checkValue(value, ctx) {
  const { ansi } = ctx;
  const found = findRawColor(value);
  if (found) {
    return `Raw color value ${ansi.red(found)} — use a ${ansi.blue("var(--color-*)")} token`;
  }
  return null;
}
