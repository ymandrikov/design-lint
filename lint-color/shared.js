// Shared utilities for lint-color rules.

import { readdirSync } from "node:fs";
import { extname, join } from "node:path";

import { splitColorToken } from "./classify.js";

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

// Run a checkToken-based rule against a single token.
// Returns null immediately if the rule name is in disabledRules.
export function checkTokenIfEnabled(disabledRules, ruleModule, rawTok, tok, normalized, tokens, ansi, ruleConfig = {}) {
  if (disabledRules.has(ruleModule.name)) return null;
  return ruleModule.checkToken(rawTok, tok, normalized, { tokens, ansi, ruleConfig });
}

// Run a checkLine-based rule against a single CSS line.
// Returns null immediately if the rule name is in disabledRules.
export function checkLineIfEnabled(disabledRules, ruleModule, line, ansi) {
  if (disabledRules.has(ruleModule.name)) return null;
  return ruleModule.checkLine(line, { ansi });
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

// Strip Tailwind variant prefixes and the important marker, returning the base
// with any Modifier still attached: "hover:!bg-red/50" → "bg-red/50".
//
// DEPRECATED — a thin wrapper over the bracket-aware splitColorToken so current
// call sites stop splitting variants on a bracketed ":" without a signature
// change (finding #5). Callers still re-split the result on "/", so a base that
// itself contains a slash isn't fully preserved until callers consume
// splitColorToken parts directly in v1.1, when this wrapper is deleted.
export function normalizeTwToken(tok) {
  const { base, modifier } = splitColorToken(tok);
  return modifier === null ? base : `${base}/${modifier}`;
}

// Extract string literal contents from a single source line.
export function extractStringLiterals(line) {
  const results = [];
  const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    results.push(m[1] !== undefined ? m[1] : m[2]);
  }
  return results;
}

// Run a checkToken-based rule against every string literal token in a JSX source string.
// Returns the violation messages (strings) for all tokens that fire.
export function runTokenRuleOnSource(checkTokenFn, source, tokens, ansi, ruleConfig = {}) {
  const violations = [];
  for (const line of source.split("\n")) {
    if (line.includes("color-lint-ignore")) continue;
    for (const str of extractStringLiterals(line)) {
      for (const rawTok of str.split(/\s+/)) {
        if (!rawTok) continue;
        const normalized = normalizeTwToken(rawTok);
        const tok = normalized.split("/")[0];
        const msg = checkTokenFn(rawTok, tok, normalized, { tokens, ansi, ruleConfig });
        if (msg) violations.push(msg);
      }
    }
  }
  return violations;
}

export function buildLineStarts(src) {
  const starts = [0];
  for (let k = 0; k < src.length; k++) {
    if (src[k] === "\n") starts.push(k + 1);
  }
  return starts;
}

export function offsetToLine(lineStarts, offset) {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

// Extract JSX opening tags from TSX source without a full parser.
// Returns [{ tagName, content, startOffset }] where content is from < to >.
export function extractJsxOpeningTags(src) {
  const tags = [];
  const n = src.length;
  let i = 0;
  let outerStr = null;

  while (i < n) {
    const ch = src[i];

    if (outerStr) {
      if (outerStr !== "`" && ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === outerStr) outerStr = null;
      i++;
      continue;
    }

    // Skip // line comments.
    if (ch === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    // Skip /* block comments */.
    if (ch === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n - 1 && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    // Track " and ` string literals to avoid false tag detection inside strings.
    // Single quotes intentionally excluded: apostrophes in JSX text content
    // (e.g. "org's") would set outerStr and swallow subsequent tags.
    if (ch === '"' || ch === "`") {
      outerStr = ch;
      i++;
      continue;
    }

    if (ch === "<" && /[a-zA-Z_]/.test(src[i + 1] ?? "")) {
      let nameEnd = i + 1;
      while (nameEnd < n && /[\w.]/.test(src[nameEnd])) nameEnd++;
      const tagName = src.slice(i + 1, nameEnd);

      let j = nameEnd;
      let tagStr = null;
      let tagBrace = 0;
      let tagEnd = -1;

      while (j < n) {
        const c = src[j];
        if (tagStr) {
          if (tagStr !== "`" && c === "\\") {
            j += 2;
            continue;
          }
          if (c === tagStr) tagStr = null;
        } else if (c === '"' || c === "'" || c === "`") {
          tagStr = c;
        } else if (c === "{") {
          tagBrace++;
        } else if (c === "}") {
          tagBrace--;
        } else if (tagBrace === 0 && c === ">") {
          tagEnd = j;
          break;
        } else if (tagBrace === 0 && c === "<") {
          break;
        }
        j++;
      }

      if (tagEnd !== -1) {
        tags.push({
          tagName,
          content: src.slice(i, tagEnd + 1),
          startOffset: i,
        });
        i = tagEnd + 1;
        continue;
      }
    }

    i++;
  }
  return tags;
}
