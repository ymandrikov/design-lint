/*
 * Vendored from tailwindcss (MIT)
 * Source: packages/tailwindcss/src/utils/decode-arbitrary-value.ts
 * Commit: 9b0e8af25861ad5b8f5af420ad3ee0b188665027 (v4.3.2)
 * Changes:
 *   - Reimplemented on postcss-value-parser (already a dependency) instead of
 *     Tailwind's private `../value-parser`, so no additional vendored parser is
 *     needed. Node shapes differ (postcss uses `type`/`div`/`space`; Tailwind
 *     uses `kind`/`separator`) but the underscore-decoding semantics — including
 *     the url() / var()-and-theme() first-argument exceptions — are preserved.
 *   - The upstream `addWhitespaceAroundMathOperators` pass is INTENTIONALLY
 *     omitted: this linter uses decode only to normalize arbitrary values before
 *     the color check (is-color), and math-operator spacing never changes a
 *     color verdict. The PRD scopes this port to the underscore exceptions.
 * See ADR 0002 — vendor Tailwind parsing primitives.
 */

import valueParser from "postcss-value-parser";

export function decodeArbitraryValue(input) {
  // There are definitely no functions in the input, so bail early.
  if (input.indexOf("(") === -1) {
    return convertUnderscoresToWhitespace(input);
  }

  const parsed = valueParser(input);
  recursivelyDecodeArbitraryValues(parsed.nodes);
  return valueParser.stringify(parsed.nodes);
}

/**
 * Convert `_` to ` `, except for escaped underscores `\_` they should be
 * converted to `_` instead.
 */
function convertUnderscoresToWhitespace(input, skipUnderscoreToSpace = false) {
  let output = "";
  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    // Escaped underscore
    if (char === "\\" && input[i + 1] === "_") {
      output += "_";
      i += 1;
    }

    // Unescaped underscore
    else if (char === "_" && !skipUnderscoreToSpace) {
      output += " ";
    }

    // All other characters
    else {
      output += char;
    }
  }

  return output;
}

function recursivelyDecodeArbitraryValues(nodes) {
  for (const node of nodes) {
    switch (node.type) {
      case "function": {
        if (node.value === "url" || node.value.endsWith("_url")) {
          // Don't decode underscores in url() but do decode the function name.
          node.value = convertUnderscoresToWhitespace(node.value);
          break;
        }

        if (
          node.value === "var" ||
          node.value.endsWith("_var") ||
          node.value === "theme" ||
          node.value.endsWith("_theme")
        ) {
          node.value = convertUnderscoresToWhitespace(node.value);
          for (let i = 0; i < node.nodes.length; i++) {
            // Don't decode underscores to spaces in the first argument of var().
            if (i === 0 && node.nodes[i].type === "word") {
              node.nodes[i].value = convertUnderscoresToWhitespace(node.nodes[i].value, true);
              continue;
            }
            recursivelyDecodeArbitraryValues([node.nodes[i]]);
          }
          break;
        }

        node.value = convertUnderscoresToWhitespace(node.value);
        recursivelyDecodeArbitraryValues(node.nodes);
        break;
      }
      case "div":
      case "space":
      case "string":
      case "word": {
        node.value = convertUnderscoresToWhitespace(node.value);
        break;
      }
    }
  }
}
