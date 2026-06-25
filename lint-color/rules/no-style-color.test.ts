import { describe, expect, it } from "vitest";
import { ansi, makeReporter, type LintSourceFn } from "../helpers.js";

const { lintSource } = (await import("./no-style-color.js")) as {
  lintSource: LintSourceFn;
};

function lint(source: string) {
  const { found, report } = makeReporter();
  lintSource(source, "test.tsx", { report, ansi });
  return found;
}

describe("no-style-color", () => {
  describe("violations", () => {
    it("reports color in inline style prop", () => {
      const el = `<div style={{ color: "red" }} />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0].line).toBe(1);
      expect(result[0].message).toContain("color");
    });

    it("reports backgroundColor in inline style prop", () => {
      const el = `<div style={{ backgroundColor: "blue" }} />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0].message).toContain("backgroundColor");
    });

    it("reports color on a continuation line of a multi-line style block", () => {
      const el = `<div
  style={{
    color: "red",
  }}
/>`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0].line).toBe(3);
    });

    it("reports backgroundColor on a continuation line", () => {
      const el = `<div
  style={{
    fontWeight: "bold",
    backgroundColor: "blue",
  }}
/>`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0].line).toBe(4);
    });

    it("reports each offending property when both appear in the same block", () => {
      const el = `<div
  style={{
    color: "red",
    backgroundColor: "blue",
  }}
/>`;
      const result = lint(el);
      expect(result).toHaveLength(2);
      expect(result[0].message).toContain("color");
      expect(result[1].message).toContain("backgroundColor");
    });
  });

  describe("non-violations", () => {
    it("allows style props with no color properties", () => {
      const el = `<div style={{ fontWeight: "bold" }} />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows --color-* CSS custom properties inside style", () => {
      const el = `<div style={{ "--color-primary": "blue" }} />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows colorScheme (different property name)", () => {
      const el = `<div style={{ colorScheme: "dark" }} />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows color outside a style prop", () => {
      const el = `const styles = { color: "red" };`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows color appearing only in a string value", () => {
      const el = `<div style={{ fontFamily: "color-scheme-font" }} />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("handles nested braces without false positives", () => {
      const el = `<div style={{ transform: active ? { scale: 1 } : {} }} />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });
  });

  describe("escaping", () => {
    it("skips lines with color-lint-ignore", () => {
      const el = `<div style={{ color: "red" }} /> {/* color-lint-ignore */}`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });
  });
});
