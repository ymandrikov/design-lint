import {
  parseSource,
  walk,
  jsxName,
  styleObjectProps,
  ignoredLines,
  offsetToLine,
} from "../ast.ts";

export const id = 1;
export const name = "no-style-color";

interface Ansi {
  red(s: string): string;
  blue(s: string): string;
}

type ReportFn = (line: number, message: string) => void;

interface Ctx {
  report: ReportFn;
  ansi: Ansi;
}

// Reads the style object literal from the AST (not the raw line) so a `{` inside
// a string value can't desync brace tracking (#2), and a `color:` substring
// elsewhere on the line isn't a false positive (#11).
export function lintSource(source: string, filePath: string, ctx: Ctx): void {
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
