import { describe, expect, it } from "vitest";
import { ansi, type CheckTokenFn } from "../helpers.js";
import { runTokenRuleOnSource } from "../helpers.js";

const { checkToken } = (await import("./no-undefined-token.js")) as {
  checkToken: CheckTokenFn;
};

const colorPrefixes = ["bg", "text", "border"];
const semanticSet = new Set([
  "primary",
  "warning",
  "warning-muted",
  "danger",
  "success-content",
]);
const spectralSet = new Set(["red", "green", "blue", "slate"]);

function isValidTailwindCandidate(tok: string) {
  for (const p of colorPrefixes) {
    if (tok.startsWith(p + "-")) {
      const colorPart = tok.slice(p.length + 1);
      if (colorPart.startsWith("[")) return true;
      const stem = colorPart.split("-")[0];
      return semanticSet.has(colorPart) || spectralSet.has(stem);
    }
  }
  return true;
}

const tokens = { colorPrefixes, semanticSet, spectralSet, isValidTailwindCandidate };

const lint = (source: string) =>
  runTokenRuleOnSource(checkToken, source, tokens, ansi);

describe("no-undefined-token", () => {
  describe("violations", () => {
    it("reports a token not in the semantic set", () => {
      const el = `<div className="text-warning-foreground" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("warning-foreground");
    });

    it("message includes the token name and the add-token hint", () => {
      const el = `<div className="bg-danger-muted" />`;
      const result = lint(el);
      expect(result[0]).toContain("danger-muted");
      expect(result[0]).toContain("--color-danger-muted");
    });

    it("reports a token with a known stem but wrong suffix", () => {
      const el = `<div className="text-warning-typo" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("warning-typo");
    });

    it("reports a token whose stem has never been defined (text-secondary)", () => {
      const el = `<div className="text-secondary" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("secondary");
    });
  });

  describe("non-violations", () => {
    it("allows a fully defined semantic token", () => {
      const el = `<div className="text-warning" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows a spectral color (handled by no-spectral-color)", () => {
      const el = `<div className="bg-red-500" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows a token with no color prefix", () => {
      const el = `<div className="rounded-warning" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows a defined multi-segment token", () => {
      const el = `<div className="text-success-content" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });
  });

  describe("escaping", () => {
    it("skips lines with color-lint-ignore", () => {
      const el = `<div className="text-warning-foreground" /> {/* color-lint-ignore */}`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });
  });
});
