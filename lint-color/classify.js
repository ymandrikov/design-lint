// Classification layer — the single vocabulary-aligned utility between raw
// Tailwind candidate strings and the color rules.
//
// Owns:
//   - splitColorToken(rawTok)          decompose a candidate into Tailwind
//                                      variants, base, and Modifier.
//   - classifyColorPart(colorPart, …)  semantic | spectral | arbitrary | null.
//   - findColorPrefix(base, …)         longest-match color prefix lookup.
//   - the spectral-color and color-prefix constant sets.
//
// Pure, synchronous, no dependency on the loaded Tailwind design system.
// Tailwind's own `parseCandidate` is used only as a test oracle (ADR 0001);
// splitting is done with the vendored `segment` primitive (ADR 0002).

import { segment } from "./vendor/segment.js";
import { isValidArbitrary } from "./vendor/is-valid-arbitrary.js";

// All Tailwind v3/v4 built-in palette color names (the ones with numeric scale shades).
export const TAILWIND_SPECTRAL_COLORS = new Set([
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
  "slate", "gray", "zinc", "neutral", "stone",
]);

// Tailwind built-in keyword colors that carry a color value WITHOUT a numeric
// shade (bg-black, text-white, border-transparent, ring-current). Non-semantic,
// so forbidden like spectral colors — but classified separately because the
// shade-scan in classifyColorPart can't see them.
export const TAILWIND_STATIC_COLORS = new Set([
  "black", "white", "transparent", "current", "inherit",
]);

// Tailwind utility prefixes that carry a color value.
export const TAILWIND_COLOR_PREFIXES = [
  "bg", "text", "border", "ring-offset", "ring", "fill", "stroke",
  "from", "to", "via", "divide", "placeholder",
  "caret", "accent", "outline", "decoration", "shadow",
];

// splitColorToken(rawTok) → { variants: string[], base: string, modifier: string | null }
//
// Built on Tailwind's own vendored `segment` primitive (ADR 0002), so inner ":"
// and "/" of arbitrary values, var shorthand, quoted strings, backslash escapes,
// and "{}" groups are never mistaken for a Tailwind variant separator or a
// Modifier — separator scanning matches Tailwind's own segment(). Acceptance
// still differs: we best-effort-decompose strings parseCandidate rejects (see
// oracleParses in edge-tokens.ts; rejection is a later slice).
//
// Contract:
//   1. Tailwind variants: split on every top-level ":", returned in source order.
//   2. Modifier: split on the last top-level "/"; null when absent.
//   3. Important marker "!" (leading or trailing) stripped silently from base.
//   4. Unbalanced input never throws — a best-effort decomposition is returned.
export function splitColorToken(rawTok) {
  // Top-level ":" — every leading segment is a Tailwind variant, the final
  // segment carries the base and any Modifier.
  const segments = segment(rawTok, ":");

  const variants = segments.slice(0, -1);
  let rest = segments[segments.length - 1];

  // v4 important marker sits after the Modifier ("bg-primary/50!") — strip first.
  if (rest.endsWith("!")) rest = rest.slice(0, -1);

  // Modifier: the last top-level "/" in the remaining segment.
  const slashParts = segment(rest, "/");
  let base = rest;
  let modifier = null;
  if (slashParts.length > 1) {
    modifier = slashParts[slashParts.length - 1];
    base = slashParts.slice(0, -1).join("/");
  }

  // v3 important marker prefixes the base ("!bg-primary"); tolerate a stray
  // trailing "!" left when there was no Modifier ("bg-primary!").
  if (base.startsWith("!")) base = base.slice(1);
  if (base.endsWith("!")) base = base.slice(0, -1);

  return { variants, base, modifier };
}

// classifyColorPart(colorPart, tokens) → "semantic" | "spectral" | "static" | "arbitrary" | null
//
// colorPart is the base with its color prefix removed (e.g. "primary",
// "red-500", "x-red-500", "black", "[color:red]").
//   - semantic  : an exact semantic-token name.
//   - spectral  : a Tailwind palette color with a NUMERIC shade segment. The
//                 segment scan handles compound bases like "x-red-500"
//                 (from "divide-x-red-500") and "blue-200" alike.
//   - static    : a Tailwind keyword color with no shade (black, white,
//                 transparent, current, inherit).
//   - arbitrary : an arbitrary value ("[…]") or var shorthand ("(…)").
//   - null      : not a color (no shade, e.g. "red-foo" / "sm", or empty).
export function classifyColorPart(colorPart, tokens) {
  if (!colorPart) return null;
  if (tokens.semanticSet?.has(colorPart)) return "semantic";
  if (TAILWIND_STATIC_COLORS.has(colorPart)) return "static";

  // Arbitrary values / var shorthand are opaque — check them before the segment
  // scan, else a bracketed interior that happens to contain a "<spectral>-<digits>"
  // run (e.g. "(--red-500-rgb)") would be misread as spectral.
  if (colorPart.includes("[") || colorPart.includes("(")) return "arbitrary";

  const segs = colorPart.split("-");
  for (let i = 0; i < segs.length - 1; i++) {
    if (tokens.spectralSet?.has(segs[i]) && /^\d+$/.test(segs[i + 1])) {
      return "spectral";
    }
  }

  return null;
}

// findColorPrefix(base, colorPrefixes) → prefix string | null
//
// Longest match wins regardless of array order, so "ring-offset" beats "ring"
// for "ring-offset-2" and "divide-x" is not shadowed by "divide".
export function findColorPrefix(base, colorPrefixes) {
  let best = null;
  for (const p of colorPrefixes) {
    if (base.startsWith(p + "-") && (best === null || p.length > best.length)) {
      best = p;
    }
  }
  return best;
}

// isDiscardedCandidate(variants, base, modifier) → boolean
//
// True when the string is NOT a Candidate — Tailwind's parser would discard it
// at the syntax level, so it applies no color and every color rule must skip it
// (glossary: a discarded class is not a Candidate). Registry-free: root/utility
// existence is never checked, so "bogus-[#123]" is still a Candidate.
//
// Mirrors the syntactic reject points of Tailwind's parseCandidate:
//   - a Tailwind variant that isn't a well-formed arbitrary segment
//     (unbalanced closers, top-level ";", "{}" — "{a:b}", "]");
//   - more than one top-level Modifier ("/") — "bg-red-500/50/50";
//   - a Modifier that is empty or a malformed arbitrary/var value
//     ("bg-primary/", "…/[]", "…/()");
//   - an arbitrary value / var shorthand in the base that is unclosed, empty,
//     or fails isValidArbitrary ("text-[color:red", "bg-[red;]", "bg-[a{b}]").
function isDiscardedCandidate(variants, base, modifier) {
  for (const v of variants) {
    if (!isValidArbitrary(v)) return true;
  }
  // A top-level "/" left in the base means a second Modifier survived the split.
  if (segment(base, "/").length > 1) return true;
  if (modifier !== null && !isValidModifier(modifier)) return true;
  if (isArbitraryDiscarded(base)) return true;
  return false;
}

// isValidModifier(mod) → boolean. The Modifier segment after the top-level "/".
// Bracketed / paren Modifiers must be non-empty and syntactically valid; a named
// Modifier need only be non-empty (the trailing-slash typo "bg-primary/" yields
// the empty string here). Full IS_VALID_NAMED_VALUE matching is out of scope.
function isValidModifier(mod) {
  if (mod[0] === "[" && mod[mod.length - 1] === "]") {
    const inner = mod.slice(1, -1);
    return inner.trim().length > 0 && isValidArbitrary(inner);
  }
  if (mod[0] === "(" && mod[mod.length - 1] === ")") {
    const inner = mod.slice(1, -1);
    return inner.trim().length > 0 && isValidArbitrary(inner);
  }
  return mod.length > 0;
}

// isArbitraryDiscarded(base) → boolean. True when the base carries arbitrary
// syntax ("[…]" property/value or "(…)" var shorthand) that Tailwind rejects:
// an unclosed group, an empty group, or interior content that fails
// isValidArbitrary. Plain bases (no brackets/parens) are never discarded here.
function isArbitraryDiscarded(base) {
  const b = base.indexOf("[");
  const p = base.indexOf("(");
  if (b === -1 && p === -1) return false;
  const open = b === -1 ? p : p === -1 ? b : Math.min(b, p);
  const closeCh = base[open] === "[" ? "]" : ")";
  // Must close with the matching bracket as the final character.
  if (base[base.length - 1] !== closeCh) return true;
  const inner = base.slice(open + 1, -1);
  if (inner.trim().length === 0) return true;
  if (!isValidArbitrary(inner)) return true;
  return false;
}

// composeColorParts(rawTok, colorPrefixes) → { variants, base, modifier, colorPrefix, colorPart } | null
//
// The single per-token decomposition the pipeline hands to every token rule, so
// splitting and color-prefix lookup happen exactly once per candidate. Rules
// read these glossary-aligned parts instead of re-deriving them.
//
// Returns null when rawTok is not a Candidate — Tailwind's parser would discard
// it at the syntax level (see isDiscardedCandidate). Every rule skips a null
// decomposition with a single check, so dead classes produce no violations.
//   - variants / base / modifier : straight from splitColorToken.
//   - colorPrefix : longest-match color prefix on the base, or null.
//   - colorPart   : the base with its color prefix removed (the empty string for
//                   a bare "bg-" template fragment), or null when there is no
//                   color prefix.
export function composeColorParts(rawTok, colorPrefixes) {
  const { variants, base, modifier } = splitColorToken(rawTok);
  if (isDiscardedCandidate(variants, base, modifier)) return null;
  const colorPrefix = findColorPrefix(base, colorPrefixes ?? []);
  const colorPart = colorPrefix === null ? null : base.slice(colorPrefix.length + 1);
  return { variants, base, modifier, colorPrefix, colorPart };
}
