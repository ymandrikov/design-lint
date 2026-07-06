// Rule 2 — No raw color values in component CSS.
// Use a var(--color-*) token instead.

export const id = 2;
export const name = "no-raw-css-color";

export const RAW_COLOR_RE =
  /#[0-9a-fA-F]{3,8}\b|(?:rgb|rgba|hsl|hsla|oklch|lch|lab|oklab|hwb)\s*\(/;

// checkToken(rawTok, parts, ctx) → message string or null.
// Catches raw colors in Tailwind arbitrary values (bg-[#ff0000]) and bare color
// strings extracted from style prop values (style={{ color: "#f00" }}).
// Scans the raw token directly — the color decomposition isn't needed here.
export function checkToken(rawTok, parts, ctx) {
  const { ansi } = ctx;
  // Arbitrary value bracket: bg-[#ff0000], text-[rgb(255,0,0)], etc.
  const bracketMatch = rawTok.match(/\[([^\]]+)\]/);
  if (bracketMatch && RAW_COLOR_RE.test(bracketMatch[1])) {
    const match = bracketMatch[1].match(RAW_COLOR_RE);
    return `${ansi.red(rawTok)} — raw color in arbitrary value; use a ${ansi.blue("var(--color-*)")} token`;
  }
  // Bare raw color value (e.g. "#f00" from style={{ color: "#f00" }})
  if (RAW_COLOR_RE.test(rawTok)) {
    const match = rawTok.match(RAW_COLOR_RE);
    return `${ansi.red(rawTok)} — raw color value; use a ${ansi.blue("var(--color-*)")} token`;
  }
  return null;
}

// checkLine(line, ctx) → message string or null.
// Used for CSS file checking. Caller is responsible for comment tracking and ignore detection.
export function checkLine(line, ctx) {
  const { ansi } = ctx;
  if (RAW_COLOR_RE.test(line)) {
    const match = line.match(RAW_COLOR_RE);
    return `Raw color value ${ansi.red(match[0])} — use a ${ansi.blue("var(--color-*)")} token`;
  }
  return null;
}
