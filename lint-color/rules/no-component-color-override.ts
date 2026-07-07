// Rule 11 — Color className override on UI components.
// Components discovered in `componentsDirectory` expose variant props for styling.
// Passing color classes via className bypasses the variant system — add a variant instead.

import {
  parseSource,
  walk,
  jsxName,
  classNameStaticsDeep,
  styleObjectProps,
  ignoredLines,
  offsetToLine,
} from "../ast.ts";
import { classifyColorPart, composeColorParts, type Tokens } from "../classify.ts";
import { findRawColor } from "./no-raw-css-color.ts";

export const id = 11;
export const name = "no-component-color-override";

interface Ansi {
  red(s: string): string;
  blue(s: string): string;
}

interface OverrideTokens extends Tokens {
  colorPrefixes?: string[];
  uiComponents?: Set<string>;
}

interface Ctx {
  report: (line: number, message: string) => void;
  tokens: OverrideTokens;
  ansi: Ansi;
}

// The color test delegates to classifyColorPart, so a spectral name without a
// numeric shade ("bg-red-foo") is not a color (finding #9). Template-literal
// fragments are the exception — see the inline cases below.
function isColorToken(tok: string, tokens: OverrideTokens): boolean {
  const parts = composeColorParts(tok, tokens.colorPrefixes);
  if (parts === null) return false; // not a Candidate — Tailwind discards it
  const { colorPrefix, colorPart } = parts;
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

export function lintSource(source: string, filePath: string, ctx: Ctx): void {
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
          const rawColor = findRawColor(valueNode.value);
          if (!rawColor) continue;
          const line = offsetToLine(ast.lineStarts, propNode.start);
          if (ignore.has(line)) continue;
          report(
            line,
            `${ansi.red(rawColor)} in style= overrides color on ${ansi.red(`<${tagName}>`)} — add a ${ansi.blue("variant")} instead`,
          );
        }
      }
    }
  });
}
