// Classification layer — the single vocabulary-aligned utility between raw
// Tailwind candidate strings and the color rules.
//
// Owns:
//   - splitColorToken(rawTok)          decompose a candidate into Tailwind
//                                      variants, base, and Modifier.
//   - classifyColorPart(colorPart, …)  semantic | spectral | static | raw | var | null.
//   - findColorPrefix(base, …)         longest-match color prefix lookup.
//   - the spectral-color and color-prefix constant sets.
//
// Pure, synchronous, no dependency on the loaded Tailwind design system.
// Tailwind's own `parseCandidate` is used only as a test oracle (ADR 0001);
// splitting is done with the vendored `segment` primitive (ADR 0002).

import { segment } from "./vendor/segment.js";
import { isValidArbitrary } from "./vendor/is-valid-arbitrary.js";
import { decodeArbitraryValue } from "./vendor/decode-arbitrary-value.js";
import { isColor } from "./vendor/is-color.js";

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

// CSS properties that carry a color value, for whole-base arbitrary-property
// candidates ("[color:red]", "[background-color:#123]"). Seeded from the
// properties no-style-color forbids inline (`color`, `backgroundColor`) in their
// CSS kebab spelling. Custom properties (`--*`) are always in the set: a custom
// property can hold a color, and a token must have exactly one sanctioned
// spelling — the utility class — so its variable form is a violation too.
export const CSS_COLOR_PROPERTIES = new Set(["color", "background-color"]);

// isColorProperty(property) → boolean. A CSS declaration property that can carry
// color for the purposes of arbitrary-property candidates.
function isColorProperty(property) {
  return property.startsWith("--") || CSS_COLOR_PROPERTIES.has(property.toLowerCase());
}

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

// classifyColorPart(colorPart, tokens) → "semantic" | "spectral" | "static" | "raw" | "var" | null
//
// colorPart is the base with its color prefix removed (e.g. "primary",
// "red-500", "x-red-500", "black", "[color:red]", "(--my-color)").
//   - semantic  : an exact semantic-token name.
//   - spectral  : a Tailwind palette color with a NUMERIC shade segment. The
//                 segment scan handles compound bases like "x-red-500"
//                 (from "divide-x-red-500") and "blue-200" alike.
//   - static    : a Tailwind keyword color with no shade (black, white,
//                 transparent, current, inherit).
//   - raw       : an arbitrary value that is a literal color — hex, color
//                 function, CSS named color, `color:`-hinted content, or a var
//                 reference with a literal-color fallback (`var(--x,red)`).
//   - var       : a clean CSS-variable reference — `(--x)` shorthand,
//                 `(color:--x)`, or `[var(--x)]` with no literal fallback.
//   - null      : provably not a color — a non-color arbitrary value
//                 (`[url(…)]`), an explicit non-color typehint (`length:`,
//                 `image:`), no shade (e.g. "red-foo" / "sm"), or empty.
export function classifyColorPart(colorPart, tokens) {
  if (!colorPart) return null;
  if (tokens.semanticSet?.has(colorPart)) return "semantic";
  if (TAILWIND_STATIC_COLORS.has(colorPart)) return "static";

  // Arbitrary values / var shorthand are decoded and color-checked before the
  // segment scan, else a bracketed interior that happens to contain a
  // "<spectral>-<digits>" run (e.g. "(--red-500-rgb)") would be misread as
  // spectral. Order inside: decode underscores → dataType typehint → var-shape
  // → is-color (the one definition of "literal color").
  if (colorPart.includes("[") || colorPart.includes("(")) {
    return classifyArbitraryColor(colorPart);
  }

  const segs = colorPart.split("-");
  for (let i = 0; i < segs.length - 1; i++) {
    if (tokens.spectralSet?.has(segs[i]) && /^\d+$/.test(segs[i + 1])) {
      return "spectral";
    }
  }

  return null;
}

// classifyArbitraryColor(colorPart) → "raw" | "var" | null
//
// colorPart is a bracketed arbitrary value ("[…]") or a v4 var shorthand ("(…)").
// Mirrors the value-classification order Tailwind's parseCandidate uses for an
// arbitrary color utility: decode underscores, peel an explicit dataType
// typehint, recognize a CSS-variable reference, then fall back to is-color.
function classifyArbitraryColor(colorPart) {
  const last = colorPart[colorPart.length - 1];

  // v4 var shorthand: `(--x)` or `(color:--x)`. Tailwind expands it to
  // `var(<value>)` and requires the value to start with `--`, so it is a
  // CSS-variable reference — `var` unless it smuggles a literal-color fallback
  // (`(--x,red)` → `var(--x,red)`), which is raw like the bracketed form.
  if (colorPart[0] === "(" && last === ")") {
    const inner = colorPart.slice(1, -1);
    const parts = segment(inner, ":");
    const typehint = parts.length === 2 ? parts[0] : null;
    const value = parts.length === 2 ? parts[1] : inner;
    // An explicit non-color typehint (`(length:--x)` → a length CSS-var utility)
    // is not a color — same rule as the bracketed branch below.
    if (typehint !== null && typehint !== "color") return null;
    if (!value.startsWith("--")) return null;
    return classifyVarReference(`var(${value})`);
  }

  if (colorPart[0] !== "[" || last !== "]") return null;

  const decoded = decodeArbitraryValue(colorPart.slice(1, -1));
  const { typehint, value } = extractTypehint(decoded);

  // An explicit non-color dataType (`length:`, `image:`, `url:`, …) is provably
  // not a color; only `color:` keeps the value in color context.
  if (typehint !== null && typehint !== "color") return null;

  // A CSS-variable reference: `var` unless it smuggles a literal-color fallback.
  const varVerdict = classifyVarReference(value);
  if (varVerdict !== null) return varVerdict;

  return isColor(value) ? "raw" : null;
}

// extractTypehint(value) → { typehint: string | null, value: string }
//
// A leading run of `[a-z-]` characters followed by a top-level ":" is Tailwind's
// arbitrary-value dataType typehint (`color:red`, `length:200px`). Mirrors the
// scan in Tailwind's candidate.ts. No typehint ⇒ { typehint: null, value }.
function extractTypehint(value) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 0x3a /* ":" */) {
      return { typehint: value.slice(0, i), value: value.slice(i + 1) };
    }
    // a-z or "-" — still inside a possible typehint.
    if (code === 0x2d || (code >= 0x61 && code <= 0x7a)) continue;
    break;
  }
  return { typehint: null, value };
}

// classifyVarReference(value) → "var" | "raw" | null
//
// value is a decoded arbitrary interior. A `var(--x)` reference classifies `var`
// unless it carries a literal-color fallback (`var(--x, red)`), which is a raw
// color smuggled through a variable reference. A fallback that is itself a var
// reference is followed recursively, so a color nested any depth deep
// (`var(--x, var(--y, red))`) is still caught. Anything that is not a var
// reference returns null (the caller falls back to is-color).
function classifyVarReference(value) {
  if (!/^var\(/i.test(value) || value[value.length - 1] !== ")") return null;
  const inner = value.slice(4, -1);
  const args = segment(inner, ",");
  if (args.length >= 2) {
    const fallback = args.slice(1).join(",").trim();
    if (isColor(fallback) || classifyVarReference(fallback) === "raw") return "raw";
  }
  return "var";
}

// parseArbitraryProperty(base) → { property, value } | null
//
// A Tailwind arbitrary-property candidate is a base whose whole form is a bracket
// group — "[color:red]", "[--my-color:red]" — with no utility prefix. Mirrors
// parseCandidate's arbitrary-property branch: the base must be bracket-wrapped,
// the property must start with a-z or "-" (so "[Color:red]", "[0color:red]" are
// rejected), a first ":" separates property from value, and the value is
// non-empty. Returns null when base is not an arbitrary property OR is a
// malformed one — the caller treats a malformed shape as a discarded candidate.
//
// The value is returned undecoded (underscores intact); classifyColorValue
// decodes it, matching how the value is stored on a Candidate.
export function parseArbitraryProperty(base) {
  if (base.length < 2 || base[0] !== "[" || base[base.length - 1] !== "]") return null;
  const c = base.charCodeAt(1);
  // Property name must start with a-z or "-" (custom properties lead with "--").
  if (c !== 0x2d && !(c >= 0x61 && c <= 0x7a)) return null;
  const colon = base.indexOf(":");
  if (colon === -1) return null;
  const property = base.slice(1, colon);
  const value = base.slice(colon + 1, -1);
  if (value.length === 0) return null;
  return { property, value };
}

// classifyColorValue(rawValue) → "raw" | "var" | null
//
// The value side of an arbitrary-property candidate ("[prop:value]" → value),
// undecoded. Classified in the same order as an arbitrary utility value
// (classifyArbitraryColor): decode underscores → peel a dataType typehint →
// var-shape → is-color. Unlike a utility value there is no paren shorthand — an
// arbitrary property spells a variable reference as `var(--x)`, never `(--x)`.
function classifyColorValue(rawValue) {
  const decoded = decodeArbitraryValue(rawValue);
  const { typehint, value } = extractTypehint(decoded);
  if (typehint !== null && typehint !== "color") return null;
  const varVerdict = classifyVarReference(value);
  if (varVerdict !== null) return varVerdict;
  return isColor(value) ? "raw" : null;
}

// classifyParts(parts, tokens) → "semantic" | "spectral" | "static" | "raw" | "var" | null
//
// The color verdict for a decomposed Candidate, routing both spellings color can
// take to one classifier so a rule reads a single verdict: a prefixed utility
// ("bg-[red]", "text-primary") via its colorPart, and an arbitrary-property
// candidate ("[color:red]") via its property + value. A non-color arbitrary
// property ("[margin:4px]") is provably not a color and returns null, so only the
// raw/var rules ever see a property value.
export function classifyParts(parts, tokens) {
  if (parts.arbitraryProperty !== null) {
    if (!isColorProperty(parts.arbitraryProperty)) return null;
    return classifyColorValue(parts.arbitraryValue);
  }
  return classifyColorPart(parts.colorPart, tokens);
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
  // A base whose whole form is a bracket group is an arbitrary-property
  // candidate; a malformed property name/value ("[Color:red]", "[foo]",
  // "[color:]") makes Tailwind discard it, so it is not a Candidate.
  if (base[0] === "[" && parseArbitraryProperty(base) === null) return true;
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
//   - arbitraryProperty / arbitraryValue : the property and (undecoded) value of
//                   a whole-base arbitrary-property candidate ("[color:red]"),
//                   both null otherwise. Set for every valid arbitrary property,
//                   color or not; classifyParts does the color gating. Mutually
//                   exclusive with colorPrefix — an arbitrary property has no
//                   utility prefix.
export function composeColorParts(rawTok, colorPrefixes) {
  const { variants, base, modifier } = splitColorToken(rawTok);
  if (isDiscardedCandidate(variants, base, modifier)) return null;
  const colorPrefix = findColorPrefix(base, colorPrefixes ?? []);
  const colorPart = colorPrefix === null ? null : base.slice(colorPrefix.length + 1);
  const arbitrary = colorPrefix === null ? parseArbitraryProperty(base) : null;
  const arbitraryProperty = arbitrary === null ? null : arbitrary.property;
  const arbitraryValue = arbitrary === null ? null : arbitrary.value;
  return { variants, base, modifier, colorPrefix, colorPart, arbitraryProperty, arbitraryValue };
}
