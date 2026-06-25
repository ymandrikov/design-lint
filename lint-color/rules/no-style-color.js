// Rule 1 — No color or backgroundColor in style= props.
// Use a CSS module with a var(--color-*) token instead.

export const id = 1;
export const name = "no-style-color";

const STYLE_OPEN_RE = /\bstyle=\{/;
// Matches color: and backgroundColor: as JS keys inside object literals.
// Does NOT match --color-* custom properties (leading - excluded by lookbehind).
const STYLE_COLOR_PROP_RE = /(?<![`'"-])(?<!\w)\b(color|backgroundColor)\s*:/;

// lintSource(source, filePath, ctx)
// ctx.report(lineNum, message) called for each violation.
export function lintSource(source, filePath, ctx) {
  const { report, ansi } = ctx;
  const lines = source.split("\n");
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    if (line.includes("color-lint-ignore")) continue;

    if (depth === 0) {
      const idx = line.search(STYLE_OPEN_RE);
      if (idx === -1) continue;

      const after = line.slice(idx + "style={".length - 1); // include the opening {
      for (const ch of after) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }

      if (STYLE_COLOR_PROP_RE.test(after)) {
        const match = after.match(STYLE_COLOR_PROP_RE);
        report(lineNum, `${ansi.red(match[1])} in style= — move to a ${ansi.blue("CSS module")}`);
      }
    } else {
      for (const ch of line) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }

      if (STYLE_COLOR_PROP_RE.test(line)) {
        const match = line.match(STYLE_COLOR_PROP_RE);
        report(lineNum, `${ansi.red(match[1])} in style= — move to a ${ansi.blue("CSS module")}`);
      }

      if (depth <= 0) depth = 0;
    }
  }
}
