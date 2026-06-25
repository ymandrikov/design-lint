// Rule 12 — Color class does not resolve to any CSS in this project.
// Requires tokens.isValidTailwindCandidate (loaded from the Tailwind design system
// in index.js). No-op when the function is absent so rule-specific tests that
// don't provide the Tailwind API are not affected.

export const id = 12;
export const name = "no-undefined-token";

export function checkToken(rawTok, tok, normalized, ctx) {
  const { tokens, ansi } = ctx;
  const { colorPrefixes, isValidTailwindCandidate } = tokens;

  if (!isValidTailwindCandidate) return null;

  const colorPrefix = colorPrefixes.find((p) => tok.startsWith(p + "-"));
  if (!colorPrefix) return null;

  const colorPart = tok.slice(colorPrefix.length + 1);
  if (colorPart.startsWith("[")) return null;

  if (!isValidTailwindCandidate(tok)) {
    return `${ansi.red(tok)} — ${ansi.red(colorPart)} is not defined; check spelling or add ${ansi.blue("--color-" + colorPart)}`;
  }
  return null;
}
