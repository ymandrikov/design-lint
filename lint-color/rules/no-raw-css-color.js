// Rule 2 — No raw color values in component CSS.
// Use a var(--color-*) token instead.

import valueParser from "postcss-value-parser";

export const id = 2;
export const name = "no-raw-css-color";

// Hex must be exactly 3, 4, 6, or 8 digits — 5/7-digit hex is invalid CSS and
// must not match (finding #8). Longest-first so a 6-digit hex isn't clipped to
// a 3-digit prefix. The trailing \b rejects over-long runs (e.g. #abcdef0).
export const RAW_COLOR_RE =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|(?:rgb|rgba|hsl|hsla|oklch|lch|lab|oklab|hwb)\s*\(/;

// CSS functions whose call is itself a raw color literal.
const COLOR_FUNCS = new Set([
  "rgb", "rgba", "hsl", "hsla", "oklch", "lch", "lab", "oklab", "hwb",
]);
// A standalone hex color token (whole word, valid digit count).
const HEX_WORD_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

// checkToken(rawTok, parts, ctx) → message string or null.
// Catches raw colors in Tailwind arbitrary values (bg-[#ff0000]) and bare color
// strings extracted from style prop values (style={{ color: "#f00" }}).
// Scans the raw token directly — the color decomposition isn't needed here.
export function checkToken(rawTok, parts, ctx) {
  const { ansi } = ctx;
  // Arbitrary value bracket: bg-[#ff0000], text-[rgb(255,0,0)], etc.
  const bracketMatch = rawTok.match(/\[([^\]]+)\]/);
  if (bracketMatch && RAW_COLOR_RE.test(bracketMatch[1])) {
    return `${ansi.red(rawTok)} — raw color in arbitrary value; use a ${ansi.blue("var(--color-*)")} token`;
  }
  // Bare raw color value (e.g. "#f00" from style={{ color: "#f00" }})
  if (RAW_COLOR_RE.test(rawTok)) {
    return `${ansi.red(rawTok)} — raw color value; use a ${ansi.blue("var(--color-*)")} token`;
  }
  return null;
}

// checkValue(value, ctx) → message string or null.
// Inspects a CSS declaration value via postcss-value-parser so color detection
// never sees selectors or at-rule preludes. url(...) references are skipped —
// a `#id` fragment inside url() is not a color (finding #8). The caller is
// responsible for the declaration node, ignore detection, and line numbers.
export function checkValue(value, ctx) {
  const { ansi } = ctx;
  let found = null;
  valueParser(value).walk((node) => {
    if (found) return false;
    if (node.type === "function") {
      // Don't descend into url() — its argument is a reference, not a color.
      if (node.value.toLowerCase() === "url") return false;
      if (COLOR_FUNCS.has(node.value.toLowerCase())) {
        found = valueParser.stringify(node);
        return false;
      }
    } else if (node.type === "word" && HEX_WORD_RE.test(node.value)) {
      found = node.value;
    }
  });
  if (found) {
    return `Raw color value ${ansi.red(found)} — use a ${ansi.blue("var(--color-*)")} token`;
  }
  return null;
}
