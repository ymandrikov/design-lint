import { describe, expect, it } from "vitest";
import { ansi, type CheckTokenFn } from "../helpers.js";
import {
  TAILWIND_COLOR_PREFIXES,
  TAILWIND_SPECTRAL_COLORS,
  runTokenRuleOnSource,
} from "../shared.js";

const { checkToken } = (await import("./no-var-color.js")) as {
  checkToken: CheckTokenFn;
};

const baseTokens = {
  spectralSet: TAILWIND_SPECTRAL_COLORS,
  colorPrefixes: TAILWIND_COLOR_PREFIXES,
  semanticSet: new Set(["primary"]),
};

const lint = (el: string) => runTokenRuleOnSource(checkToken, el, baseTokens, ansi);

describe("no-var-color", () => {
  describe("violations — CSS variable behind a color prefix", () => {
    it("reports the v4 var shorthand (bg-(--color-primary))", () => {
      const result = lint(`<div className="bg-(--color-primary)" />`);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("bg-(--color-primary)");
      // names the utility-class alternative, not a CSS variable
      expect(result[0]).toContain("bg-");
    });

    it("reports a var() in an arbitrary value (bg-[var(--color-primary)])", () => {
      const result = lint(`<div className="bg-[var(--color-primary)]" />`);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("bg-[var(--color-primary)]");
    });

    it("reports a color:-hinted var reference (text-[color:var(--x)])", () => {
      const result = lint(`<div className="text-[color:var(--x)]" />`);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("text-");
    });

    it("preserves an underscore in a var name (bg-[var(--my_var)])", () => {
      // Clean var reference — a var verdict, so no-var-color fires.
      expect(lint(`<div className="bg-[var(--my_var)]" />`)).toHaveLength(1);
    });
  });

  describe("non-violations", () => {
    it("does not fire on a var reference with a literal fallback (owned by no-raw-css-color)", () => {
      // bg-[var(--x,red)] classifies raw, not var — no double-report.
      expect(lint(`<div className="bg-[var(--x,red)]" />`)).toHaveLength(0);
    });

    it("allows a semantic utility form (bg-primary)", () => {
      expect(lint(`<div className="bg-primary" />`)).toHaveLength(0);
    });

    it("does not fire on a raw hex arbitrary value (owned by no-raw-css-color)", () => {
      expect(lint(`<div className="bg-[#ff0000]" />`)).toHaveLength(0);
    });

    it("does not fire on a spectral color (bg-red-500)", () => {
      expect(lint(`<div className="bg-red-500" />`)).toHaveLength(0);
    });

    it("does not fire on an explicit non-color var typehint (bg-(length:--x))", () => {
      expect(lint(`<div className="bg-(length:--x)" />`)).toHaveLength(0);
    });
  });

  describe("escaping", () => {
    it("skips lines with color-lint-ignore", () => {
      const el = `<div className="bg-(--color-primary)" /> {/* color-lint-ignore */}`;
      expect(lint(el)).toHaveLength(0);
    });
  });
});
