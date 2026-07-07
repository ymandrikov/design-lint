// Rule 4 — No spectral (palette) Tailwind color classes.
// E.g. bg-red-500, text-blue-200. Use a design token instead.
// When colors.json provides a replacement map, the error message names the token to use.

import { classifyParts, findSpectralMatch, composeColorParts } from "../classify.js";

export const id = 4;
export const name = "no-spectral-color";

// Decomposed candidate. Derived from the classifier's source of truth so it can't drift.
// Non-null: the linter guards `parts === null` and `!parts.base` before this rule runs.
type Parts = NonNullable<ReturnType<typeof composeColorParts>>;

// The two ansi helpers this rule calls (the runtime object also carries `dim`, unused here).
interface Ansi {
  red(s: string): string;
  blue(s: string): string;
}

// The token sets classifyParts / findSpectralMatch read (matches their JSDoc `tokens` param).
interface ClassifierTokens {
  semanticSet?: Set<string>;
  spectralSet?: Set<string>;
}

// prefix → [ { "name-shadeOrRange": semanticToken }, ... ]
// e.g. { text: [ { "green-400...600": "success-content" } ], bg: [ { "green-500": "success" } ] }
type ReplacementMap = Record<string, Array<Record<string, string>>>;

interface RuleConfig {
  replacement?: ReplacementMap;
}

// Rule invocation context, built by checkTokenIfEnabled in shared.js.
interface Ctx {
  tokens: ClassifierTokens;
  ansi: Ansi;
  ruleConfig?: RuleConfig;
}

// Look up a semantic replacement for (colorPrefix, colorName, numericScale).
// replacement format: { text: [{ "green-400...600": "success-content" }, ...], bg: [...] }
function findReplacement(
  replacement: ReplacementMap,
  colorPrefix: string,
  colorName: string,
  scale: string,
): string | null {
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
export function checkToken(rawTok: string, parts: Parts, ctx: Ctx): string | null {
  const { tokens, ansi, ruleConfig } = ctx;
  if (classifyParts(parts, tokens) !== "spectral") return null;
  const { base, colorPrefix } = parts;
  // The "spectral" verdict guarantees colorPart is set and that the shared scan matches
  // (classifyParts derives the verdict from this same findSpectralMatch call), so both
  // non-null assertions are sound — one shared scan, no private detection loop.
  const { name: colorName, shade } = findSpectralMatch(parts.colorPart!, tokens.spectralSet)!;
  const semantic =
    colorPrefix && ruleConfig?.replacement
      ? findReplacement(ruleConfig.replacement, colorPrefix, colorName, shade)
      : null;
  const hint = semantic ? ` — try ${ansi.blue(colorPrefix + "-" + semantic)}` : "";
  return `${ansi.red(base)} — spectral color class; use a design token instead${hint}`;
}
