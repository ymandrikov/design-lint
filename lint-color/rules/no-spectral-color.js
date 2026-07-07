// Rule 4 — No spectral (palette) Tailwind color classes.
// E.g. bg-red-500, text-blue-200. Use a design token instead.
// When colors.json provides a replacement map, the error message names the token to use.

import { classifyParts, findSpectralMatch } from "../classify.js";

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

// checkToken(rawTok, parts, ctx) → message string or null.
// Fires on the classifier's "spectral" verdict (palette name + numeric shade behind
// a color prefix), mirroring no-var-color / no-raw-css-color. The matched name+shade
// for the replacement hint come from the same shared scan (findSpectralMatch), so the
// rule keeps no private detection loop of its own.
export function checkToken(rawTok, parts, ctx) {
  const { tokens, ansi, ruleConfig } = ctx;
  if (classifyParts(parts, tokens) !== "spectral") return null;
  const { base, colorPrefix } = parts;
  // The "spectral" verdict guarantees a match on the color part (one shared scan).
  const { name: colorName, shade } = findSpectralMatch(parts.colorPart, tokens.spectralSet);
  const semantic =
    colorPrefix && ruleConfig?.replacement
      ? findReplacement(ruleConfig.replacement, colorPrefix, colorName, shade)
      : null;
  const hint = semantic ? ` — try ${ansi.blue(colorPrefix + "-" + semantic)}` : "";
  return `${ansi.red(base)} — spectral color class; use a design token instead${hint}`;
}
