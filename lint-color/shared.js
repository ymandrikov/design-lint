// Shared utilities for lint-color rules.

import { readdirSync } from "node:fs";
import { extname, join } from "node:path";

import { composeColorParts } from "./classify.js";
import {
  parseSource,
  walk,
  jsxName,
  classNameStatics,
  ignoredLines,
  offsetToLine,
} from "./ast.js";

// Line utilities moved to the AST layer; re-exported for existing importers.
export { buildLineStarts, offsetToLine } from "./ast.js";

// The spectral-color and color-prefix constant sets now live in the
// classification module (classify.js), which owns the color vocabulary.
// Re-exported here so existing importers keep working.
export {
  TAILWIND_SPECTRAL_COLORS,
  TAILWIND_COLOR_PREFIXES,
} from "./classify.js";

export const isTTY = process.stdout.isTTY;
export const red = (s) => (isTTY ? `\x1b[31m${s}\x1b[0m` : s);
export const blue = (s) => (isTTY ? `\x1b[34m${s}\x1b[0m` : s);
export const dim = (s) => (isTTY ? `\x1b[2m${s}\x1b[0m` : s);
export const bold = (s) => (isTTY ? `\x1b[1m${s}\x1b[0m` : s);

export function buildDisabledRules(rules) {
  return new Set(
    Object.entries(rules)
      .filter(([, r]) => r.enabled === false)
      .map(([name]) => name),
  );
}

// Run a lintSource-based rule against an in-memory source string.
// Returns [] immediately if the rule name is in disabledRules.
export function lintSourceIfEnabled(disabledRules, ruleModule, source, filePath, tokens, ansi, ruleConfig = {}) {
  if (disabledRules.has(ruleModule.name)) return [];
  const found = [];
  ruleModule.lintSource(source, filePath, {
    report: (line, message) => found.push({ line, message }),
    tokens,
    ansi,
    ruleConfig,
  });
  return found;
}

// Run a checkToken-based rule against a single token's pre-split parts.
// Returns null immediately if the rule name is in disabledRules.
export function checkTokenIfEnabled(disabledRules, ruleModule, rawTok, parts, tokens, ansi, ruleConfig = {}) {
  if (disabledRules.has(ruleModule.name)) return null;
  return ruleModule.checkToken(rawTok, parts, { tokens, ansi, ruleConfig });
}

// Run a checkValue-based rule against a single CSS declaration value.
// Returns null immediately if the rule name is in disabledRules.
export function checkValueIfEnabled(disabledRules, ruleModule, value, ansi) {
  if (disabledRules.has(ruleModule.name)) return null;
  return ruleModule.checkValue(value, { ansi });
}

export function getAllFiles(dir, ...exts) {
  const extSet = new Set(exts);
  const entries = readdirSync(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && extSet.has(extname(e.name)))
    .map((e) => join(e.parentPath ?? e.path, e.name));
}

export function isStorybookFile(filePath) {
  return (
    filePath.includes("/stories/") ||
    filePath.endsWith(".stories.tsx") ||
    filePath.endsWith(".stories.ts")
  );
}

// Run a checkToken-based rule against every className/class token in a TSX
// source string. Parses once, walks JSXAttribute[className|class] values, splits
// their static text, and composes the pre-split parts per token, mirroring the
// production pipeline. Returns the violation messages (strings) that fire.
export function runTokenRuleOnSource(checkTokenFn, source, tokens, ansi, ruleConfig = {}) {
  const ast = parseSource(source);
  const ignore = ignoredLines(ast);
  const violations = [];
  walk(ast.program, (node) => {
    if (node.type !== "JSXOpeningElement") return;
    for (const attr of node.attributes) {
      if (attr.type !== "JSXAttribute") continue;
      const name = jsxName(attr.name);
      if (name !== "className" && name !== "class") continue;
      for (const { text, node: strNode } of classNameStatics(attr.value)) {
        if (ignore.has(offsetToLine(ast.lineStarts, strNode.start))) continue;
        for (const rawTok of text.split(/\s+/)) {
          if (!rawTok) continue;
          const parts = composeColorParts(rawTok, tokens.colorPrefixes);
          // Not a Candidate — Tailwind would discard this string, so skip it.
          if (parts === null) continue;
          const msg = checkTokenFn(rawTok, parts, { tokens, ansi, ruleConfig });
          if (msg) violations.push(msg);
        }
      }
    }
  });
  return violations;
}
