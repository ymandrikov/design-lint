// No spectral (palette) Tailwind color classes — e.g. bg-red-500, text-blue-200.
// Use a design token instead. When colors.json supplies a replacement map, the
// message names the token to use.

import { classifyParts, findSpectralMatch, composeColorParts } from "../classify.ts";

export const id = 4;
export const name = "no-spectral-color";

// Non-null: the linter guards `parts === null` and `!parts.base` before this rule runs.
type Parts = NonNullable<ReturnType<typeof composeColorParts>>;

interface Ansi {
  red(s: string): string;
  blue(s: string): string;
}

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

// Built by checkTokenIfEnabled in linter.ts.
interface Ctx {
  tokens: ClassifierTokens;
  ansi: Ansi;
  ruleConfig?: RuleConfig;
}

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

// The hint's name+shade come from the same shared findSpectralMatch scan, so the
// rule keeps no private detection loop of its own.
export function checkToken(rawTok: string, parts: Parts, ctx: Ctx): string | null {
  const { tokens, ansi, ruleConfig } = ctx;
  if (classifyParts(parts, tokens) !== "spectral") return null;
  const { base, colorPrefix } = parts;
  // The "spectral" verdict is derived from this same findSpectralMatch call, so colorPart
  // is set and the scan matches — both non-null assertions are sound.
  const { name: colorName, shade } = findSpectralMatch(parts.colorPart!, tokens.spectralSet)!;
  const semantic =
    colorPrefix && ruleConfig?.replacement
      ? findReplacement(ruleConfig.replacement, colorPrefix, colorName, shade)
      : null;
  const hint = semantic ? ` — try ${ansi.blue(colorPrefix + "-" + semantic)}` : "";
  return `${ansi.red(base)} — spectral color class; use a design token instead${hint}`;
}
