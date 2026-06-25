import { describe, expect, it } from "vitest";
import { ansi, type CheckTokenFn } from "../helpers.js";
import { runTokenRuleOnSource } from "../shared.js";

const { checkToken } = (await import("./no-opacity-modifier.js")) as {
  checkToken: CheckTokenFn;
};

const colorPrefixes = ["bg", "text", "border", "ring"];
const tokens = { colorPrefixes };

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

    it("allows bg-primary/auto (non-numeric slash suffix)", () => {
      const el = `<div className="bg-primary/auto" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows text-sm (not a color token)", () => {
      const el = `<div className="text-sm" />`;
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
