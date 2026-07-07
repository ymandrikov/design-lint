// Rule 2 — No raw color values in component CSS or Tailwind arbitrary values.
// Use a var(--color-*) token instead.

import valueParser from "postcss-value-parser";

import { classifyParts, type ColorParts, type Tokens } from "../classify.ts";
import { isColor } from "../vendor/is-color.ts";

export const id = 2;
export const name = "no-raw-css-color";

interface Ansi {
  red(s: string): string;
  blue(s: string): string;
}

// Flags a literal color hiding in a Tailwind arbitrary value (bg-[#ff0000],
// bg-[red], text-[color:red], bg-[var(--x,red)]) or an arbitrary-property
// candidate ([color:red], [--my-color:red]). Consumes the shared "raw" verdict
// rather than re-scanning — one definition of "literal color" for classes and
// CSS declarations.
export function checkToken(
  rawTok: string,
  parts: ColorParts,
  ctx: { tokens: Tokens; ansi: Ansi },
): string | null {
  const { tokens, ansi } = ctx;
  if (classifyParts(parts, tokens) !== "raw") return null;
  return `${ansi.red(rawTok)} — raw color in arbitrary value; use a ${ansi.blue("var(--color-*)")} token`;
}

// Parses via postcss-value-parser so detection never sees selectors or at-rule
// preludes. url(...) references are skipped — a `#id` fragment inside url() is
// not a color (finding #8). Returns the first raw color found, or null.
export function findRawColor(value: string): string | null {
  let found: string | null = null;
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

// The caller owns the declaration node, ignore detection, and line numbers.
export function checkValue(value: string, ctx: { ansi: Ansi }): string | null {
  const { ansi } = ctx;
  const found = findRawColor(value);
  if (found) {
    return `Raw color value ${ansi.red(found)} — use a ${ansi.blue("var(--color-*)")} token`;
  }
  return null;
}
