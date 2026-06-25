// Rule 4 — No spectral (palette) Tailwind color classes.
// E.g. bg-red-500, text-blue-200. Use a design token instead.
// When colors.json provides a replacement map, the error message names the token to use.

export const id = 4;
export const name = "no-spectral-color";

// Look up a semantic replacement for (colorPrefix, colorName, numericScale).
// replacement format: { text: [{ "green-400...600": "success-content" }, ...], bg: [...] }
function findReplacement(replacement, colorPrefix, colorName, scale) {
  const list = replacement[colorPrefix];
  if (!list?.length) return null;
  const num = parseInt(scale, 10);
  for (const entry of list) {
    const [key, semantic] = Object.entries(entry)[0];
    const dashIdx = key.indexOf("-");
    if (dashIdx === -1) continue;
    if (key.slice(0, dashIdx) !== colorName) continue;
    const range = key.slice(dashIdx + 1);
    if (range.includes("...")) {
      const [lo, hi] = range.split("...").map(Number);
      if (num >= lo && num <= hi) return semantic;
    } else if (parseInt(range, 10) === num) {
      return semantic;
    }
  }
  return null;
}

// checkToken(rawTok, tok, normalized, ctx) → message string or null.
// Returns a message and signals the orchestrator to stop checking this token further.
export function checkToken(rawTok, tok, normalized, ctx) {
  const { tokens, ansi, ruleConfig } = ctx;
  const parts = tok.split("-");
  // Scan all internal segments to handle e.g. "divide-x-red-500", "ring-offset-blue-200".
  for (let i = 1; i < parts.length - 1; i++) {
    if (tokens.spectralSet.has(parts[i]) && /^\d+$/.test(parts[i + 1])) {
      const colorName = parts[i];
      const scale = parts[i + 1];
      const colorPrefix = tokens.colorPrefixes.find((p) => tok.startsWith(p + "-"));
      const semantic =
        colorPrefix && ruleConfig?.replacement
          ? findReplacement(ruleConfig.replacement, colorPrefix, colorName, scale)
          : null;
      const hint = semantic ? ` — try ${ansi.blue(colorPrefix + "-" + semantic)}` : "";
      return `${ansi.red(tok)} — spectral color class; use a design token instead${hint}`;
    }
  }
  return null;
}
