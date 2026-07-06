// Rule 1 — No color or backgroundColor in style= props.
// Use a CSS module with a var(--color-*) token instead.

export const id = 1;
export const name = "no-style-color";

import {
  parseSource,
  walk,
  jsxName,
  styleObjectProps,
  ignoredLines,
  offsetToLine,
} from "../ast.js";

// lintSource(source, filePath, ctx)
// ctx.report(lineNum, message) called for each violation.
//
// Reads the style object literal from the AST, so a `{` inside a string value
// (`style={{ content: "{" }}`) can no longer desync brace tracking (#2 / M2),
// and only the object's own keys are inspected — a `color:` substring elsewhere
// on the line (`title="x, color: red"`) is never a false positive (#11).
export function lintSource(source, filePath, ctx) {
  const { report, ansi } = ctx;
  const ast = parseSource(source, filePath);
  const ignore = ignoredLines(ast);

  walk(ast.program, (node) => {
    if (node.type !== "JSXOpeningElement") return;
    for (const attr of node.attributes) {
      if (attr.type !== "JSXAttribute" || jsxName(attr.name) !== "style") continue;
      for (const { keyName, node: propNode } of styleObjectProps(attr.value)) {
        if (keyName !== "color" && keyName !== "backgroundColor") continue;
        const line = offsetToLine(ast.lineStarts, propNode.start);
        if (ignore.has(line)) continue;
        report(line, `${ansi.red(keyName)} in style= — move to a ${ansi.blue("CSS module")}`);
      }
    }
  });
}
