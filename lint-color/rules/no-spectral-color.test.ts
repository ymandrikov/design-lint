import { describe, expect, it } from "vitest";
import { ansi, type CheckTokenFn } from "../helpers.js";
import {
  TAILWIND_COLOR_PREFIXES,
  TAILWIND_SPECTRAL_COLORS,
  runTokenRuleOnSource,
} from "../shared.js";

const { checkToken } = (await import("./no-spectral-color.js")) as {
  checkToken: CheckTokenFn;
};

const baseTokens = {
  spectralSet: TAILWIND_SPECTRAL_COLORS,
  colorPrefixes: TAILWIND_COLOR_PREFIXES,
  semanticSet: new Set(["primary"]),
};

const lint = (source: string, ruleConfig: Record<string, unknown> = {}) =>
  runTokenRuleOnSource(checkToken, source, baseTokens, ansi, ruleConfig);

const noSpectralColor = {
  description: "No spectral (palette) Tailwind color classes (e.g. bg-red-500)",
  replacement: {
    text: [{ "green-400...600": "success-content" }],
    bg: [{ "green-100...200": "success-weak" }, { "green-500": "success" }],
  },
};

describe("no-spectral-color", () => {
  describe("violations", () => {
    it("reports bg-red-500", () => {
      const el = `<div className="bg-red-500" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("bg-red-500");
    });

    it("reports text-blue-200", () => {
      const el = `<div className="text-blue-200" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("text-blue-200");
    });

    it("reports border-slate-300", () => {
      const el = `<div className="border-slate-300" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("border-slate-300");
    });

    it("reports ring-offset-blue-200 (compound prefix)", () => {
      const el = `<div className="ring-offset-blue-200" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("ring-offset-blue-200");
    });

    it("reports divide-green-100", () => {
      const el = `<div className="divide-green-100" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("divide-green-100");
    });

    it("message includes semantic token hint when scale is in range", () => {
      const el = `<div className="text-green-500" />`;
      const result = lint(el);
      expect(result[0]).toContain("text-green-500");
    });

    it("message includes hint for lower bound of range", () => {
      const el = `<div className="bg-green-100" />`;
      const result = lint(el);
      expect(result[0]).toContain("bg-green-100");
    });

    it("message includes hint for upper bound of range", () => {
      const el = `<div className="bg-green-200" />`;
      const result = lint(el);
      expect(result[0]).toContain("bg-green-200");
    });

    it("message includes no hint when scale is outside all ranges", () => {
      const el = `<div className="bg-green-700" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("bg-green-700");
    });

    it("message includes no hint when prefix has no replacement entry", () => {
      const el = `<div className="border-green-500" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("border-green-500");
    });
  });

  describe("non-violations", () => {
    it("allows a semantic token (no numeric scale)", () => {
      const el = `<div className="bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows a spectral name without a scale (e.g. text-red)", () => {
      const el = `<div className="text-red" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows a non-color utility that shares a color prefix (text-sm)", () => {
      const el = `<div className="text-sm" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows a non-color utility that shares a color prefix (bg-cover)", () => {
      const el = `<div className="bg-cover" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });
  });

  describe("replacing", () => {
    it("replaces bg-green-500 with bg-success", () => {
      const el = `<div className="text-green-400" />`;
      const result = lint(el, noSpectralColor);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("text-green-400");
      expect(result[0]).toContain("text-success-content");
    });

    it("replaces bg-green-500 with bg-success", () => {
      const el = `<div className="text-green-600" />`;
      const result = lint(el, noSpectralColor);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("text-green-600");
      expect(result[0]).toContain("text-success-content");
    });

    it("replaces bg-green-500 with bg-success", () => {
      const el = `<div className="bg-green-500" />`;
      const result = lint(el, noSpectralColor);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("bg-green-500");
      expect(result[0]).toContain("bg-success");
    });

    it("replaces bg-green-500 with bg-success", () => {
      const el = `<div className="bg-blue-500" />`;
      const result = lint(el, noSpectralColor);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("bg-blue-500");
      expect(result[0]).not.toContain("try");
    });
  });

  describe("escaping", () => {
    it("skips lines with color-lint-ignore", () => {
      const el = `<div className="bg-red-500" /> {/* color-lint-ignore */}`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });
  });
});
