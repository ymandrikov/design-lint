// Rule 3 — No opacity modifiers on color classes (e.g. bg-destructive/5).
// Use a dedicated token with the opacity baked in instead.

import {
  classifyColorPart,
  findColorPrefix,
  splitColorToken,
} from "../classify.js";

export const id = 3;
export const name = "no-opacity-modifier";

// checkToken(rawTok, tok, normalized, ctx) → message string or null.
// Returns a message and signals the orchestrator to stop checking this token further.
//
// Fires on ANY Modifier — numeric (/50), arbitrary (/[0.5]), or var shorthand
// (/(--alpha)) — but only when the base is actually a color (classifyColorPart
// is non-null). The real-color gate kills the line-height false positive
// (text-sm/6, text-lg/[1.4]) while the broadened Modifier detection closes the
// arbitrary/var opacity bypass (finding #3).
export function checkToken(rawTok, tok, normalized, ctx) {
  const { tokens, ansi } = ctx;
  const { base, modifier } = splitColorToken(rawTok);
  // null → no "/"; "" → a trailing-slash typo ("bg-primary/"), not a Modifier.
  if (!modifier) return null;

  const prefix = findColorPrefix(base, tokens.colorPrefixes);
  if (!prefix) return null;

  const colorPart = base.slice(prefix.length + 1);
  if (classifyColorPart(colorPart, tokens) === null) return null;

  return `${ansi.red(`${base}/${modifier}`)} — opacity modifier on color class; use a dedicated token`;
}
