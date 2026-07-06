// FP corpus for Change C (JSX/TS → oxc AST).
//
// Curated trigger snippets from docs/lint-color-review.md. Each string below is
// labeled className-vs-not so the false-positive rate can be measured: a string
// tagged NOT-CLASS must never produce a color violation; a string tagged CLASS
// is a genuine class list. The executable gate lives in tests/findings.test.ts;
// this file is the human-readable catalog the tests mirror.

import { Button } from "./ui";

export function Triggers({ url, color, shade, k }: {
  url: string; color: string; shade: string; k: string;
}) {
  // NOT-CLASS: color tokens inside an Error message must not be scanned (#root)
  if (!url) throw new Error("reset the bg-red-500 text-blue-500 flag");

  // NOT-CLASS: GraphQL / URL string literals (#root)
  const query = "query { user { bg-red-500 } }";
  const href = "https://example.com/path//bg-red-500";
  void query;

  return (
    <>
      {/* CLASS + #1: // in the href no longer truncates the className line */}
      <a href={href} className="text-blue-500">
        link
      </a>

      {/* CLASS + M1: an unclosed block-comment opener in title must not swallow the file */}
      <div title="20/*5" className="text-red-500" />
      <div className="text-green-500" />

      {/* NOT-CLASS + #11: color: inside title is not a style prop */}
      <div title="x, color: red" />

      {/* NOT-CLASS + #2/M2: a { inside a style value must not desync */}
      <div style={{ content: "{" }} />
      <div style={{ color: "red" }} />

      {/* CLASS + #4: backtick className reaches the hover rule */}
      <div className={`hover:bg-primary`} />

      {/* NOT-A-VIOLATION + #10: role expression string makes hover: valid */}
      <div role={"button"} className="hover:bg-primary" />

      {/* CLASS + #12: nested } in ${…} no longer breaks the template */}
      <Button className={`bg-${({ shade }).shade}`} />

      {/* CLASS + M4: an apostrophe in a className must not truncate it */}
      <Button className="foo'bar bg-primary" />

      {/* NOT-SUPPRESSED + #18: a color-lint-ignore-panel class is not a marker */}
      <div className="color-lint-ignore-panel text-red-500" />

      {/* SUPPRESSED: a real suppress comment counts and hides the line */}
      <div className="text-orange-500" /> {/* color-lint-ignore */}

      <span>{color}{shade}{k}</span>
    </>
  );
}
