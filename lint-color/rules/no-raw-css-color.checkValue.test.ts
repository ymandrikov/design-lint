import { describe, expect, it } from "vitest";
import { ansi } from "../helpers.js";

const { checkValue } = (await import("./no-raw-css-color.js")) as {
  checkValue: (value: string, ctx: { ansi: typeof ansi }) => string | null;
};

const check = (value: string) => checkValue(value, { ansi });

describe("no-raw-css-color checkValue (declaration-value inspection)", () => {
  describe("raw colors", () => {
    it("flags a 6-digit hex", () => {
      expect(check("#ff0000")).toContain("#ff0000");
    });

    it("flags a 3-digit hex", () => {
      expect(check("#f00")).toContain("#f00");
    });

    it("flags an 8-digit hex", () => {
      expect(check("#ff000080")).toContain("#ff000080");
    });

    it("flags rgb()", () => {
      expect(check("rgb(255, 0, 0)")).toContain("rgb(");
    });

    it("flags oklch()", () => {
      expect(check("oklch(0.7 0.15 30)")).toContain("oklch(");
    });

    it("flags a raw color mixed among other value tokens", () => {
      expect(check("1px solid #abcdef")).toContain("#abcdef");
    });

    it("flags a CSS named color (issue 03 — one color definition everywhere)", () => {
      expect(check("red")).toContain("red");
    });

    it("flags a named color mixed among other value tokens", () => {
      expect(check("1px solid black")).toContain("black");
    });

    it("flags color-mix()", () => {
      expect(check("color-mix(in srgb, red, blue)")).toContain("color-mix(");
    });

    // is-color is intentionally loose: any `#`-prefixed token is a color, so an
    // invalid-length hex is flagged too (Tailwind treats it as a color as well).
    it("flags a 5-digit hex (is-color is loose)", () => {
      expect(check("#abcde")).toContain("#abcde");
    });

    it("flags a 7-digit hex (is-color is loose)", () => {
      expect(check("#abcdef0")).toContain("#abcdef0");
    });
  });

  describe("not raw colors", () => {
    it("ignores a var() token reference", () => {
      expect(check("var(--color-primary)")).toBeNull();
    });

    it("ignores url(#gradientId) — the #id is a reference, not a color", () => {
      expect(check("url(#gradientId)")).toBeNull();
    });

    it("ignores a plain length value", () => {
      expect(check("1rem")).toBeNull();
    });

    it("ignores a non-color keyword (inherit is not a named color)", () => {
      expect(check("inherit")).toBeNull();
    });

    it("ignores a non-color keyword (solid)", () => {
      expect(check("solid")).toBeNull();
    });
  });
});
