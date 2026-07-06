// Rule 11 — Color className override on UI components.
// Components discovered in `componentsDirectory` expose variant props for styling.
// Passing color classes via className bypasses the variant system — add a variant instead.

export const id = 11;
export const name = "no-component-color-override";

import {
  parseSource,
  walk,
  jsxName,
  classNameStaticsDeep,
  styleObjectProps,
  ignoredLines,
  offsetToLine,
} from "../ast.js";
import { classifyColorPart, composeColorParts } from "../classify.js";
import { RAW_COLOR_RE } from "./no-raw-css-color.js";

// Returns true when tok applies a known semantic or spectral color via any color prefix.
// text-sm / text-center / shadow-md → false (not a color token).
// The "is this a color?" test delegates to classifyColorPart, so a spectral name
// without a numeric shade ("bg-red-foo") is not treated as a color (finding #9).
//
// Template-literal fragments are the exception: the color prefix alone is
// evidence a color is being applied, so an empty color part ("bg-" from
// `bg-${color}`) or a spectral-prefixed trailing dash ("bg-red-" from
// `bg-red-${shade}`) still counts.
function isColorToken(tok, tokens) {
  const { colorPrefix, colorPart } = composeColorParts(tok, tokens.colorPrefixes);
  if (!colorPrefix) return false;

  if (!colorPart) return true; // "bg-" fragment from a template literal
  if (classifyColorPart(colorPart, tokens) !== null) return true;

  // "bg-red-" fragment: the shade was interpolated away. Treat as a color when
  // the remaining segment is a spectral color name (a dynamic spectral shade).
  if (colorPart.endsWith("-")) {
    return tokens.spectralSet?.has(colorPart.slice(0, -1)) ?? false;
  }
  return false;
}

// lintSource(source, filePath, ctx)
// ctx.report(lineNum, message) called for each violation.
// ctx.tokens.uiComponents: Set<string> of component names from colors.json.
export function lintSource(source, filePath, ctx) {
  const { report, tokens, ansi } = ctx;
  const { uiComponents } = tokens;
  if (!uiComponents || uiComponents.size === 0) return;

  const ast = parseSource(source, filePath);
  const ignore = ignoredLines(ast);

  walk(ast.program, (node) => {
    if (node.type !== "JSXOpeningElement") return;
    const tagName = jsxName(node.name);
    if (!uiComponents.has(tagName)) return;

    for (const attr of node.attributes) {
      if (attr.type !== "JSXAttribute") continue;
      const name = jsxName(attr.name);

      if (name === "className" || name === "class") {
        // Deep view: string args inside cn()/clsx() count too.
        for (const { text, node: strNode } of classNameStaticsDeep(attr.value)) {
          const line = offsetToLine(ast.lineStarts, strNode.start);
          if (ignore.has(line)) continue;
          for (const tok of text.split(/\s+/)) {
            if (tok && isColorToken(tok, tokens)) {
              report(
                line,
                `${ansi.red(tok)} overrides color on ${ansi.red(`<${tagName}>`)} — add a ${ansi.blue("variant")} instead`,
              );
            }
          }
        }
      } else if (name === "style") {
        for (const { valueNode, node: propNode } of styleObjectProps(attr.value)) {
          if (!valueNode || valueNode.type !== "Literal" || typeof valueNode.value !== "string") continue;
          const match = valueNode.value.match(RAW_COLOR_RE);
          if (!match) continue;
          const line = offsetToLine(ast.lineStarts, propNode.start);
          if (ignore.has(line)) continue;
          report(
            line,
            `${ansi.red(match[0])} in style= overrides color on ${ansi.red(`<${tagName}>`)} — add a ${ansi.blue("variant")} instead`,
          );
        }
      }
    }
  });
}
