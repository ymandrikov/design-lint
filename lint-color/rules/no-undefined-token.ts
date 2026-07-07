// Rule 12 — Color class does not resolve to any CSS in this project.
// Requires tokens.isValidTailwindCandidate (loaded from the Tailwind design system
// in index.ts). No-op when the function is absent so rule-specific tests that
// don't provide the Tailwind API are not affected.

import type { ColorParts } from "../classify.ts";

export const id = 12;
export const name = "no-undefined-token";

interface Ansi {
  red(s: string): string;
  blue(s: string): string;
}

interface Ctx {
  tokens: { isValidTailwindCandidate?: ((tok: string) => boolean) | null };
  ansi: Ansi;
}

// checkToken(rawTok, parts, ctx) → message string or null.
export function checkToken(_rawTok: string, parts: ColorParts, ctx: Ctx): string | null {
  const { tokens, ansi } = ctx;
  const { isValidTailwindCandidate } = tokens;
  const { base, colorPrefix, colorPart } = parts;

  if (!isValidTailwindCandidate) return null;
  if (!colorPrefix) return null;
  // colorPrefix set ⇒ colorPart is a string (possibly ""); the null branch is
  // unreachable at runtime and only guards the type.
  if (colorPart === null) return null;
  if (colorPart.startsWith("[")) return null;

  if (!isValidTailwindCandidate(base)) {
    return `${ansi.red(base)} — ${ansi.red(colorPart)} is not defined; check spelling or add ${ansi.blue("--color-" + colorPart)}`;
  }
  return null;
}
