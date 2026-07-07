import { describe, expect, it } from "vitest";
import { ansi, runTokenRuleOnSource, type CheckTokenFn } from "../helpers.js";
import {
  TAILWIND_COLOR_PREFIXES,
  TAILWIND_SPECTRAL_COLORS,
} from "../classify.ts";

const { checkToken } = (await import("./token-constraints.js")) as {
  checkToken: CheckTokenFn;
};

const defaultSemanticTokens = [
  "primary",
  "primary-hover",
  "muted",
  "muted-foreground",
  "foreground",
  "border",
  "input",
  "ring",
  "link",
  "link-hover",
  "warning",
  "warning-foreground",
];

function lint(
  source: string,
  ruleConfig: Record<string, unknown> = tokenConstraintsConfig,
  semanticTokens = defaultSemanticTokens,
) {
  const tokens = {
    colorPrefixes: TAILWIND_COLOR_PREFIXES,
    semanticSet: new Set(semanticTokens),
    spectralSet: TAILWIND_SPECTRAL_COLORS,
  };
  return runTokenRuleOnSource(checkToken, source, tokens, ansi, ruleConfig);
}

const tokenConstraintsConfig = {
  description: "Color class violates token constraints",
  allowed: {
    text: ["*foreground*", "*-content*", "primary", "link*"],
    border: ["border*", "input", "ring"],
    "hover:": ["*-hover"],
  },
  denied: {
    "*": ["*-foreground", "*-content"],
  },
};

describe("token-constraints", () => {
  describe("violations", () => {
    it("reports text-muted (not in text allow list)", () => {
      const el = `<div className="text-muted" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
    });

    it("reports text-warning (not in text allow list)", () => {
      const el = `<div className="text-warning" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
    });

    it("reports border-primary (not in border allow list)", () => {
      const el = `<div className="border-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
    });

    it("reports bg-muted-foreground (matches *-foreground in deny)", () => {
      const el = `<div className="bg-muted-foreground" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
    });

    // hover: tokens must also match allowed["hover:"] after clearing the prefix allow list
    it("reports hover:text-primary (passes allow list but lacks -hover suffix)", () => {
      const el = `<div className="hover:text-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
    });

    it("reports hover:bg-muted (passes deny but lacks -hover suffix)", () => {
      const el = `<div className="hover:bg-muted" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
    });

    // Compound hover variants are hover states too — the -hover constraint
    // applies to group-hover:/peer-hover: exactly as to a bare hover:.
    it("reports group-hover:text-primary (compound hover variant)", () => {
      const el = `<div className="group-hover:text-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
    });
  });

  describe("non-violations", () => {
    it("allows text-foreground (matches *foreground*)", () => {
      const el = `<div className="text-foreground" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows text-muted-foreground (matches *foreground*)", () => {
      const el = `<div className="text-muted-foreground" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows text-primary (exact match in allow list)", () => {
      const el = `<div className="text-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows text-link (matches link*)", () => {
      const el = `<div className="text-link" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows border-border (matches border*)", () => {
      const el = `<div className="border-border" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows border-input (exact match)", () => {
      const el = `<div className="border-input" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows border-ring (exact match)", () => {
      const el = `<div className="border-ring" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows bg-primary (not in deny list)", () => {
      const el = `<div className="bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows bg-muted (not in deny list)", () => {
      const el = `<div className="bg-muted" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    // link-hover matches "link*" in the text allow list AND "*-hover" in allowed["hover:"]
    it("allows hover:text-link-hover (clears allow list and hover constraint)", () => {
      const el = `<div className="hover:text-link-hover" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    // v1.1 — the hover check is driven by parsed Tailwind variants, not a
    // "hover:" substring sniff. A literal "hover:" buried inside an arbitrary
    // variant's bracket group is NOT a hover variant, so the -hover suffix
    // constraint must not fire.
    it("does not trigger the hover constraint on a bracket-embedded 'hover:'", () => {
      const el = `<div className="[@media(hover:hover)]:text-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows a non-color utility like rounded-md", () => {
      const el = `<div className="rounded-md" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows a token whose color part is not in the semantic set", () => {
      const el = `<div className="bg-cover" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });
  });

  describe("non-violations — config tokenConstraintsConfig", () => {
    it("allows text-primary-foreground with a narrower text allow list", () => {
      const el = `<div className="text-primary-foreground" />`;
      const result = lint(el, { allowed: { text: ["*foreground*"] } }, [
        "primary",
        "primary-foreground",
      ]);
      expect(result).toHaveLength(0);
    });

    it("text allow list shields text-muted-foreground from the deny list", () => {
      const el = `<div className="text-muted-foreground" />`;
      const result = lint(
        el,
        {
          allowed: { text: ["*foreground*"] },
          denied: { "*": ["*-foreground"] },
        },
        ["muted", "muted-foreground"],
      );
      expect(result).toHaveLength(0);
    });

    it("reports text-primary when allow list is narrowed to *foreground* only", () => {
      const el = `<div className="text-primary" />`;
      const result = lint(el, { allowed: { text: ["*foreground*"] } }, [
        "primary",
        "primary-foreground",
      ]);
      expect(result).toHaveLength(1);
    });

    it("reports bg-muted-foreground when bg has no allow list (falls through to deny)", () => {
      const el = `<div className="bg-muted-foreground" />`;
      const result = lint(
        el,
        {
          allowed: { text: ["*foreground*"] },
          denied: { "*": ["*-foreground"] },
        },
        ["muted", "muted-foreground"],
      );
      expect(result).toHaveLength(1);
    });
  });

  describe("escaping", () => {
    it("skips lines with color-lint-ignore", () => {
      const el = `<div className="text-primary" /> {/* color-lint-ignore */}`;
      const result = lint(el, { allowed: { text: ["*foreground*"] } }, [
        "primary",
        "primary-foreground",
      ]);
      expect(result).toHaveLength(0);
    });
  });
});
