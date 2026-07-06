/*
 * Vendored from tailwindcss (MIT)
 * Source: packages/tailwindcss/src/utils/is-color.ts
 * Commit: 9b0e8af25861ad5b8f5af420ad3ee0b188665027 (v4.3.2)
 * Changes: converted to plain JS (type annotations dropped); no logic changes.
 * See ADR 0002 — vendor Tailwind parsing primitives.
 *
 * This is the single definition of "literal color" the linter uses everywhere:
 * a leading `#`, one of a fixed set of color-function roots, or a CSS named
 * color. It is intentionally loose (any `#`-prefixed token is a color) to match
 * Tailwind's own arbitrary-value handling — `bg-[#zz]` compiles to a color
 * declaration, so we flag it too.
 */

const HASH = 0x23;

const NAMED_COLORS = new Set([
  // CSS Level 1 colors
  "black", "silver", "gray", "white", "maroon", "red", "purple", "fuchsia",
  "green", "lime", "olive", "yellow", "navy", "blue", "teal", "aqua",

  // CSS Level 2/3 colors
  "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige", "bisque",
  "black", "blanchedalmond", "blue", "blueviolet", "brown", "burlywood",
  "cadetblue", "chartreuse", "chocolate", "coral", "cornflowerblue", "cornsilk",
  "crimson", "cyan", "darkblue", "darkcyan", "darkgoldenrod", "darkgray",
  "darkgreen", "darkgrey", "darkkhaki", "darkmagenta", "darkolivegreen",
  "darkorange", "darkorchid", "darkred", "darksalmon", "darkseagreen",
  "darkslateblue", "darkslategray", "darkslategrey", "darkturquoise",
  "darkviolet", "deeppink", "deepskyblue", "dimgray", "dimgrey", "dodgerblue",
  "firebrick", "floralwhite", "forestgreen", "fuchsia", "gainsboro",
  "ghostwhite", "gold", "goldenrod", "gray", "green", "greenyellow", "grey",
  "honeydew", "hotpink", "indianred", "indigo", "ivory", "khaki", "lavender",
  "lavenderblush", "lawngreen", "lemonchiffon", "lightblue", "lightcoral",
  "lightcyan", "lightgoldenrodyellow", "lightgray", "lightgreen", "lightgrey",
  "lightpink", "lightsalmon", "lightseagreen", "lightskyblue", "lightslategray",
  "lightslategrey", "lightsteelblue", "lightyellow", "lime", "limegreen",
  "linen", "magenta", "maroon", "mediumaquamarine", "mediumblue", "mediumorchid",
  "mediumpurple", "mediumseagreen", "mediumslateblue", "mediumspringgreen",
  "mediumturquoise", "mediumvioletred", "midnightblue", "mintcream", "mistyrose",
  "moccasin", "navajowhite", "navy", "oldlace", "olive", "olivedrab", "orange",
  "orangered", "orchid", "palegoldenrod", "palegreen", "paleturquoise",
  "palevioletred", "papayawhip", "peachpuff", "peru", "pink", "plum",
  "powderblue", "purple", "rebeccapurple", "red", "rosybrown", "royalblue",
  "saddlebrown", "salmon", "sandybrown", "seagreen", "seashell", "sienna",
  "silver", "skyblue", "slateblue", "slategray", "slategrey", "snow",
  "springgreen", "steelblue", "tan", "teal", "thistle", "tomato", "turquoise",
  "violet", "wheat", "white", "whitesmoke", "yellow", "yellowgreen",

  // Keywords
  "transparent", "currentcolor",

  // System colors
  "canvas", "canvastext", "linktext", "visitedtext", "activetext", "buttonface",
  "buttontext", "buttonborder", "field", "fieldtext", "highlight",
  "highlighttext", "selecteditem", "selecteditemtext", "mark", "marktext",
  "graytext", "accentcolor", "accentcolortext",
]);

const IS_COLOR_FN = /^(rgba?|hsla?|hwb|color|(ok)?(lab|lch)|light-dark|color-mix|--alpha)\(/i;

export function isColor(value) {
  return (
    value.charCodeAt(0) === HASH || IS_COLOR_FN.test(value) || NAMED_COLORS.has(value.toLowerCase())
  );
}

export function isNamedColor(value) {
  return NAMED_COLORS.has(value.toLowerCase());
}
