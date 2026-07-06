import { describe, expect, it } from "vitest";
import { ansi, type CheckTokenFn } from "../helpers.js";
import {
  TAILWIND_COLOR_PREFIXES,
  TAILWIND_SPECTRAL_COLORS,
  runTokenRuleOnSource,
} from "../shared.js";

const { checkToken } = (await import("./no-raw-css-color.js")) as {
  checkToken: CheckTokenFn;
};

const baseTokens = {
  spectralSet: TAILWIND_SPECTRAL_COLORS,
  colorPrefixes: TAILWIND_COLOR_PREFIXES,
  semanticSet: new Set(["primary"]),
};

const lint = (el: string) => runTokenRuleOnSource(checkToken, el, baseTokens, ansi);

describe("no-raw-css-color", () => {
  describe("violations — hex and color functions in arbitrary values", () => {
    it("reports 6-digit hex in arbitrary value", () => {
      const result = lint(`<div className="bg-[#ff0000]" />`);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("bg-[#ff0000]");
    });

    it("reports 3-digit hex in arbitrary value", () => {
      const result = lint(`<div className="text-[#f00]" />`);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("text-[#f00]");
    });

    it("reports 8-digit hex with alpha in arbitrary value", () => {
      const result = lint(`<div className="border-[#ff000080]" />`);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("border-[#ff000080]");
    });

    it("reports rgb() in arbitrary value", () => {
      const result = lint(`<div className="ring-[rgb(255,0,0)]" />`);
      expect(result).toHaveLength(1);
    });

    it("reports rgba() in arbitrary value", () => {
      const result = lint(`<div className="bg-[rgba(255,0,0,0.5)]" />`);
      expect(result).toHaveLength(1);
    });

    it("reports hsl() in arbitrary value", () => {
      expect(lint(`<div className="text-[hsl(0,100%,50%)]" />`)).toHaveLength(1);
    });

    it("reports oklch() with underscore-separated args", () => {
      // Tailwind uses underscores for spaces inside arbitrary values.
      expect(lint(`<div className="text-[oklch(0.7_0.15_30)]" />`)).toHaveLength(1);
    });

    it("reports oklab(), lch(), lab(), hwb()", () => {
      expect(lint(`<div className="text-[oklab(0.5_0.1_-0.1)]" />`)).toHaveLength(1);
      expect(lint(`<div className="text-[lch(50_80_30)]" />`)).toHaveLength(1);
      expect(lint(`<div className="text-[lab(50_40_-20)]" />`)).toHaveLength(1);
      expect(lint(`<div className="text-[hwb(0_0%_0%)]" />`)).toHaveLength(1);
    });
  });

  describe("violations — named colors and typehints (issue 03)", () => {
    it("reports a bare CSS named color (bg-[red])", () => {
      const result = lint(`<div className="bg-[red]" />`);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("bg-[red]");
    });

    it("reports a color: typehint with a named color (text-[color:red])", () => {
      const result = lint(`<div className="text-[color:red]" />`);
      expect(result).toHaveLength(1);
    });

    it("reports a var reference with a literal-color fallback (bg-[var(--x,red)])", () => {
      const result = lint(`<div className="bg-[var(--x,red)]" />`);
      expect(result).toHaveLength(1);
    });
  });

  describe("violations — arbitrary-property candidates (issue 05)", () => {
    it("reports a literal color behind a color property ([color:red])", () => {
      const result = lint(`<div className="[color:red]" />`);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("[color:red]");
    });

    it("reports a hex value ([background-color:#123])", () => {
      expect(lint(`<div className="[background-color:#123]" />`)).toHaveLength(1);
    });

    it("reports a custom-property color ([--my-color:red])", () => {
      expect(lint(`<div className="[--my-color:red]" />`)).toHaveLength(1);
    });

    it("fires behind a Tailwind variant (dark:[color:red])", () => {
      expect(lint(`<div className="dark:[color:red]" />`)).toHaveLength(1);
    });
  });

  describe("non-violations", () => {
    it("allows a semantic token (no arbitrary value)", () => {
      expect(lint(`<div className="bg-primary" />`)).toHaveLength(0);
    });

    it("allows a clean CSS variable in arbitrary value (owned by no-var-color)", () => {
      expect(lint(`<div className="bg-[var(--color-primary)]" />`)).toHaveLength(0);
    });

    it("allows the v4 var shorthand (owned by no-var-color)", () => {
      expect(lint(`<div className="bg-(--color-primary)" />`)).toHaveLength(0);
    });

    it("preserves an underscore in a var name — bg-[var(--my_var)] is not raw", () => {
      expect(lint(`<div className="bg-[var(--my_var)]" />`)).toHaveLength(0);
    });

    it("allows a url() arbitrary value", () => {
      expect(lint(`<div className="bg-[url('/img.png')]" />`)).toHaveLength(0);
    });

    it("allows an explicit non-color typehint (bg-[length:200px])", () => {
      expect(lint(`<div className="bg-[length:200px]" />`)).toHaveLength(0);
    });

    it("allows a non-color arbitrary property ([margin:4px], [display:grid])", () => {
      expect(lint(`<div className="[margin:4px]" />`)).toHaveLength(0);
      expect(lint(`<div className="[display:grid]" />`)).toHaveLength(0);
    });

    it("allows a clean var behind a color property (owned by no-var-color)", () => {
      expect(lint(`<div className="[color:var(--color-primary)]" />`)).toHaveLength(0);
    });

    it("does not scan style attribute values via the token pipeline", () => {
      // v1 (Change C): the token pipeline scans className/class only. A raw color
      // in a style prop is caught by no-style-color / no-component-color-override.
      expect(lint(`<div style={{ backgroundColor: "#f00" }} />`)).toHaveLength(0);
    });
  });

  describe("escaping", () => {
    it("skips lines with color-lint-ignore", () => {
      const el = `<div className="bg-[#ff0000]" /> {/* color-lint-ignore */}`;
      expect(lint(el)).toHaveLength(0);
    });
  });
});
