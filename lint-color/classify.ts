import { segment } from "./vendor/segment.js";
import { isValidArbitrary } from "./vendor/is-valid-arbitrary.js";
import { decodeArbitraryValue } from "./vendor/decode-arbitrary-value.js";
import { isColor } from "./vendor/is-color.js";

// Verdicts:
//   "semantic" — design-token name ("primary")
//   "spectral" — palette color + shade ("red-500")
//   "static"   — keyword color ("black", "transparent")
//   "raw"      — literal color ("[#fff]", "[var(--x,red)]")
//   "var"      — clean CSS-var reference ("(--x)", "[var(--x)]")
//   null       — not a color ("[url(…)]", "red-foo")
export type ColorVerdict = "semantic" | "spectral" | "static" | "raw" | "var" | null;

export type Tokens = { semanticSet?: Set<string>; spectralSet?: Set<string> };

export type SplitToken = { variants: string[]; base: string; modifier: string | null };

export type SpectralMatch = { name: string; shade: string };

// A parsed whole-base "[property:value]".
export type ArbitraryProperty = { property: string; value: string };

// The full composition of a candidate — a SplitToken plus the color-prefix split.
export type ColorParts = {
  variants: string[];
  base: string;
  modifier: string | null;
  colorPrefix: string | null;
  colorPart: string | null;
  arbitraryProperty: string | null;
  arbitraryValue: string | null;
};

export const TAILWIND_SPECTRAL_COLORS = new Set<string>([
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
  "slate", "gray", "zinc", "neutral", "stone",
]);

export const TAILWIND_STATIC_COLORS = new Set<string>([
  "black", "white", "transparent", "current", "inherit",
]);

export const CSS_COLOR_PROPERTIES = new Set<string>(["color", "background-color"]);

function isColorProperty(property: string): boolean {
  return property.startsWith("--") || CSS_COLOR_PROPERTIES.has(property.toLowerCase());
}

export const TAILWIND_COLOR_PREFIXES: string[] = [
  "bg", "text", "border", "ring-offset", "ring", "fill", "stroke",
  "from", "to", "via", "divide", "placeholder",
  "caret", "accent", "outline", "decoration", "shadow",
];

const SHADE_RE = /^\d+$/;
const VAR_REF_RE = /^var\(/i;

// Tailwind important markers: v3 leads with "!" ("!bg-primary"), v4 trails ("bg-primary/50!").
const isTwV3Important = (s: string): boolean => s.startsWith("!");
const isTwV4Important = (s: string): boolean => s.endsWith("!");

// A bracketed arbitrary value ("[…]") or v4 var shorthand ("(…)").
const isArbitraryOrVarShorthand = (s: string): boolean => s[0] === "[" || s[0] === "(";

// e.g. (length:--x), (image:--x)
const isNonColorTypehint = (typehint: string | null): boolean =>
  typehint !== null && typehint !== "color";

// A leftover top-level "/" means a second Modifier survived the split ("bg-red/50/50").
const hasSecondModifier = (base: string): boolean => segment(base, "/").length > 1;

// Looks like an arbitrary property ("[…]") but parseArbitraryProperty rejected it → discard.
const isMalformedArbitraryProperty = (base: string, arbitrary: ArbitraryProperty | null): boolean =>
  base[0] === "[" && arbitrary === null;

export function splitColorToken(rawTok: string): SplitToken {
  const segments = segment(rawTok, ":");

  const variants = segments.slice(0, -1);
  let rest = segments[segments.length - 1];

  if (isTwV4Important(rest)) rest = rest.slice(0, -1);

  const slashParts = segment(rest, "/");
  let base = rest;
  let modifier: string | null = null;
  if (slashParts.length > 1) {
    modifier = slashParts[slashParts.length - 1];
    base = slashParts.slice(0, -1).join("/");
  }

  if (isTwV3Important(base)) base = base.slice(1);
  if (isTwV4Important(base)) base = base.slice(0, -1);

  return { variants, base, modifier };
}

/**
 * Locate a palette name immediately followed by a numeric shade inside a color part.
 * Single source of the spectral scan: consumed by classifyColorPart (for the
 * "spectral" verdict) and by no-spectral-color (for the replacement-hint name+shade).
 * @param colorPart  base with color prefix removed ("red-500", "x-red-500")
 * @returns first match, left to right; null if none
 */
export function findSpectralMatch(colorPart: string, spectralSet?: Set<string>): SpectralMatch | null {
  if (!colorPart || !spectralSet) return null;
  const segs = colorPart.split("-");
  for (let i = 0; i < segs.length - 1; i++) {
    if (spectralSet.has(segs[i]) && SHADE_RE.test(segs[i + 1])) {
      return { name: segs[i], shade: segs[i + 1] };
    }
  }
  return null;
}

/**
 * @param colorPart  base with color prefix removed ("primary", "red-500", "[color:red]")
 */
export function classifyColorPart(colorPart: string | null, tokens: Tokens): ColorVerdict {
  if (!colorPart) return null;
  if (tokens.semanticSet?.has(colorPart)) return "semantic";
  if (TAILWIND_STATIC_COLORS.has(colorPart)) return "static";

  // Before the segment scan, else "(--red-500-rgb)" misreads as spectral.
  if (isArbitraryOrVarShorthand(colorPart)) {
    return classifyArbitraryColor(colorPart);
  }

  if (findSpectralMatch(colorPart, tokens.spectralSet)) return "spectral";

  return null;
}

function classifyArbitraryColor(colorPart: string): ColorVerdict {
  const last = colorPart[colorPart.length - 1];
  if (colorPart[0] === "(" && last === ")") return classifyVarShorthand(colorPart);
  if (colorPart[0] !== "[" || last !== "]") return null;
  return classifyColorValue(colorPart.slice(1, -1));
}

// v4 var shorthand, e.g. (--x), (color:--x) → var(--x). "raw" if it carries a
// literal-color fallback (--x,red), else "var".
function classifyVarShorthand(colorPart: string): ColorVerdict {
  const inner = colorPart.slice(1, -1);
  const parts = segment(inner, ":");
  const typehint = parts.length === 2 ? parts[0] : null;
  const value = parts.length === 2 ? parts[1] : inner;
  if (isNonColorTypehint(typehint)) return null;
  if (!value.startsWith("--")) return null;
  return classifyVarReference(`var(${value})`);
}

/**
 * Peel a leading dataType typehint ("color:red", "length:200px").
 */
function extractTypehint(value: string): { typehint: string | null; value: string } {
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === ":") return { typehint: value.slice(0, i), value: value.slice(i + 1) };
    if (ch === "-" || (ch >= "a" && ch <= "z")) continue;
    break;
  }
  return { typehint: null, value };
}

/**
 * Fallbacks recurse, so a color nested any depth is caught (var(--x, var(--y, red))).
 * @param value  decoded arbitrary interior
 * @returns "raw" if a literal-color fallback, null if not a var ref
 */
function classifyVarReference(value: string): "var" | "raw" | null {
  if (!VAR_REF_RE.test(value) || value[value.length - 1] !== ")") return null;
  const inner = value.slice(4, -1);
  const args = segment(inner, ",");
  if (args.length >= 2) {
    const fallback = args.slice(1).join(",").trim();
    if (isColor(fallback) || classifyVarReference(fallback) === "raw") return "raw";
  }
  return "var";
}

/**
 * Parse a whole-base arbitrary property ("[color:red]", "[--x:red]"). Value
 * returned undecoded (classifyColorValue decodes). null if not one / malformed.
 */
export function parseArbitraryProperty(base: string): ArbitraryProperty | null {
  if (base.length < 2 || base[0] !== "[" || base[base.length - 1] !== "]") return null;
  const c = base[1]; // property starts a-z or "-" (custom props lead "--")
  if (c !== "-" && !(c >= "a" && c <= "z")) return null;
  const colon = base.indexOf(":");
  if (colon === -1) return null;
  const property = base.slice(1, colon);
  const value = base.slice(colon + 1, -1);
  if (value.length === 0) return null;
  return { property, value };
}

/**
 * @param rawValue  undecoded value side of an arbitrary property ("[prop:value]")
 */
function classifyColorValue(rawValue: string): "raw" | "var" | null {
  const decoded = decodeArbitraryValue(rawValue);
  const { typehint, value } = extractTypehint(decoded);
  if (isNonColorTypehint(typehint)) return null;
  const varVerdict = classifyVarReference(value);
  if (varVerdict !== null) return varVerdict;
  return isColor(value) ? "raw" : null;
}

export function classifyParts(
  parts: { colorPart: string | null; arbitraryProperty: string | null; arbitraryValue: string | null },
  tokens: Tokens,
): ColorVerdict {
  if (parts.arbitraryProperty !== null) {
    if (!isColorProperty(parts.arbitraryProperty)) return null;
    return classifyColorValue(parts.arbitraryValue ?? "");
  }
  return classifyColorPart(parts.colorPart, tokens);
}

/**
 * Longest match wins.
 */
export function findColorPrefix(base: string, colorPrefixes: string[]): string | null {
  let best: string | null = null;
  for (const p of colorPrefixes) {
    if (base.startsWith(p + "-") && (best === null || p.length > best.length)) {
      best = p;
    }
  }
  return best;
}

function isDiscardedCandidate(
  variants: string[],
  base: string,
  modifier: string | null,
  arbitrary: ArbitraryProperty | null,
): boolean {
  for (const v of variants) {
    if (!isValidArbitrary(v)) return true;
  }
  if (hasSecondModifier(base)) return true;
  if (modifier !== null && !isValidModifier(modifier)) return true;
  if (isArbitraryDiscarded(base)) return true;
  if (isMalformedArbitraryProperty(base, arbitrary)) return true;
  return false;
}

function isValidModifier(mod: string): boolean {
  const first = mod[0];
  const last = mod[mod.length - 1];
  if ((first === "[" && last === "]") || (first === "(" && last === ")")) {
    return isValidArbitraryGroup(mod.slice(1, -1));
  }
  return mod.length > 0;
}

function isValidArbitraryGroup(inner: string): boolean {
  return inner.trim().length > 0 && isValidArbitrary(inner);
}

function isArbitraryDiscarded(base: string): boolean {
  const b = base.indexOf("[");
  const p = base.indexOf("(");
  if (b === -1 && p === -1) return false;
  const open = b === -1 ? p : p === -1 ? b : Math.min(b, p);
  const closeCh = base[open] === "[" ? "]" : ")";
  // The arbitrary group must close at the very last char, else it is
  // unterminated or has trailing junk ("bg-[#fff", "bg-[#fff]x").
  if (base[base.length - 1] !== closeCh) return true;
  return !isValidArbitraryGroup(base.slice(open + 1, -1));
}

export function composeColorParts(rawTok: string, colorPrefixes?: string[]): ColorParts | null {
  const { variants, base, modifier } = splitColorToken(rawTok);
  // Parse the arbitrary-property shape once — it always leads with "[" and never
  // has a utility prefix, so both the discard check and returned parts share it.
  const arbitrary = base[0] === "[" ? parseArbitraryProperty(base) : null;
  if (isDiscardedCandidate(variants, base, modifier, arbitrary)) return null;
  const colorPrefix = findColorPrefix(base, colorPrefixes ?? []);
  const colorPart = colorPrefix === null ? null : base.slice(colorPrefix.length + 1);
  const arbitraryProperty = arbitrary === null ? null : arbitrary.property;
  const arbitraryValue = arbitrary === null ? null : arbitrary.value;
  return { variants, base, modifier, colorPrefix, colorPart, arbitraryProperty, arbitraryValue };
}
