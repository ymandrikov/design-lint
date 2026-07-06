// Core linting logic — operates on in-memory source strings.
// index.js is the file-reading entry point; tests import createLinter directly.

import postcss from "postcss";

import {
  buildDisabledRules,
  checkValueIfEnabled,
  checkTokenIfEnabled,
  extractStringLiterals,
  lintSourceIfEnabled,
} from "./shared.js";
import { composeColorParts } from "./classify.js";

import * as ruleStyleColor from "./rules/no-style-color.js";
import * as ruleRawCssColor from "./rules/no-raw-css-color.js";
import * as ruleAlphaModifier from "./rules/no-opacity-modifier.js";
import * as ruleSpectralColor from "./rules/no-spectral-color.js";
import * as ruleColorRules from "./rules/token-constraints.js";
import * as ruleDarkModifier from "./rules/no-dark-variant.js";
import * as ruleHoverInteractive from "./rules/no-useless-hover.js";
import * as ruleUiColorOverride from "./rules/no-component-color-override.js";
import * as ruleUndefinedToken from "./rules/no-undefined-token.js";

export function createLinter(config, tokens, ansi) {
  const disabledRules = buildDisabledRules(config);

  // Runs all token rules against a single raw token. All rules run — no early returns.
  // The bracket-aware decomposition happens once here; every rule reads the parts.
  function checkTailwindToken(rawTok) {
    const found = [];
    const parts = composeColorParts(rawTok, tokens.colorPrefixes);

    const darkMsg = checkTokenIfEnabled(disabledRules, ruleDarkModifier, rawTok, parts, tokens, ansi, config[ruleDarkModifier.name]);
    if (darkMsg) found.push({ message: darkMsg, ruleId: ruleDarkModifier.id });

    const rawColorMsg = checkTokenIfEnabled(disabledRules, ruleRawCssColor, rawTok, parts, tokens, ansi, config[ruleRawCssColor.name]);
    if (rawColorMsg) found.push({ message: rawColorMsg, ruleId: ruleRawCssColor.id });

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

  function checkTailwindClasses(classesStr, lineNum) {
    const violations = [];
    for (const rawTok of classesStr.split(/\s+/)) {
      if (!rawTok) continue;
      for (const v of checkTailwindToken(rawTok)) {
        violations.push({ line: lineNum, ...v });
      }
    }
    return violations;
  }

  return {
    // Extracts string literals from TSX/TS source and runs the full token pipeline on each.
    // Returns { violations: { line, message, ruleId }[], ignores: number[] }
    lintTailwindSource(source) {
      const violations = [];
      const ignores = [];
      const lines = source.split("\n");
      let inBlockComment = false;

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        let line = lines[i];

        if (inBlockComment) {
          if (line.includes("*/")) inBlockComment = false;
          continue;
        }
        if (line.includes("color-lint-ignore")) {
          ignores.push(lineNum);
          continue;
        }
        if (line.includes("/*")) {
          if (!line.includes("*/")) inBlockComment = true;
          line = line.replace(/\/\*.*?\*\//g, "").replace(/\/\*.*$/, "");
        }

        const lineCommentIdx = line.indexOf("//");
        if (lineCommentIdx >= 0) line = line.slice(0, lineCommentIdx);

        for (const str of extractStringLiterals(line)) {
          violations.push(...checkTailwindClasses(str, lineNum));
        }
      }

      return { violations, ignores };
    },

    // Checks inline style={{ color/backgroundColor }} props.
    // Returns { violations: { line, message, ruleId }[], ignores: [] }
    lintStyleSource(source, filePath) {
      const violations = lintSourceIfEnabled(disabledRules, ruleStyleColor, source, filePath, {}, ansi, config[ruleStyleColor.name])
        .map((v) => ({ ...v, ruleId: ruleStyleColor.id }));
      return { violations, ignores: [] };
    },

    // Checks hover: variant used on non-interactive elements.
    // Returns { violations: { line, message, ruleId }[], ignores: [] }
    lintHoverSource(source, filePath) {
      const violations = lintSourceIfEnabled(disabledRules, ruleHoverInteractive, source, filePath, tokens, ansi, config[ruleHoverInteractive.name])
        .map((v) => ({ ...v, ruleId: ruleHoverInteractive.id }));
      return { violations, ignores: [] };
    },

    // Checks shadcn UI component color overrides.
    // Returns { violations: { line, message, ruleId }[], ignores: [] }
    lintComponentSource(source, filePath) {
      const violations = lintSourceIfEnabled(disabledRules, ruleUiColorOverride, source, filePath, tokens, ansi, config[ruleUiColorOverride.name])
        .map((v) => ({ ...v, ruleId: ruleUiColorOverride.id }));
      return { violations, ignores: [] };
    },

    // Checks CSS source for raw color values and Tailwind tokens in @apply directives.
    // Walks the PostCSS CST so color detection sees only declaration values and
    // @apply params — never selectors or at-rule preludes (findings #7, #8).
    // Returns { violations: { line, message, ruleId }[], ignores: number[] }
    lintCssSource(source, isExempt) {
      const violations = [];
      const ignores = [];

      let root;
      try {
        root = postcss.parse(source);
      } catch {
        // Malformed CSS — nothing structural to walk. Report nothing rather
        // than fall back to the line scanner this replaced.
        return { violations, ignores };
      }

      // A `/* color-lint-ignore */` comment suppresses violations on its own
      // line (matching the previous line-based behaviour) and is counted.
      const ignoredLines = new Set();
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
        if (msg) violations.push({ line, message: msg, ruleId: ruleRawCssColor.id });
      });

      root.walkAtRules("apply", (atRule) => {
        const line = atRule.source?.start?.line;
        if (line && ignoredLines.has(line)) return;
        violations.push(...checkTailwindClasses(atRule.params, line));
      });

      return { violations, ignores };
    },
  };
}
