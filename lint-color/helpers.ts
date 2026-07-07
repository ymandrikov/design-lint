// Shared types and test helpers for lint-color rule tests.
// scripts/ is excluded from tsconfig, so rule modules are imported via cast.

import { composeColorParts } from "./classify.js";
import {
  parseSource,
  walk,
  jsxName,
  classNameStatics,
  ignoredLines,
  offsetToLine,
} from "./ast.ts";

export type Ansi = { red: (s: string) => string; blue: (s: string) => string };
export type ReportFn = (line: number, message: string) => void;

export type LintCtx = {
  report: ReportFn;
  ansi: Ansi;
  tokens?: Record<string, unknown>;
  ruleConfig?: Record<string, unknown>;
};
export type TokenCtx = {
  tokens: Record<string, unknown>;
  ansi: Ansi;
  ruleConfig?: Record<string, unknown>;
};

// Derived from the classifier's source of truth so it can't drift from the real
// runtime shape the linter hands to checkToken (includes the arbitrary-property fields).
export type ColorParts = NonNullable<ReturnType<typeof composeColorParts>>;

export type LintSourceFn = (source: string, filePath: string, ctx: LintCtx) => void;
export type CheckValueFn = (value: string, ctx: { ansi: Ansi }) => string | null;
export type CheckTokenFn = (
  rawTok: string,
  parts: ColorParts,
  ctx: TokenCtx,
) => string | null;

export type RuleModule = {
  id: number;
  name: string;
  lintSource?: LintSourceFn;
  checkValue?: CheckValueFn;
  checkToken?: CheckTokenFn;
};

export type RuleConfig = { enabled?: boolean; [key: string]: unknown };

export const ansi: Ansi = { red: (s) => s, blue: (s) => s };

export function makeReporter() {
  const found: { line: number; message: string }[] = [];
  const report: ReportFn = (line, message) => found.push({ line, message });
  return { found, report };
}

// Run a checkToken-based rule against every className/class token in a TSX
// source string. Parses once, walks JSXAttribute[className|class] values, splits
// their static text, and composes the pre-split parts per token, mirroring the
// production pipeline. Returns the violation messages (strings) that fire.
export function runTokenRuleOnSource(
  checkTokenFn: CheckTokenFn,
  source: string,
  tokens: Record<string, unknown>,
  ansi: Ansi,
  ruleConfig: RuleConfig = {},
) {
  const ast = parseSource(source)!;
  const ignore = ignoredLines(ast);
  const violations: string[] = [];
  walk(ast.program, (node: any) => {
    if (node.type !== "JSXOpeningElement") return;
    for (const attr of node.attributes) {
      if (attr.type !== "JSXAttribute") continue;
      const name = jsxName(attr.name);
      if (name !== "className" && name !== "class") continue;
      for (const { text, node: strNode } of classNameStatics(attr.value)) {
        if (ignore.has(offsetToLine(ast.lineStarts, strNode.start))) continue;
        for (const rawTok of text.split(/\s+/)) {
          if (!rawTok) continue;
          const parts = composeColorParts(rawTok, tokens.colorPrefixes as string[] | undefined);
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
