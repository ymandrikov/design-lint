// Rule 5 — token-constraints: color class violates an allow/deny constraint.
// Config lives in colors.json → rules["token-constraints"].allowed / .denied.
// Keys are color prefixes (text, border, …) plus the special "hover:" variant.
// "*" is the fallback for any prefix not explicitly listed.
//
// hover: handling is folded in here: when rawTok has "hover:", the color part
// must additionally satisfy allowed["hover:"] (if that key is present).

import type { ColorParts, Tokens } from "../classify.ts";

export const id = 5;
export const name = "token-constraints";

interface Ansi {
  red(s: string): string;
  blue(s: string): string;
}

// Prefix → allowed/denied pattern lists (see the pattern syntax below).
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

// checkToken(rawTok, parts, ctx) → message string or null.
export function checkToken(rawTok: string, parts: ColorParts, ctx: Ctx): string | null {
  const { tokens, ansi, ruleConfig } = ctx;
  const { semanticSet } = tokens;
  const { base, colorPrefix, colorPart, variants } = parts;

  if (!colorPrefix) return null;
  // colorPrefix set ⇒ colorPart is a string; the null branch only guards the type.
  if (colorPart === null) return null;
  if (!semanticSet?.has(colorPart)) return null;

  const { allowed = {}, denied = {} } = ruleConfig ?? {};

  if (colorPrefix in allowed) {
    // Prefix has an explicit allow list — token must match at least one pattern.
    const allowList = allowed[colorPrefix];
    if (!allowList.some((p) => matchPattern(colorPart, p))) {
      const firstSuffix = allowList.find((p) => p.startsWith("*-"));
      const hint = firstSuffix
        ? ` — try ${ansi.blue(colorPrefix + "-" + colorPart + firstSuffix.slice(1))}`
        : "";
      return `${ansi.red(base)} — ${ansi.red(colorPart)} not allowed for ${ansi.blue(colorPrefix + "-")} (allowed: ${allowList.join(", ")})${hint}`;
    }
  } else {
    // No prefix-specific rule — check the deny list (prefix-specific or fallback "*").
    const denyList = denied[colorPrefix] ?? denied["*"];
    if (denyList?.length) {
      const match = denyList.find((p) => matchPattern(colorPart, p));
      if (match) {
        return `${ansi.red(base)} — ${ansi.red(colorPart)} matches forbidden pattern ${ansi.blue(match)} for ${ansi.blue(colorPrefix + "-")} (see token-constraints in colors.json)`;
      }
    }
  }

  // hover: variant — color part must match allowed["hover:"] when present.
  // Driven by the parsed Tailwind variants: "hover" itself plus any "-hover"
  // compound (group-hover, peer-hover, …), matching what the old substring
  // sniff caught — while a "hover:" buried in a bracket group (e.g.
  // "[@media(hover:hover)]:…") is NOT mistaken for a hover variant.
  if (variants.some((v) => v === "hover" || v.endsWith("-hover"))) {
    const hoverAllow = allowed["hover:"];
    if (hoverAllow?.length && !hoverAllow.some((p) => matchPattern(colorPart, p))) {
      return `${ansi.red(rawTok)} — hover: color classes must use a ${ansi.blue("-hover")} suffixed token (use ${ansi.blue(colorPrefix + "-" + colorPart + "-hover")})`;
    }
  }

  return null;
}
