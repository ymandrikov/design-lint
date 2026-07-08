import { describe, expect, it } from "vitest";
import { ansi, type CheckTokenFn } from "../helpers.js";
import { runTokenRuleOnSource } from "../helpers.js";
import { createLinter } from "../linter.ts";

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

  // T016 (INV-2) — the rule's verdict on a KEPT candidate is unchanged. bg-black
  // (default-palette color the color-only oracle rejects) and a typo remain
  // flagged exactly as before the namespace feature.
  describe("preservation (INV-2) — genuine problems still flagged", () => {
    it("bg-black — a color the color-only oracle rejects stays flagged", () => {
      const el = `<div className="bg-black" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("black is not defined");
    });

    it("a typo behind a color prefix (text-accnt) stays flagged", () => {
      const el = `<div className="text-accnt" />`;
      expect(lint(el)).toHaveLength(1);
    });
  });
});

// T013 — the bucket-3 root cause and its fix. no-undefined-token flags text-sm
// on its own (a color-token-only oracle rejects the size utility); the linter's
// non-color filter suppresses it once a namespace-complete resolver is present.
describe("no-undefined-token — non-color filter regression (bucket-3)", () => {
  // Color-only oracle: only real color tokens resolve; size utilities do not.
  const oracle = (tok: string) => tok === "text-primary" || tok === "bg-primary";
  const baseTokens = {
    colorPrefixes: ["bg", "text", "shadow", "border"],
    semanticSet: new Set(["primary"]),
    spectralSet: new Set<string>(),
    isValidTailwindCandidate: oracle,
  };
  const rules = { "no-undefined-token": { enabled: true } };
  const source = `<div className="text-sm" />`;

  it("without a resolver, text-sm is falsely flagged", () => {
    const v = createLinter(rules, baseTokens, ansi).lintTailwindSource(source).violations;
    expect(v).toHaveLength(1);
  });

  it("with a namespace-complete resolver, text-sm produces no finding", () => {
    const tokens = {
      ...baseTokens,
      resolveNamespaceKind: (base: string) =>
        base === "text-sm" ? ("non-color" as const) : ("color" as const),
    };
    const v = createLinter(rules, tokens, ansi).lintTailwindSource(source).violations;
    expect(v).toHaveLength(0);
  });
});
