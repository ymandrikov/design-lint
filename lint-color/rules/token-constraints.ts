// Config: colors.json → rules["token-constraints"].allowed / .denied. Keys are
// color prefixes (text, border, …) plus a special "hover:" variant; "*" is the
// fallback for any prefix not listed. When rawTok has "hover:", colorPart must
// additionally satisfy allowed["hover:"] if that key is present.

import type { ColorParts, Tokens } from "../classify.ts";

export const id = 5;
export const name = "token-constraints";

interface Ansi {
  red(s: string): string;
  blue(s: string): string;
}

// Prefix → allowed/denied pattern lists.
type PatternMap = Record<string, string[]>;

interface Ctx {
  tokens: Tokens;
  ansi: Ansi;
  ruleConfig?: { allowed?: PatternMap; denied?: PatternMap };
}

// Pattern syntax: "*X*" → contains, "*suffix" → endsWith, "prefix*" → startsWith, "exact" → exact.
function matchPattern(value: string, pattern: string): boolean {
  if (pattern.startsWith("*") && pattern.endsWith("*")) return value.includes(pattern.slice(1, -1));
  if (pattern.startsWith("*")) return value.endsWith(pattern.slice(1));
  if (pattern.endsWith("*")) return value.startsWith(pattern.slice(0, -1));
  return value === pattern;
}

export function checkToken(rawTok: string, parts: ColorParts, ctx: Ctx): string | null {
  const { tokens, ansi, ruleConfig } = ctx;
  const { semanticSet } = tokens;
  const { base, colorPrefix, colorPart, variants } = parts;

  if (!colorPrefix) return null;
  // colorPrefix set ⇒ colorPart is a non-null string; this only guards the type.
  if (colorPart === null) return null;
  if (!semanticSet?.has(colorPart)) return null;

  const { allowed = {}, denied = {} } = ruleConfig ?? {};

  if (colorPrefix in allowed) {
    const allowList = allowed[colorPrefix];
    if (!allowList.some((p) => matchPattern(colorPart, p))) {
      const firstSuffix = allowList.find((p) => p.startsWith("*-"));
      const hint = firstSuffix
        ? ` — try ${ansi.blue(colorPrefix + "-" + colorPart + firstSuffix.slice(1))}`
        : "";
      return `${ansi.red(base)} — ${ansi.red(colorPart)} not allowed for ${ansi.blue(colorPrefix + "-")} (allowed: ${allowList.join(", ")})${hint}`;
    }
  } else {
    const denyList = denied[colorPrefix] ?? denied["*"];
    if (denyList?.length) {
      const match = denyList.find((p) => matchPattern(colorPart, p));
      if (match) {
        return `${ansi.red(base)} — ${ansi.red(colorPart)} matches forbidden pattern ${ansi.blue(match)} for ${ansi.blue(colorPrefix + "-")} (see token-constraints in colors.json)`;
      }
    }
  }

  // Match parsed Tailwind variants ("hover" or any "-hover" compound like
  // group-hover), not a raw substring, so a "hover:" inside a bracket group
  // ("[@media(hover:hover)]:…") isn't mistaken for a hover variant.
  if (variants.some((v) => v === "hover" || v.endsWith("-hover"))) {
    const hoverAllow = allowed["hover:"];
    if (hoverAllow?.length && !hoverAllow.some((p) => matchPattern(colorPart, p))) {
      return `${ansi.red(rawTok)} — hover: color classes must use a ${ansi.blue("-hover")} suffixed token (use ${ansi.blue(colorPrefix + "-" + colorPart + "-hover")})`;
    }
  }

  return null;
}
