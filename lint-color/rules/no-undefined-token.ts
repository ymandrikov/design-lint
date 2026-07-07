// Requires tokens.isValidTailwindCandidate (from the Tailwind design system).
// No-op when absent so rule-specific tests without the Tailwind API aren't affected.

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

export function checkToken(_rawTok: string, parts: ColorParts, ctx: Ctx): string | null {
  const { tokens, ansi } = ctx;
  const { isValidTailwindCandidate } = tokens;
  const { base, colorPrefix, colorPart } = parts;

  if (!isValidTailwindCandidate) return null;
  if (!colorPrefix) return null;
  // colorPrefix set ⇒ colorPart is a non-null string; this only guards the type.
  if (colorPart === null) return null;
  if (colorPart.startsWith("[")) return null;

  if (!isValidTailwindCandidate(base)) {
    return `${ansi.red(base)} — ${ansi.red(colorPart)} is not defined; check spelling or add ${ansi.blue("--color-" + colorPart)}`;
  }
  return null;
}
