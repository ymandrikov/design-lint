// Rule 6 — No CSS-variable reference behind a color prefix.
// Use the token's semantic utility class (bg-primary), not a var() reference.

import { classifyParts } from "../classify.ts";

export const id = 6;
export const name = "no-var-color";

// checkToken(rawTok, parts, ctx) → message string or null.
// Fires on the classifier's "var" verdict — a clean CSS-variable reference
// behind a color prefix: the v4 shorthand (bg-(--x)), the bracketed form
// (bg-[var(--x)]), the color:-hinted form (text-[color:var(--x)]), and a
// var reference behind a color arbitrary property ([color:var(--x)]). A var
// reference carrying a literal-color fallback (bg-[var(--x,red)]) classifies
// "raw" instead, so no-raw-css-color owns it and this rule never double-reports.
// The message points at the utility class for the token, not a CSS variable.
export function checkToken(rawTok, parts, ctx) {
  const { tokens, ansi } = ctx;
  if (classifyParts(parts, tokens) !== "var") return null;
  // A prefixed utility names its prefix ("bg-<token>"); an arbitrary-property
  // candidate ("[color:var(--x)]") has no prefix, so point at the utility class
  // in general terms.
  const utility = parts.colorPrefix
    ? `a ${ansi.blue(`${parts.colorPrefix}-<token>`)} semantic utility class`
    : `a ${ansi.blue("semantic utility class")}`;
  return `${ansi.red(rawTok)} — CSS variable in a color class; use ${utility}, not a var() reference`;
}
