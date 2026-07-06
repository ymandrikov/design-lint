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
// Tailwind's own `parseCandidate` is used only as a test oracle (ADR 0001).

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
// Bracket/paren-depth aware, so inner ":" and "/" of arbitrary values and var
// shorthand are never mistaken for a Tailwind variant separator or a Modifier.
//
// Contract (locked in PRD §Implementation Decisions):
//   1. Depth tracking counts [] and ().
//   2. Tailwind variants: split on every depth-0 ":", returned in source order.
//   3. Modifier: split on the last depth-0 "/"; null when absent.
//   4. Important marker "!" (leading or trailing) stripped silently from base.
//   5. Unbalanced brackets never throw — the remainder stays at depth > 0 and
//      a best-effort decomposition is returned.
export function splitColorToken(rawTok) {
  // Split on depth-0 ":" — every leading segment is a Tailwind variant, the
  // final segment carries the base and any Modifier.
  const segments = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < rawTok.length; i++) {
    const ch = rawTok[i];
    if (ch === "[" || ch === "(") depth++;
    else if (ch === "]" || ch === ")") depth--;
    else if (ch === ":" && depth === 0) {
      segments.push(rawTok.slice(start, i));
      start = i + 1;
    }
  }
  segments.push(rawTok.slice(start));

  const variants = segments.slice(0, -1);
  let rest = segments[segments.length - 1];

  // v4 important marker sits after the Modifier ("bg-primary/50!") — strip first.
  if (rest.endsWith("!")) rest = rest.slice(0, -1);

  // Modifier: the last depth-0 "/" in the remaining segment.
  let modifier = null;
  let mdepth = 0;
  let slash = -1;
  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];
    if (ch === "[" || ch === "(") mdepth++;
    else if (ch === "]" || ch === ")") mdepth--;
    else if (ch === "/" && mdepth === 0) slash = i;
  }
  let base = rest;
  if (slash !== -1) {
    base = rest.slice(0, slash);
    modifier = rest.slice(slash + 1);
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

// composeColorParts(rawTok, colorPrefixes) → { variants, base, modifier, colorPrefix, colorPart }
//
// The single per-token decomposition the pipeline hands to every token rule, so
// splitting and color-prefix lookup happen exactly once per candidate. Rules
// read these glossary-aligned parts instead of re-deriving them.
//   - variants / base / modifier : straight from splitColorToken.
//   - colorPrefix : longest-match color prefix on the base, or null.
//   - colorPart   : the base with its color prefix removed (the empty string for
//                   a bare "bg-" template fragment), or null when there is no
//                   color prefix.
export function composeColorParts(rawTok, colorPrefixes) {
  const { variants, base, modifier } = splitColorToken(rawTok);
  const colorPrefix = findColorPrefix(base, colorPrefixes ?? []);
  const colorPart = colorPrefix === null ? null : base.slice(colorPrefix.length + 1);
  return { variants, base, modifier, colorPrefix, colorPart };
}
