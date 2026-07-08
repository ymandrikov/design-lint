// Core linting logic — operates on in-memory source strings.
// index.ts is the file-reading entry point; tests import createLinter directly.

import postcss, { type Root } from "postcss";

import {
  parseSource,
  walk,
  jsxName,
  classNameStatics,
  ignoredLines,
  offsetToLine,
} from "./ast.ts";
import {
  parseErb,
  collectErbClassTokens,
  collectErbIgnoredLines,
  erbParseErrors,
} from "./ast-erb.ts";
import { composeColorParts, type ColorParts, type NamespaceKind } from "./classify.ts";

import * as ruleStyleColor from "./rules/no-style-color.ts";
import * as ruleRawCssColor from "./rules/no-raw-css-color.ts";
import * as ruleVarColor from "./rules/no-var-color.ts";
import * as ruleAlphaModifier from "./rules/no-opacity-modifier.ts";
import * as ruleSpectralColor from "./rules/no-spectral-color.ts";
import * as ruleColorRules from "./rules/token-constraints.ts";
import * as ruleDarkModifier from "./rules/no-dark-variant.ts";
import * as ruleHoverInteractive from "./rules/no-useless-hover.ts";
import * as ruleUiColorOverride from "./rules/no-component-color-override.ts";
import * as ruleUndefinedToken from "./rules/no-undefined-token.ts";

type Ansi = { red: (s: string) => string; blue: (s: string) => string };
type ReportFn = (line: number, message: string) => void;

// The resolved token set the CLI (index.ts) and the tests (minimalTokens) build.
// Every field is optional so both shapes — and the `{}` passed for source-only
// rules — satisfy it. Only `colorPrefixes` is read here; the rest are threaded
// to rules via ctx.tokens.
type Tokens = {
  semanticSet?: Set<string>;
  spectralSet?: Set<string>;
  colorPrefixes?: string[];
  uiComponents?: Set<string>;
  isValidTailwindCandidate?: ((tok: string) => boolean) | null;
  resolveNamespaceKind?: ((base: string) => NamespaceKind) | null;
};

type RuleConfig = { enabled?: boolean; [key: string]: unknown };
type LinterConfig = Record<string, RuleConfig>;

// Ctx shapes the dispatch PROMISES each rule. `ruleConfig` is intentionally left
// out of these promised types: nine rules are untyped `.js` and the one typed
// rule (`no-spectral-color.ts`) declares its own private `ruleConfig` shape, so
// pinning a single `ruleConfig` type here would clash with it contravariantly.
// `ruleConfig` IS still passed at runtime (see the helpers) — the rules that read
// it receive it; only the compile-time contract omits it.
type LintSourceCtx = { report: ReportFn; tokens: Tokens; ansi: Ansi };
type CheckTokenCtx = { tokens: Tokens; ansi: Ansi };
type ValueCtx = { ansi: Ansi };

// Rule-module dispatch shapes — the members of each `import * as ruleX` namespace
// the helpers read. The nine `.js` rules type-resolve with permissive
// (`any`-param) signatures under `checkJs:false`; `no-spectral-color.ts` (typed)
// satisfies `CheckTokenRule` because the promised ctx omits `ruleConfig` (above).
type NamedRule = { id: number; name: string };
type LintSourceRule = NamedRule & {
  lintSource(source: string, filePath: string, ctx: LintSourceCtx): void;
};
type CheckTokenRule = NamedRule & {
  checkToken(rawTok: string, parts: ColorParts, ctx: CheckTokenCtx): string | null;
};
type CheckValueRule = NamedRule & {
  checkValue(value: string, ctx: ValueCtx): string | null;
};

type Violation = { line: number; message: string; ruleId: number };
type RuleViolation = { message: string; ruleId: number };
type LintResult = { violations: Violation[]; ignores: number[] };

function buildDisabledRules(rules: LinterConfig): Set<string> {
  return new Set(
    Object.entries(rules)
      .filter(([, r]) => r.enabled === false)
      .map(([name]) => name),
  );
}

function lintSourceIfEnabled(
  disabledRules: Set<string>,
  ruleModule: LintSourceRule,
  source: string,
  filePath: string,
  tokens: Tokens,
  ansi: Ansi,
  ruleConfig: RuleConfig = {},
): { line: number; message: string }[] {
  if (disabledRules.has(ruleModule.name)) return [];
  const found: { line: number; message: string }[] = [];
  const report: ReportFn = (line, message) => found.push({ line, message });
  // Built as a local (not an inline literal) so the runtime-only `ruleConfig`
  // rides along without tripping excess-property checks on `LintSourceCtx`.
  const ctx = { report, tokens, ansi, ruleConfig };
  ruleModule.lintSource(source, filePath, ctx);
  return found;
}

function checkTokenIfEnabled(
  disabledRules: Set<string>,
  ruleModule: CheckTokenRule,
  rawTok: string,
  parts: ColorParts,
  tokens: Tokens,
  ansi: Ansi,
  ruleConfig: RuleConfig = {},
): string | null {
  if (disabledRules.has(ruleModule.name)) return null;
  // Local (not inline literal) so `ruleConfig` rides along at runtime without
  // tripping excess-property checks on `CheckTokenCtx` (see the ctx types above).
  const ctx = { tokens, ansi, ruleConfig };
  return ruleModule.checkToken(rawTok, parts, ctx);
}

function checkValueIfEnabled(
  disabledRules: Set<string>,
  ruleModule: CheckValueRule,
  value: string,
  ansi: Ansi,
): string | null {
  if (disabledRules.has(ruleModule.name)) return null;
  return ruleModule.checkValue(value, { ansi });
}

export function createLinter(config: LinterConfig, tokens: Tokens, ansi: Ansi) {
  const disabledRules = buildDisabledRules(config);

  // Runs all token rules against a single raw token. All rules run — no early returns.
  // The bracket-aware decomposition happens once here; every rule reads the parts.
  function checkTailwindToken(rawTok: string): RuleViolation[] {
    const found: RuleViolation[] = [];
    const parts = composeColorParts(rawTok, tokens.colorPrefixes);
    // Not a Candidate — Tailwind would discard this string, so no rule runs.
    if (parts === null) return found;

    // Non-color filter (FR-002/003): a candidate behind a color prefix whose
    // value resolves to a non-color CSS property (text-sm, shadow-lg, border-2)
    // is not a color reference — drop it before any color rule runs. One seam,
    // all rules. Null-safe: an absent resolver (unit tests without the Tailwind
    // API) makes this a no-op, mirroring the isValidTailwindCandidate pattern.
    if (
      parts.colorPrefix !== null &&
      tokens.resolveNamespaceKind &&
      tokens.resolveNamespaceKind(parts.base) === "non-color"
    ) {
      return found;
    }

    const darkMsg = checkTokenIfEnabled(disabledRules, ruleDarkModifier, rawTok, parts, tokens, ansi, config[ruleDarkModifier.name]);
    if (darkMsg) found.push({ message: darkMsg, ruleId: ruleDarkModifier.id });

    const rawColorMsg = checkTokenIfEnabled(disabledRules, ruleRawCssColor, rawTok, parts, tokens, ansi, config[ruleRawCssColor.name]);
    if (rawColorMsg) found.push({ message: rawColorMsg, ruleId: ruleRawCssColor.id });

    const varColorMsg = checkTokenIfEnabled(disabledRules, ruleVarColor, rawTok, parts, tokens, ansi, config[ruleVarColor.name]);
    if (varColorMsg) found.push({ message: varColorMsg, ruleId: ruleVarColor.id });

    // No base (e.g. "/50" or a lone "!") — nothing for the color-part rules to see.
    if (!parts.base) return found;

    const alphaMsg = checkTokenIfEnabled(disabledRules, ruleAlphaModifier, rawTok, parts, tokens, ansi, config[ruleAlphaModifier.name]);
    if (alphaMsg) found.push({ message: alphaMsg, ruleId: ruleAlphaModifier.id });

    const spectralMsg = checkTokenIfEnabled(disabledRules, ruleSpectralColor, rawTok, parts, tokens, ansi, config[ruleSpectralColor.name]);
    if (spectralMsg) found.push({ message: spectralMsg, ruleId: ruleSpectralColor.id });

    const undefinedMsg = checkTokenIfEnabled(disabledRules, ruleUndefinedToken, rawTok, parts, tokens, ansi, config[ruleUndefinedToken.name]);
    if (undefinedMsg) found.push({ message: undefinedMsg, ruleId: ruleUndefinedToken.id });

    const constraintsMsg = checkTokenIfEnabled(disabledRules, ruleColorRules, rawTok, parts, tokens, ansi, config[ruleColorRules.name]);
    if (constraintsMsg) found.push({ message: constraintsMsg, ruleId: ruleColorRules.id });

    return found;
  }

  function checkTailwindClasses(classesStr: string, lineNum: number): Violation[] {
    const violations: Violation[] = [];
    for (const rawTok of classesStr.split(/\s+/)) {
      if (!rawTok) continue;
      for (const v of checkTailwindToken(rawTok)) {
        violations.push({ line: lineNum, ...v });
      }
    }
    return violations;
  }

  return {
    // Walks className/class attribute values and runs the full token pipeline on
    // each static class string. Only real class lists are scanned — error
    // messages, URLs, and comments never reach the pipeline (root-cause fix).
    lintTailwindSource(source: string, filePath?: string): LintResult {
      const ast = parseSource(source, filePath);
      const ignore = ignoredLines(ast);
      const violations: Violation[] = [];

      walk(ast.program, (node) => {
        if (node.type !== "JSXOpeningElement") return;
        for (const attr of node.attributes) {
          if (attr.type !== "JSXAttribute") continue;
          const name = jsxName(attr.name);
          if (name !== "className" && name !== "class") continue;
          for (const { text, node: strNode } of classNameStatics(attr.value)) {
            const line = offsetToLine(ast.lineStarts, strNode.start);
            if (ignore.has(line)) continue;
            violations.push(...checkTailwindClasses(text, line));
          }
        }
      });

      const ignores = [...ignore].sort((a, b) => a - b);
      return { violations, ignores };
    },

    // Walks ERB/HTML `class` attributes and runs the same token pipeline on each
    // fully-static class token. herb loaded once at startup (loadHerb) — this
    // stays sync like its siblings. ERB interpolation is a token boundary
    // (collectErbClassTokens skips any mixed group), suppression mirrors the JSX
    // path, and a malformed template surfaces a parse note without aborting.
    lintErbSource(source: string, filePath?: string): LintResult {
      const result = parseErb(source);
      const ignore = collectErbIgnoredLines(result);
      const violations: Violation[] = [];

      for (const token of collectErbClassTokens(result)) {
        if (ignore.has(token.line)) continue;
        violations.push(...checkTailwindClasses(token.text, token.line));
      }

      // FR-006/D4: never abort the run — surface parse errors as a note and
      // still return whatever the recovered tree yielded.
      const errors = erbParseErrors(result);
      if (errors.length > 0) {
        const where = filePath ? `${filePath}: ` : "";
        console.warn(`${where}ERB parse note — ${errors.length} parse error(s); linting recovered content only.`);
      }

      const ignores = [...ignore].sort((a, b) => a - b);
      return { violations, ignores };
    },

    // Checks inline style={{ color/backgroundColor }} props.
    lintStyleSource(source: string, filePath: string): LintResult {
      const violations = lintSourceIfEnabled(disabledRules, ruleStyleColor, source, filePath, {}, ansi, config[ruleStyleColor.name])
        .map((v) => ({ ...v, ruleId: ruleStyleColor.id }));
      return { violations, ignores: [] };
    },

    // Checks hover: variant used on non-interactive elements.
    lintHoverSource(source: string, filePath: string): LintResult {
      const violations = lintSourceIfEnabled(disabledRules, ruleHoverInteractive, source, filePath, tokens, ansi, config[ruleHoverInteractive.name])
        .map((v) => ({ ...v, ruleId: ruleHoverInteractive.id }));
      return { violations, ignores: [] };
    },

    // Checks shadcn UI component color overrides.
    lintComponentSource(source: string, filePath: string): LintResult {
      const violations = lintSourceIfEnabled(disabledRules, ruleUiColorOverride, source, filePath, tokens, ansi, config[ruleUiColorOverride.name])
        .map((v) => ({ ...v, ruleId: ruleUiColorOverride.id }));
      return { violations, ignores: [] };
    },

    // Checks CSS source for raw color values and Tailwind tokens in @apply directives.
    // Walks the PostCSS CST so color detection sees only declaration values and
    // @apply params — never selectors or at-rule preludes (findings #7, #8).
    lintCssSource(source: string, isExempt: boolean): LintResult {
      const violations: Violation[] = [];
      const ignores: number[] = [];

      let root: Root;
      try {
        root = postcss.parse(source);
      } catch {
        // Malformed CSS — nothing structural to walk. Report nothing rather
        // than fall back to the line scanner this replaced.
        return { violations, ignores };
      }

      // A `/* color-lint-ignore */` comment suppresses violations on its own
      // line (matching the previous line-based behaviour) and is counted.
      const ignoredLines = new Set<number>();
      root.walkComments((comment) => {
        if (comment.text.trim() !== "color-lint-ignore") return;
        const line = comment.source?.start?.line;
        if (line) { ignoredLines.add(line); ignores.push(line); }
      });

      // Exempt (color token) files still count ignores but skip color rules.
      if (isExempt) return { violations, ignores };

      root.walkDecls((decl) => {
        const line = decl.source?.start?.line;
        if (line && ignoredLines.has(line)) return;
        const msg = checkValueIfEnabled(disabledRules, ruleRawCssColor, decl.value, ansi);
        // line!: PostCSS always populates a parsed node's source position; the
        // original JS pushed `line` unguarded, so this preserves that behaviour.
        if (msg) violations.push({ line: line!, message: msg, ruleId: ruleRawCssColor.id });
      });

      root.walkAtRules("apply", (atRule) => {
        const line = atRule.source?.start?.line;
        if (line && ignoredLines.has(line)) return;
        // line!: same invariant as above — parsed at-rules always carry a line.
        violations.push(...checkTailwindClasses(atRule.params, line!));
      });

      return { violations, ignores };
    },
  };
}
