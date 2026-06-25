// Core linting logic — operates on in-memory source strings.
// index.js is the file-reading entry point; tests import createLinter directly.

import {
  buildDisabledRules,
  checkLineIfEnabled,
  checkTokenIfEnabled,
  extractStringLiterals,
  lintSourceIfEnabled,
  normalizeTwToken,
} from "./shared.js";

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
  function checkTailwindToken(rawTok) {
    const found = [];

    const darkMsg = checkTokenIfEnabled(disabledRules, ruleDarkModifier, rawTok, rawTok, rawTok, tokens, ansi, config[ruleDarkModifier.name]);
    if (darkMsg) found.push({ message: darkMsg, ruleId: ruleDarkModifier.id });

    const rawColorMsg = checkTokenIfEnabled(disabledRules, ruleRawCssColor, rawTok, rawTok, rawTok, tokens, ansi, config[ruleRawCssColor.name]);
    if (rawColorMsg) found.push({ message: rawColorMsg, ruleId: ruleRawCssColor.id });

    const normalized = normalizeTwToken(rawTok);
    const tok = normalized.split("/")[0];
    if (!tok) return found;

    const alphaMsg = checkTokenIfEnabled(disabledRules, ruleAlphaModifier, rawTok, tok, normalized, tokens, ansi, config[ruleAlphaModifier.name]);
    if (alphaMsg) found.push({ message: alphaMsg, ruleId: ruleAlphaModifier.id });

    const spectralMsg = checkTokenIfEnabled(disabledRules, ruleSpectralColor, rawTok, tok, normalized, tokens, ansi, config[ruleSpectralColor.name]);
    if (spectralMsg) found.push({ message: spectralMsg, ruleId: ruleSpectralColor.id });

    const undefinedMsg = checkTokenIfEnabled(disabledRules, ruleUndefinedToken, rawTok, tok, normalized, tokens, ansi, config[ruleUndefinedToken.name]);
    if (undefinedMsg) found.push({ message: undefinedMsg, ruleId: ruleUndefinedToken.id });

    const constraintsMsg = checkTokenIfEnabled(disabledRules, ruleColorRules, rawTok, tok, normalized, tokens, ansi, config[ruleColorRules.name]);
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
    // Returns { violations: { line, message, ruleId }[], ignores: number[] }
    lintCssSource(source, isExempt) {
      const violations = [];
      const ignores = [];
      const lines = source.split("\n");
      let inComment = false;

      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        let line = lines[i];

        if (inComment) {
          if (line.includes("*/")) inComment = false;
          continue;
        }
        const ignored = line.includes("/* color-lint-ignore */");
        if (line.includes("/*")) {
          inComment = !line.includes("*/");
          line = line.replace(/\/\*.*?\*\//g, "").replace(/\/\*.*$/, "");
        }

        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("//")) continue;
        if (ignored) { ignores.push(lineNum); continue; }

        if (!isExempt) {
          const applyMatch = trimmed.match(/^@apply\s+(.+?);?\s*$/);
          if (applyMatch) {
            violations.push(...checkTailwindClasses(applyMatch[1], lineNum));
          }

          const rawCssMsg = checkLineIfEnabled(disabledRules, ruleRawCssColor, line, ansi);
          if (rawCssMsg) violations.push({ line: lineNum, message: rawCssMsg, ruleId: ruleRawCssColor.id });
        }
      }

      return { violations, ignores };
    },
  };
}
