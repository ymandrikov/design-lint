import { classifyParts, type ColorParts, type Tokens } from "../classify.ts";

export const id = 6;
export const name = "no-var-color";

interface Ansi {
  red(s: string): string;
  blue(s: string): string;
}

interface Ctx {
  tokens: Tokens;
  ansi: Ansi;
}

// Fires on the classifier's "var" verdict. A var reference carrying a literal
// fallback (bg-[var(--x,red)]) classifies "raw" instead, so no-raw-css-color
// owns it and this rule never double-reports.
export function checkToken(rawTok: string, parts: ColorParts, ctx: Ctx): string | null {
  const { tokens, ansi } = ctx;
  if (classifyParts(parts, tokens) !== "var") return null;
  // Arbitrary-property candidates ([color:var(--x)]) have no prefix, so name the
  // utility class only in general terms.
  const utility = parts.colorPrefix
    ? `a ${ansi.blue(`${parts.colorPrefix}-<token>`)} semantic utility class`
    : `a ${ansi.blue("semantic utility class")}`;
  return `${ansi.red(rawTok)} — CSS variable in a color class; use ${utility}, not a var() reference`;
}
