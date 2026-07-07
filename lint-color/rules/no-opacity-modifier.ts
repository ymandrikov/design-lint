// Rule 3 — No opacity modifiers on color classes (e.g. bg-destructive/5).
// Use a dedicated token with the opacity baked in instead.

import { classifyColorPart, type ColorParts, type Tokens } from "../classify.ts";

export const id = 3;
export const name = "no-opacity-modifier";

interface Ansi {
  red(s: string): string;
  blue(s: string): string;
}

interface Ctx {
  tokens: Tokens;
  ansi: Ansi;
}

// Fires on any modifier — numeric (/50), arbitrary (/[0.5]), var shorthand
// (/(--alpha)) — but only when the base is a real color. The color gate kills
// the line-height false positive (text-sm/6, text-lg/[1.4]); the broad modifier
// match closes the arbitrary/var opacity bypass (finding #3).
export function checkToken(_rawTok: string, parts: ColorParts, ctx: Ctx): string | null {
  const { tokens, ansi } = ctx;
  const { base, modifier, colorPrefix, colorPart } = parts;
  // null → no "/"; "" → a trailing-slash typo ("bg-primary/"), not a Modifier.
  if (!modifier) return null;
  if (!colorPrefix) return null;
  if (classifyColorPart(colorPart, tokens) === null) return null;

  return `${ansi.red(`${base}/${modifier}`)} — opacity modifier on color class; use a dedicated token`;
}
