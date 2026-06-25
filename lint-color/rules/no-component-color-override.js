// Rule 11 — Color className override on UI components.
// Components discovered in `componentsDirectory` expose variant props for styling.
// Passing color classes via className bypasses the variant system — add a variant instead.

export const id = 11;
export const name = "no-component-color-override";

import {
  buildLineStarts,
  extractJsxOpeningTags,
  normalizeTwToken,
  offsetToLine,
} from "../shared.js";
import { RAW_COLOR_RE } from "./no-raw-css-color.js";

// Returns true when tok applies a known semantic or spectral color via any color prefix.
// text-sm / text-center / shadow-md → false (not a color token).
// An empty colorPart (e.g. "bg-" from a template literal like `bg-${color}`) is flagged:
// the color prefix alone is sufficient evidence that a color is being applied.
function isColorToken(tok, tokens) {
  const { colorPrefixes, semanticSet, spectralSet } = tokens;
  const base = normalizeTwToken(tok).split("/")[0];
  const prefix = colorPrefixes.find((p) => base.startsWith(p + "-"));
  if (!prefix) return false;
  const colorPart = base.slice(prefix.length + 1);
  if (!colorPart) return true; // partial token from a template literal
  if (semanticSet.has(colorPart)) return true;
  // Spectral: "red-500" — color name is the first segment, numeric scale follows.
  const parts = colorPart.split("-");
  return spectralSet.has(parts[0]) && parts.length > 1;
}

// Returns the content between the matching braces starting at str[start] (must be '{').
// Correctly handles nested braces and strings so `}` inside strings doesn't end the scan early.
function scanBraceContent(str, start) {
  let depth = 1;
  let i = start + 1;
  let inStr = null;
  while (i < str.length && depth > 0) {
    const ch = str[i];
    if (inStr) {
      if (inStr !== "`" && ch === "\\") { i += 2; continue; }
      if (ch === inStr) inStr = null;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
    }
    i++;
  }
  return str.slice(start + 1, i - 1);
}

// Extract static className string values from a JSX opening-tag content string.
// Handles: className="..." className='...'
//          className={"..."} className={'...'}
//          className={fn("...", ...)} — string literal arguments are extracted individually.
// Skips template literals with expressions — too dynamic to analyze.
function extractClassNameEntries(tagContent) {
  const entries = [];
  const attrRe = /\bclassName\s*=\s*/g;
  let m;
  while ((m = attrRe.exec(tagContent)) !== null) {
    const pos = m.index + m[0].length;
    const ch = tagContent[pos];

    if (ch === '"' || ch === "'") {
      // Plain string: className="..." or className='...'
      const sm = /["']((?:[^"'\\]|\\.)*?)["']/.exec(tagContent.slice(pos));
      if (sm) entries.push({ classStr: sm[1], offset: m.index });
    } else if (ch === "{") {
      const expr = scanBraceContent(tagContent, pos);

      if (expr.startsWith("`")) {
        // Template literal: join the static segments between ${...} expressions.
        // e.g. `bg-${color}` → static parts ["bg-", ""] → classStr "bg-"
        // isColorToken treats an empty color-part (prefix + "-" only) as a match.
        const inner = expr.slice(1, expr.lastIndexOf("`"));
        const classStr = inner.split(/\$\{[^}]*\}/).join("").trim();
        if (classStr) entries.push({ classStr, offset: m.index });
      } else {
        // Function call or bare expression: extract every string literal argument.
        // This covers className={"..."}, className={fn("...", ...)}, etc.
        const strRe = /["']((?:[^"'\\]|\\.)*?)["']/g;
        let sm;
        while ((sm = strRe.exec(expr)) !== null) {
          entries.push({ classStr: sm[1], offset: m.index });
        }
      }
    }
  }
  return entries;
}

// Extract raw color string values from a style={...} attribute in a JSX opening tag.
// Returns [{ colorValue, offset }] for each string value matching RAW_COLOR_RE.
function extractStyleColorValues(tagContent) {
  const entries = [];
  const attrRe = /\bstyle\s*=\s*\{/g;
  let m;
  while ((m = attrRe.exec(tagContent)) !== null) {
    const bracePos = m.index + m[0].length - 1;
    const expr = scanBraceContent(tagContent, bracePos);
    const strRe = /["']((?:[^"'\\]|\\.)*?)["']/g;
    let sm;
    while ((sm = strRe.exec(expr)) !== null) {
      const val = sm[1];
      if (RAW_COLOR_RE.test(val)) {
        entries.push({ colorValue: val, offset: m.index });
      }
    }
  }
  return entries;
}

// lintSource(source, filePath, ctx)
// ctx.report(lineNum, message) called for each violation.
// ctx.tokens.uiComponents: Set<string> of component names from colors.json.
export function lintSource(source, filePath, ctx) {
  const { report, tokens, ansi } = ctx;
  const { uiComponents } = tokens;
  if (!uiComponents || uiComponents.size === 0) return;

  const lineStarts = buildLineStarts(source);

  for (const { tagName, content, startOffset } of extractJsxOpeningTags(source)) {
    if (!uiComponents.has(tagName)) continue;

    for (const { classStr, offset } of extractClassNameEntries(content)) {
      const lineNum = offsetToLine(lineStarts, startOffset + offset);
      const lineEnd = lineStarts[lineNum] ?? source.length;
      const lineText = source.slice(lineStarts[lineNum - 1], lineEnd);
      if (lineText.includes("color-lint-ignore")) continue;

      for (const tok of classStr.split(/\s+/)) {
        if (!tok) continue;
        if (isColorToken(tok, tokens)) {
          report(
            lineNum,
            `${ansi.red(tok)} overrides color on ${ansi.red(`<${tagName}>`)} — add a ${ansi.blue("variant")} instead`,
          );
        }
      }
    }

    for (const { colorValue, offset } of extractStyleColorValues(content)) {
      const lineNum = offsetToLine(lineStarts, startOffset + offset);
      const lineEnd = lineStarts[lineNum] ?? source.length;
      const lineText = source.slice(lineStarts[lineNum - 1], lineEnd);
      if (lineText.includes("color-lint-ignore")) continue;

      const match = colorValue.match(RAW_COLOR_RE);
      report(
        lineNum,
        `${ansi.red(match[0])} in style= overrides color on ${ansi.red(`<${tagName}>`)} — add a ${ansi.blue("variant")} instead`,
      );
    }
  }
}
