// Rule 12 — Color class does not resolve to any CSS in this project.
// Requires tokens.isValidTailwindCandidate (loaded from the Tailwind design system
// in index.ts). No-op when the function is absent so rule-specific tests that
// don't provide the Tailwind API are not affected.

export const id = 12;
export const name = "no-undefined-token";

// checkToken(rawTok, parts, ctx) → message string or null.
export function checkToken(rawTok, parts, ctx) {
  const { tokens, ansi } = ctx;
  const { isValidTailwindCandidate } = tokens;
  const { base, colorPrefix, colorPart } = parts;

  if (!isValidTailwindCandidate) return null;
  if (!colorPrefix) return null;
  if (colorPart.startsWith("[")) return null;

  if (!isValidTailwindCandidate(base)) {
    return `${ansi.red(base)} — ${ansi.red(colorPart)} is not defined; check spelling or add ${ansi.blue("--color-" + colorPart)}`;
  }
  return null;
}
