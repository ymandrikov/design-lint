// Regression net for Change C (JSX/TS → oxc AST).
//
// Each case encodes the DESIRED post-fix behavior for a finding from
// docs/lint-color-review.md and fails on `main` (the hand-rolled text scanner).
// The trigger snippets are mirrored in fixtures/edge-cases/ (the FP corpus).
import { describe, expect, it } from "vitest";
import { ansi } from "../lint-color/helpers.js";
import {
  TAILWIND_COLOR_PREFIXES,
  TAILWIND_SPECTRAL_COLORS,
} from "../lint-color/shared.js";
import { createLinter } from "../lint-color/linter.js";

type Rules = Record<string, { enabled: boolean }>;

const minimalSemanticSet = new Set(["primary", "muted"]);
const minimalTokens = {
  colorPrefixes: TAILWIND_COLOR_PREFIXES,
  semanticSet: minimalSemanticSet,
  spectralSet: TAILWIND_SPECTRAL_COLORS,
  uiComponents: new Set(["Button"]),
  isValidTailwindCandidate: (tok: string) => {
    for (const p of TAILWIND_COLOR_PREFIXES) {
      if (tok.startsWith(p + "-")) {
        const colorPart = tok.slice(p.length + 1);
        if (colorPart.startsWith("[")) return true;
        const stem = colorPart.split("-")[0];
        return minimalSemanticSet.has(colorPart) || TAILWIND_SPECTRAL_COLORS.has(stem);
      }
    }
    return true;
  },
};

const linter = (rules: Rules) => createLinter(rules, minimalTokens, ansi);
const spectral = { "no-spectral-color": { enabled: true } };

const checkTailwind = (src: string, rules: Rules = spectral) =>
  linter(rules).lintTailwindSource(src);
const checkStyle = (src: string) =>
  linter({}).lintStyleSource(src, "test.tsx").violations;
const checkHover = (src: string) =>
  linter({}).lintHoverSource(src, "test.tsx").violations;
const checkComponent = (src: string) =>
  linter({}).lintComponentSource(src, "test.tsx").violations;

const messages = (vs: { message: string }[]) => vs.map((v) => v.message).join("\n");

describe("root cause — only className attributes are scanned", () => {
  it("does not flag color tokens inside a thrown Error message", () => {
    const src = `function f() { throw new Error("reset the bg-red-500 text-blue-500 flag"); }`;
    expect(checkTailwind(src).violations).toHaveLength(0);
  });

  it("does not flag color tokens inside an unrelated string literal", () => {
    const src = `const q = "query { bg-red-500 }"; const url = "https://x/bg-red-500";`;
    expect(checkTailwind(src).violations).toHaveLength(0);
  });
});

describe("finding #1 — // in a URL no longer truncates the line", () => {
  it("flags text-blue-500 on an <a> with an https href", () => {
    const src = `<a href="https://x" className="text-blue-500">t</a>`;
    const vs = checkTailwind(src).violations;
    expect(messages(vs)).toContain("text-blue-500");
  });
});

describe("finding M1 — /* in a string no longer swallows the file", () => {
  it("still lints className after a title with an unclosed /*", () => {
    const src = [
      `<>`,
      `  <div title="20/*5" className="text-red-500" />`,
      `  <div className="text-green-500" />`,
      `</>`,
    ].join("\n");
    const out = messages(checkTailwind(src).violations);
    expect(out).toContain("text-red-500");
    expect(out).toContain("text-green-500");
  });
});

describe("finding #6 — code after a block comment close is still linted", () => {
  it("flags a className that follows an inline block comment", () => {
    const src = [`<div`, `  /* c */ className="text-red-500"`, `/>`].join("\n");
    expect(messages(checkTailwind(src).violations)).toContain("text-red-500");
  });
});

describe("finding #2 / M2 — { inside a style value no longer desyncs", () => {
  it("flags only the real color property, not a following block", () => {
    const src = [
      `<>`,
      `  <div style={{ content: "{" }} />`,
      `  <div style={{ color: "red" }} />`,
      `</>`,
    ].join("\n");
    const vs = checkStyle(src);
    expect(vs).toHaveLength(1);
    expect(vs[0].message).toContain("color");
  });
});

describe("finding #4 — backtick className is inspected by the hover rule", () => {
  it("flags hover: in a template-literal className on a div", () => {
    const src = "<div className={`hover:bg-primary`} />";
    expect(checkHover(src)).toHaveLength(1);
  });
});

describe("finding #10 — role={\"button\"} is recognized as interactive", () => {
  it("does not flag hover: when role is an expression string", () => {
    const src = `<div role={"button"} className="hover:bg-primary" />`;
    expect(checkHover(src)).toHaveLength(0);
  });
});

describe("finding #11 — color: in an unrelated attribute is not a style prop", () => {
  it("does not flag a title containing 'color: red'", () => {
    const src = `<div title="x, color: red" />`;
    expect(checkStyle(src)).toHaveLength(0);
  });
});

describe("finding #12 — nested } inside ${…} no longer breaks template handling", () => {
  it("still flags the bg- prefix of a dynamic template class on a component", () => {
    const src = "<Button className={`bg-${obj.method({ shade: 500 })}`} />";
    expect(messages(checkComponent(src))).toContain("bg-");
  });
});

describe("finding #17 — an escaped backtick does not desync tag detection", () => {
  it("still flags hover: after a template with an escaped backtick", () => {
    const src = ["const x = `esc\\`aped`;", `<div className="hover:bg-primary" />`].join("\n");
    expect(checkHover(src)).toHaveLength(1);
  });
});

describe("finding M4 — an apostrophe in a className does not truncate it", () => {
  it("flags a color token that follows an apostrophe on a component", () => {
    const src = `<Button className="foo'bar bg-primary" />`;
    expect(messages(checkComponent(src))).toContain("bg-primary");
  });
});

describe("finding #18 — color-lint-ignore is not a superstring match", () => {
  it("does not suppress a class list containing color-lint-ignore-panel", () => {
    const src = `<div className="color-lint-ignore-panel text-red-500" />`;
    const { violations, ignores } = checkTailwind(src);
    expect(messages(violations)).toContain("text-red-500");
    expect(ignores).toHaveLength(0);
  });

  it("still suppresses a real /* color-lint-ignore */ comment", () => {
    const src = `<><div className="text-red-500" /> {/* color-lint-ignore */}</>`;
    const { violations, ignores } = checkTailwind(src);
    expect(violations).toHaveLength(0);
    expect(ignores).toEqual([1]);
  });

  // A multi-line comment that merely mentions the marker on a non-code line must
  // not swallow violations on other lines it spans (suppression is per-line).
  it("suppresses only the marker's own line, not the whole comment span", () => {
    const src = ["<>", "  {/*", "    color-lint-ignore", "  */}", `  <div className="text-red-500" />`, "</>"].join("\n");
    const { violations, ignores } = checkTailwind(src);
    expect(messages(violations)).toContain("text-red-500");
    expect(ignores).toEqual([3]);
  });
});
