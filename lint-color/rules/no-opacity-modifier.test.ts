import { describe, expect, it } from "vitest";
import { ansi, type CheckTokenFn } from "../helpers.js";
import { runTokenRuleOnSource } from "../shared.js";

const { checkToken } = (await import("./no-opacity-modifier.js")) as {
  checkToken: CheckTokenFn;
};

const colorPrefixes = ["bg", "text", "border", "ring"];
const tokens = {
  colorPrefixes,
  // The rule now gates on classifyColorPart, so it needs the token vocabulary
  // to decide whether the base is actually a color.
  semanticSet: new Set(["primary", "foreground", "input"]),
  spectralSet: new Set(["red", "green", "blue"]),
};

const lint = (source: string) =>
  runTokenRuleOnSource(checkToken, source, tokens, ansi);

describe("no-opacity-modifier", () => {
  describe("violations", () => {
    it("reports bg-primary/50", () => {
      const el = `<div className="bg-primary/50" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("bg-primary/50");
    });

    it("reports text-foreground/75", () => {
      const el = `<div className="text-foreground/75" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("text-foreground/75");
    });

    it("reports border-input/20", () => {
      const el = `<div className="border-input/20" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("border-input/20");
    });

    it("reports ring-primary/10", () => {
      const el = `<div className="ring-primary/10" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("ring-primary/10");
    });

    it("reports hover:bg-primary/50", () => {
      const el = `<div className="hover:bg-primary/50" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("bg-primary/50");
    });

    // finding #3 — arbitrary opacity previously slipped past the numeric-only gate.
    it("reports bg-primary/[0.5] (arbitrary opacity)", () => {
      const el = `<div className="bg-primary/[0.5]" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("bg-primary/[0.5]");
    });

    // finding #3 — var-shorthand opacity (Tailwind v4) also bypassed the old gate.
    it("reports bg-primary/(--alpha) (var shorthand opacity)", () => {
      const el = `<div className="bg-primary/(--alpha)" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("bg-primary/(--alpha)");
    });

    // Any non-null Modifier on a real color class fires (PRD locked decision),
    // not only numeric ones. "/auto" isn't valid Tailwind opacity anyway.
    it("reports bg-primary/auto (any modifier on a color class)", () => {
      const el = `<div className="bg-primary/auto" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("bg-primary/auto");
    });

    // Tailwind keyword colors (black/white/transparent/current) are colors too,
    // so opacity on them must fire — they have no numeric shade to classify by.
    it("reports bg-black/50 (static keyword color)", () => {
      const el = `<div className="bg-black/50" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("bg-black/50");
    });

    it("reports text-white/70 (static keyword color)", () => {
      const el = `<div className="text-white/70" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("text-white/70");
    });

    it("reports all issues", () => {
      const el = `<div className={"bg-primary/50 text-foreground/75 border-input/20 ring-primary/10"} />`;
      const result = lint(el);
      expect(result).toHaveLength(4);
      expect(result[0]).toContain("bg-primary/50");
      expect(result[1]).toContain("text-foreground/75");
      expect(result[2]).toContain("border-input/20");
      expect(result[3]).toContain("ring-primary/10");
    });
  });

  describe("non-violations", () => {
    it("allows bg-primary (no modifier)", () => {
      const el = `<div className="bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows w-1/2 (non-color prefix with slash)", () => {
      const el = `<div className="w-1/2" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows text-sm (not a color token)", () => {
      const el = `<div className="text-sm" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    // finding #3 — line-height Modifier on a font-size utility is not opacity.
    it("allows text-sm/6 (line-height Modifier, not a color)", () => {
      const el = `<div className="text-sm/6" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows text-lg/[1.4] (arbitrary line-height, not a color)", () => {
      const el = `<div className="text-lg/[1.4]" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    // A trailing-slash typo has an empty Modifier, not a real one — don't fire.
    it("allows bg-primary/ (trailing slash, empty Modifier)", () => {
      const el = `<div className="bg-primary/" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });
  });

  describe("escaping", () => {
    it("skips lines with color-lint-ignore", () => {
      const el = `<div className="bg-primary/50" /> {/* color-lint-ignore */}`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });
  });
});
