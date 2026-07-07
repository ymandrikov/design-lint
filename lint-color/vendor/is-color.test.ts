import { describe, expect, it } from "vitest";
import { isColor, isNamedColor } from "./is-color.ts";

// Tailwind ships no is-color.test.ts at commit 9b0e8af; these cases pin the
// behavior the classification layer relies on (ADR 0002 — a re-vendor that
// changes is-color semantics fails here).
describe("isColor", () => {
  it("treats any #-prefixed token as a color (loose, matching Tailwind)", () => {
    expect(isColor("#fff")).toBe(true);
    expect(isColor("#123456")).toBe(true);
    expect(isColor("#ff000080")).toBe(true);
    // Intentionally loose: not a valid hex, but Tailwind compiles it as a color.
    expect(isColor("#zz")).toBe(true);
  });

  it("recognizes color function roots", () => {
    for (const v of [
      "rgb(0 0 0)", "rgba(0,0,0,1)", "hsl(0 0% 0%)", "hsla(0,0%,0%,1)",
      "hwb(0 0% 0%)", "color(display-p3 1 0 0)", "lab(50 40 -20)",
      "lch(50 80 30)", "oklab(0.5 0.1 -0.1)", "oklch(0.7 0.15 30)",
      "light-dark(white, black)", "color-mix(in srgb, red, blue)",
    ]) {
      expect(isColor(v), v).toBe(true);
    }
  });

  it("recognizes CSS named colors case-insensitively", () => {
    expect(isColor("red")).toBe(true);
    expect(isColor("RED")).toBe(true);
    expect(isColor("rebeccapurple")).toBe(true);
    expect(isColor("transparent")).toBe(true);
    expect(isColor("currentcolor")).toBe(true);
  });

  it("rejects non-colors", () => {
    expect(isColor("200px")).toBe(false);
    expect(isColor("url(hero.png)")).toBe(false);
    expect(isColor("var(--x)")).toBe(false);
    expect(isColor("inherit")).toBe(false);
    expect(isColor("solid")).toBe(false);
    expect(isColor("--red-500-rgb")).toBe(false);
  });
});

describe("isNamedColor", () => {
  it("matches only named colors, not hex or functions", () => {
    expect(isNamedColor("red")).toBe(true);
    expect(isNamedColor("#fff")).toBe(false);
    expect(isNamedColor("rgb(0 0 0)")).toBe(false);
  });
});
