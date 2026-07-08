import { describe, expect, it } from "vitest";
import { renderHuman, renderJson, type RunResult } from "./report.ts";

const plainAnsi = { bold: (s: string) => s, dim: (s: string) => s };

// eslint-disable-next-line no-control-regex — the point is to detect escapes.
const ANSI_RE = /\x1b\[/;

function makeRun(overrides: Partial<RunResult> = {}): RunResult {
  return {
    violations: [],
    ignores: [],
    warnings: [],
    missingSourceDirs: [],
    ruleLabels: {},
    ...overrides,
  };
}

// T006 (US1) — the JSON doc's shape, determinism, and plainness.
describe("renderJson", () => {
  it("emits exactly the five top-level keys of the run record", () => {
    const doc = JSON.parse(renderJson(makeRun()));
    expect(Object.keys(doc)).toEqual([
      "summary",
      "violations",
      "ignores",
      "warnings",
      "missingSourceDirs",
    ]);
  });

  it("emits exactly file, line, rule, message per violation with the kebab-case rule name", () => {
    const run = makeRun({
      violations: [
        { file: "src/a.tsx", line: 3, rule: "no-spectral-color", message: "text-red-500 — spectral" },
      ],
    });
    const doc = JSON.parse(renderJson(run));
    expect(doc.violations).toEqual([
      { file: "src/a.tsx", line: 3, rule: "no-spectral-color", message: "text-red-500 — spectral" },
    ]);
    expect(Object.keys(doc.violations[0])).toEqual(["file", "line", "rule", "message"]);
  });

  it("sorts violations canonically file → line → rule → message regardless of input order", () => {
    const run = makeRun({
      violations: [
        { file: "src/b.css", line: 9, rule: "no-raw-css-color", message: "z" },
        { file: "src/a.tsx", line: 7, rule: "no-spectral-color", message: "m" },
        { file: "src/a.tsx", line: 7, rule: "no-opacity-modifier", message: "m" },
        { file: "src/a.tsx", line: 2, rule: "token-constraints", message: "m" },
        { file: "src/a.tsx", line: 7, rule: "no-opacity-modifier", message: "a" },
      ],
    });
    const doc = JSON.parse(renderJson(run));
    expect(doc.violations.map((v: { file: string; line: number; rule: string; message: string }) =>
      [v.file, v.line, v.rule, v.message].join("|"),
    )).toEqual([
      "src/a.tsx|2|token-constraints|m",
      "src/a.tsx|7|no-opacity-modifier|a",
      "src/a.tsx|7|no-opacity-modifier|m",
      "src/a.tsx|7|no-spectral-color|m",
      "src/b.css|9|no-raw-css-color|z",
    ]);
  });

  it("renders an empty run as zero counts and empty arrays", () => {
    const doc = JSON.parse(renderJson(makeRun()));
    expect(doc).toEqual({
      summary: { violations: 0, ignores: 0 },
      violations: [],
      ignores: [],
      warnings: [],
      missingSourceDirs: [],
    });
  });

  it("derives summary counts from the array lengths", () => {
    const run = makeRun({
      violations: [
        { file: "a", line: 1, rule: "no-spectral-color", message: "x" },
        { file: "b", line: 2, rule: "no-dark-variant", message: "y" },
      ],
      ignores: [{ file: "a", line: 5 }],
      warnings: ["a: ERB parse note — 1 parse error(s); linting recovered content only."],
      missingSourceDirs: ["ghost"],
    });
    const doc = JSON.parse(renderJson(run));
    expect(doc.summary).toEqual({ violations: 2, ignores: 1 });
    expect(doc.violations).toHaveLength(2);
    expect(doc.ignores).toEqual([{ file: "a", line: 5 }]);
    expect(doc.warnings).toHaveLength(1);
    expect(doc.missingSourceDirs).toEqual(["ghost"]);
  });

  it("never serializes ruleLabels and contains no ANSI escape sequences", () => {
    const out = renderJson(
      makeRun({
        violations: [{ file: "a", line: 1, rule: "no-var-color", message: "plain text" }],
        ruleLabels: { "no-var-color": "No CSS variable behind a color class" },
      }),
    );
    expect(out).not.toContain("ruleLabels");
    expect(out).not.toMatch(ANSI_RE);
  });

  it("ends with exactly one trailing newline", () => {
    const out = renderJson(makeRun());
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });
});

// T014 (US3) — the human report opens with a summary: total, affected-file
// count, per-rule counts descending (contracts/cli.md).
describe("renderHuman summary header", () => {
  const multiRuleRun = makeRun({
    violations: [
      { file: "src/a.tsx", line: 1, rule: "no-spectral-color", message: "x" },
      { file: "src/a.tsx", line: 2, rule: "no-spectral-color", message: "y" },
      { file: "src/b.tsx", line: 3, rule: "no-spectral-color", message: "z" },
      { file: "src/b.tsx", line: 4, rule: "no-dark-variant", message: "w" },
    ],
    ruleLabels: {
      "no-spectral-color": "No spectral colors",
      "no-dark-variant": "No dark: variants",
    },
  });

  it("opens with the total and distinct-file count", () => {
    const lines = renderHuman(multiRuleRun, plainAnsi).split("\n");
    expect(lines[0]).toBe("Color lint: 4 violations in 2 files");
    expect(lines[1]).toBe("");
  });

  it("lists one line per triggered rule, designer label, descending count, right-aligned", () => {
    const lines = renderHuman(multiRuleRun, plainAnsi).split("\n");
    expect(lines[2]).toBe("  3  No spectral colors");
    expect(lines[3]).toBe("  1  No dark: variants");
  });

  it("summary counts agree with the detail listing's per-rule counts", () => {
    const out = renderHuman(multiRuleRun, plainAnsi);
    expect(out).toContain("No spectral colors (3)");
    expect(out).toContain("No dark: variants (1)");
    expect(out).toContain("4 violations found.");
  });

  it("uses singular wording for a single violation in a single file", () => {
    const run = makeRun({
      violations: [{ file: "src/a.tsx", line: 1, rule: "no-dark-variant", message: "w" }],
      ruleLabels: { "no-dark-variant": "No dark: variants" },
    });
    expect(renderHuman(run, plainAnsi).split("\n")[0]).toBe(
      "Color lint: 1 violation in 1 file",
    );
  });

  it("keeps the clean-run message with no summary table", () => {
    const out = renderHuman(makeRun(), plainAnsi);
    expect(out).toBe("✓ No color lint violations found.");
    expect(out).not.toContain("Color lint:");
  });
});
