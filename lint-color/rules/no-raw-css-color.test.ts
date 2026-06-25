import { describe, expect, it } from "vitest";
import { ansi, type CheckTokenFn } from "../helpers.js";
import { runTokenRuleOnSource } from "../shared.js";

const { checkToken } = (await import("./no-raw-css-color.js")) as {
  checkToken: CheckTokenFn;
};

const lint = (el: string) => runTokenRuleOnSource(checkToken, el, {}, ansi);

describe("no-raw-css-color", () => {
  describe("violations", () => {
    it("reports 6-digit hex in arbitrary value", () => {
      const el = `<div className="bg-[#ff0000]" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("#ff0000");
    });

    it("reports 3-digit hex in arbitrary value", () => {
      const el = `<div className="text-[#f00]" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("#f00");
    });

    it("reports 8-digit hex with alpha in arbitrary value", () => {
      const el = `<div className="border-[#ff000080]" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("#ff000080");
    });

    it("reports rgb() in arbitrary value", () => {
      const el = `<div className="ring-[rgb(255,0,0)]" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("rgb(");
    });

    it("reports rgba() in arbitrary value", () => {
      const el = `<div className="bg-[rgba(255,0,0,0.5)]" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("rgba(");
    });

    it("reports hsl() in arbitrary value", () => {
      const el = `<div className="text-[hsl(0,100%,50%)]" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("hsl(");
    });

    it("reports hsla() in arbitrary value", () => {
      const el = `<div className="bg-[hsla(0,100%,50%,0.5)]" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("hsla(");
    });

    it("reports oklch() in arbitrary value", () => {
      // Tailwind uses underscores for spaces inside arbitrary values
      const el = `<div className="text-[oklch(0.7_0.15_30)]" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("oklch(");
    });

    it("reports oklab() in arbitrary value", () => {
      const el = `<div className="text-[oklab(0.5_0.1_-0.1)]" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("oklab(");
    });

    it("reports lch() in arbitrary value", () => {
      const el = `<div className="text-[lch(50_80_30)]" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("lch(");
    });

    it("reports lab() in arbitrary value", () => {
      const el = `<div className="text-[lab(50_40_-20)]" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("lab(");
    });

    it("reports hwb() in arbitrary value", () => {
      const el = `<div className="text-[hwb(0_0%_0%)]" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("hwb(");
    });

    it("reports raw hex in style attribute", () => {
      const el = `<div style={{ backgroundColor: "#f00" }} />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("#f00");
    });
  });

  describe("non-violations", () => {
    it("allows a semantic token (no arbitrary value)", () => {
      const el = `<div className="bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows a CSS variable in arbitrary value", () => {
      const el = `<div className="bg-[var(--color-primary)]" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows a non-color arbitrary value", () => {
      const el = `<div className="bg-[url('/img.png')]" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows a CSS variable in style attribute", () => {
      const el = `<div style={{ color: "var(--color-primary)" }} />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows a non-color style property", () => {
      const el = `<div style={{ fontSize: "1rem" }} />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("does not flag an invalid hex fragment (not a valid color)", () => {
      const el = `<div className="bg-[#zz]" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });
  });

  describe("escaping", () => {
    it("skips lines with color-lint-ignore", () => {
      const el = `<div className="bg-[#ff0000]" /> {/* color-lint-ignore */}`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });
  });
});
