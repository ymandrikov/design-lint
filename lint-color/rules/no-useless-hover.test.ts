import { describe, expect, it } from "vitest";
import { ansi, makeReporter, type LintSourceFn } from "../helpers.js";

const { lintSource } = (await import("./no-useless-hover.js")) as {
  lintSource: LintSourceFn;
};

function lint(source: string, ruleConfig: Record<string, unknown> = {}) {
  const { found, report } = makeReporter();
  lintSource(source, "test.tsx", {
    report,
    ansi,
    ruleConfig,
  } as Parameters<LintSourceFn>[2]);
  return found;
}

const noUselessHoverConfig = {
  description: "Don't use hover: on non-interactive elements",
  interactiveElements: ["tr", "td", "th"],
};

describe("no-useless-hover", () => {
  describe("violations", () => {
    it("reports hover: on a plain div", () => {
      const el = `<div className="hover:bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0].message).toContain("<div>");
    });

    it("reports hover: on a span", () => {
      const el = `<span className="hover:text-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
    });

    it("reports hover: on a p tag", () => {
      const el = `<p className="hover:bg-muted" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
    });

    it("reports the line number of the hover: token", () => {
      const el = `<div
  className="hover:bg-primary"
/>`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0].line).toBe(2);
    });
  });

  describe("non-violations", () => {
    it("allows hover: on <button>", () => {
      const el = `<button className="hover:bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows hover: on <a>", () => {
      const el = `<a className="hover:text-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows hover: on <Button> (shadcn component)", () => {
      const el = `<Button className="hover:bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows hover: on <TableRow> (intentional row highlight)", () => {
      const el = `<TableRow className="hover:bg-muted" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows hover: on <tr>", () => {
      const el = `<tr className="hover:bg-muted" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows hover: when onClick is present", () => {
      const el = `<div onClick={handler} className="hover:bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows hover: when role=button is present", () => {
      const el = `<div role="button" className="hover:bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows hover: when href is present", () => {
      const el = `<div href={url} className="hover:bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows hover: when tabIndex is present", () => {
      const el = `<div tabIndex={0} className="hover:bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows hover: on Radix .Trigger namespaced primitive", () => {
      const el = `<Dialog.Trigger className="hover:bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows hover: on Radix .Close namespaced primitive", () => {
      const el = `<Dialog.Close className="hover:bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });
  });

  describe("non-violations — config interactiveElements", () => {
    it("allows hover: on an element added via interactiveElements config", () => {
      const el = `<td className="hover:bg-muted" />`;
      const result = lint(el, noUselessHoverConfig);
      expect(result).toHaveLength(0);
    });

    it("allows hover: on <th> when th is in interactiveElements", () => {
      const el = `<th className="hover:bg-muted" />`;
      const result = lint(el, noUselessHoverConfig);
      expect(result).toHaveLength(0);
    });

    it("still reports on elements not in interactiveElements", () => {
      const el = `<div className="hover:bg-primary" />`;
      const result = lint(el, noUselessHoverConfig);
      expect(result).toHaveLength(1);
    });

    it("reports <td> when interactiveElements is empty", () => {
      const el = `<td className="hover:bg-muted" />`;
      const result = lint(el, { interactiveElements: [] });
      expect(result).toHaveLength(1);
    });
  });

  describe("escaping", () => {
    it("skips lines with color-lint-ignore", () => {
      const el = `<div className="hover:bg-primary" /> {/* color-lint-ignore */}`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });
  });
});
