// Rule 9 — No dark: variant.
// Dark theme is handled via CSS custom properties in the color token files.
// Use a semantic token (e.g. bg-success-muted) so it resolves correctly for each theme.

import type { ColorParts } from "../classify.ts";

export const id = 9;
export const name = "no-dark-variant";

interface Ansi {
  red(s: string): string;
  blue(s: string): string;
}

interface Ctx {
  ansi: Ansi;
}

// Keys off the raw token only, so the decomposed parts go unused.
export function checkToken(rawTok: string, _parts: ColorParts, ctx: Ctx): string | null {
  const { ansi } = ctx;
  if (/(?:^|:)dark:/.test(rawTok)) {
    return `${ansi.red(rawTok)} — dark: variant not allowed; use a semantic token (dark theme is handled via CSS custom properties)`;
  }
  return null;
}
