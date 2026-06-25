// Rule 5 — token-constraints: color class violates an allow/deny constraint.
// Config lives in colors.json → rules["token-constraints"].allowed / .denied.
// Keys are color prefixes (text, border, …) plus the special "hover:" variant.
// "*" is the fallback for any prefix not explicitly listed.
//
// hover: handling is folded in here: when rawTok has "hover:", the color part
// must additionally satisfy allowed["hover:"] (if that key is present).

export const id = 5;
export const name = "token-constraints";

// Pattern syntax: "*X*" → contains, "*suffix" → endsWith, "prefix*" → startsWith, "exact" → exact.
function matchPattern(value, pattern) {
  if (pattern.startsWith("*") && pattern.endsWith("*")) return value.includes(pattern.slice(1, -1));
  if (pattern.startsWith("*")) return value.endsWith(pattern.slice(1));
  if (pattern.endsWith("*")) return value.startsWith(pattern.slice(0, -1));
  return value === pattern;
}

// checkToken(rawTok, tok, normalized, ctx) → message string or null.
export function checkToken(rawTok, tok, normalized, ctx) {
  const { tokens, ansi, ruleConfig } = ctx;
  const { colorPrefixes, semanticSet } = tokens;

  const colorPrefix = colorPrefixes.find((p) => tok.startsWith(p + "-"));
  if (!colorPrefix) return null;

  const colorPart = tok.slice(colorPrefix.length + 1);
  if (!semanticSet.has(colorPart)) return null;

  const { allowed = {}, denied = {} } = ruleConfig ?? {};

  if (colorPrefix in allowed) {
    // Prefix has an explicit allow list — token must match at least one pattern.
    const allowList = allowed[colorPrefix];
    if (!allowList.some((p) => matchPattern(colorPart, p))) {
      const firstSuffix = allowList.find((p) => p.startsWith("*-"));
      const hint = firstSuffix
        ? ` — try ${ansi.blue(colorPrefix + "-" + colorPart + firstSuffix.slice(1))}`
        : "";
      return `${ansi.red(tok)} — ${ansi.red(colorPart)} not allowed for ${ansi.blue(colorPrefix + "-")} (allowed: ${allowList.join(", ")})${hint}`;
    }
  } else {
    // No prefix-specific rule — check the deny list (prefix-specific or fallback "*").
    const denyList = denied[colorPrefix] ?? denied["*"];
    if (denyList?.length) {
      const match = denyList.find((p) => matchPattern(colorPart, p));
      if (match) {
        return `${ansi.red(tok)} — ${ansi.red(colorPart)} matches forbidden pattern ${ansi.blue(match)} for ${ansi.blue(colorPrefix + "-")} (see token-constraints in colors.json)`;
      }
    }
  }

  // hover: modifier — color part must match allowed["hover:"] when present.
  if (rawTok.includes("hover:")) {
    const hoverAllow = allowed["hover:"];
    if (hoverAllow?.length && !hoverAllow.some((p) => matchPattern(colorPart, p))) {
      return `${ansi.red(rawTok)} — hover: color classes must use a ${ansi.blue("-hover")} suffixed token (use ${ansi.blue(colorPrefix + "-" + colorPart + "-hover")})`;
    }
  }

  return null;
}
