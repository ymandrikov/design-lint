// Rule 6 — No CSS-variable reference behind a color prefix.
// Use the token's semantic utility class (bg-primary), not a var() reference.

import { classifyColorPart } from "../classify.js";

export const id = 6;
export const name = "no-var-color";

// checkToken(rawTok, parts, ctx) → message string or null.
// Fires on the classifier's "var" verdict — a clean CSS-variable reference
// behind a color prefix: the v4 shorthand (bg-(--x)), the bracketed form
// (bg-[var(--x)]), and the color:-hinted form (text-[color:var(--x)]). A var
// reference carrying a literal-color fallback (bg-[var(--x,red)]) classifies
// "raw" instead, so no-raw-css-color owns it and this rule never double-reports.
// The message points at the utility class for the token, not a CSS variable.
export function checkToken(rawTok, parts, ctx) {
  const { tokens, ansi } = ctx;
  if (classifyColorPart(parts.colorPart, tokens) !== "var") return null;
  const utility = ansi.blue(`${parts.colorPrefix}-<token>`);
  return `${ansi.red(rawTok)} — CSS variable in a color class; use a ${utility} semantic utility class, not a var() reference`;
}
