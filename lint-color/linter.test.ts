import { describe, expect, it } from "vitest";
import { ansi } from "./helpers.js";
import { TAILWIND_COLOR_PREFIXES, TAILWIND_SPECTRAL_COLORS } from "./classify.ts";
import { createLinter } from "./linter.ts";

type Rules = Record<string, { enabled: boolean }>;

const minimalSemanticSet = new Set(["primary", "muted"]);
const minimalTokens = {
  colorPrefixes: TAILWIND_COLOR_PREFIXES,
  semanticSet: minimalSemanticSet,
  spectralSet: TAILWIND_SPECTRAL_COLORS,
  uiComponents: new Set(["Button"]),
  isValidTailwindCandidate: (tok: string) => {
    for (const p of TAILWIND_COLOR_PREFIXES) {
      if (tok.startsWith(p + "-")) {
        const colorPart = tok.slice(p.length + 1);
        if (colorPart.startsWith("[")) return true;
        const stem = colorPart.split("-")[0];
        return minimalSemanticSet.has(colorPart) || TAILWIND_SPECTRAL_COLORS.has(stem);
      }
    }
    return true;
  },
};

function checkTailwind(el: string, rules: Rules) {
  return createLinter(rules, minimalTokens, ansi).lintTailwindSource(el).violations;
}

// Same tokens plus a namespace resolver that classifies text-sm as non-color and
// everything else as color/unresolved — the shape index.ts wires in production.
function checkTailwindWithResolver(el: string, rules: Rules) {
  const tokens = {
    ...minimalTokens,
    resolveNamespaceKind: (base: string) =>
      base === "text-sm" ? ("non-color" as const) : ("color" as const),
  };
  return createLinter(rules, tokens, ansi).lintTailwindSource(el).violations;
}

// token-constraints needs an allow list to produce a violation — merge it into the rule config.
function checkWithConstraints(el: string, rules: Rules) {
  const merged = {
    "token-constraints": {
      allowed: { text: ["primary"] },
      denied: {},
      ...(rules["token-constraints"] ?? {}),
    },
  };
  return createLinter(merged, minimalTokens, ansi).lintTailwindSource(el).violations;
}

function checkStyle(el: string, rules: Rules) {
  return createLinter(rules, minimalTokens, ansi).lintStyleSource(el, "test.tsx").violations;
}

function checkHover(el: string, rules: Rules) {
  return createLinter(rules, minimalTokens, ansi).lintHoverSource(el, "test.tsx").violations;
}

function checkComponent(el: string, rules: Rules) {
  return createLinter(rules, minimalTokens, ansi).lintComponentSource(el, "test.tsx").violations;
}

function checkCss(line: string, rules: Rules) {
  return createLinter(rules, minimalTokens, ansi).lintCssSource(line, false).violations;
}

// Finding #5 — bracketed candidates must reach the pipeline uncorrupted.
// Before the bracket-aware splitter, normalizeTwToken split on the LAST ":",
// so an arbitrary value's inner colon mangled the token: "text-[x:bg-nope]"
// became "bg-nope]", which false-fired no-undefined-token with a garbage
// message. The base must be kept whole so the inner ":" is never a variant
// separator (out of scope: making rules FIRE on named colors in arbitrary
// values — that is de-corrupted only here).
describe("bracket-aware token splitting (finding #5)", () => {
  // no-raw-css-color is disabled here so these tests isolate SPLIT integrity;
  // that named colors in arbitrary values now FIRE (issue 03) is covered by
  // no-raw-css-color's own suite.
  const enabled = {
    "no-undefined-token": { enabled: true },
    "no-raw-css-color": { enabled: false },
  };

  it("does not corrupt an arbitrary value whose inner colon tail looks like a color class", () => {
    const el = `<div className="text-[x:bg-nope]" />`;
    expect(checkTailwind(el, enabled)).toHaveLength(0);
  });

  it("keeps text-[color:red] whole — no variant split on the inner colon", () => {
    const el = `<div className="text-[color:red]" />`;
    expect(checkTailwind(el, enabled)).toHaveLength(0);
  });

  it("still resolves a genuinely undefined token behind the same prefix", () => {
    const el = `<div className="text-nope" />`;
    expect(checkTailwind(el, enabled)).toHaveLength(1);
  });
});

// Quoted content inside an arbitrary value splits exactly as Tailwind splits it
// (vendored segment, ADR 0002): the quoted ":" is neither a variant separator
// nor corrupted into a garbage base.
describe("quote-aware token splitting (segment parity)", () => {
  const enabled = {
    "no-undefined-token": { enabled: true },
    "no-spectral-color": { enabled: true },
    "no-opacity-modifier": { enabled: true },
    "no-dark-variant": { enabled: true },
  };

  it("bg-[url('a:b.png')] passes end-to-end with no false violation", () => {
    const el = `<div className="bg-[url('a:b.png')]" />`;
    expect(checkTailwind(el, enabled)).toHaveLength(0);
  });

  it("a quoted '/' is not a Modifier — no opacity violation fires", () => {
    const el = `<div className="bg-[url('a/b.png')]" />`;
    expect(checkTailwind(el, enabled)).toHaveLength(0);
  });
});

// T009/T010 — the single non-color filter seam (FR-002/003): one dispatch point
// drops a non-color candidate from EVERY color rule; color/unresolved fan out.
describe("non-color filter seam (FR-003)", () => {
  // no-undefined-token would flag text-sm (minimalTokens' oracle rejects it) —
  // the resolver must suppress it before the rule runs.
  const allOn = {
    "no-undefined-token": { enabled: true },
    "no-spectral-color": { enabled: true },
    "token-constraints": { enabled: true },
  };

  it("a non-color candidate (text-sm) yields zero findings from every color rule", () => {
    const el = `<div className="text-sm" />`;
    expect(checkTailwindWithResolver(el, allOn)).toHaveLength(0);
  });

  it("without a resolver the filter is a no-op — text-sm still reaches the rules", () => {
    // minimalTokens has no resolveNamespaceKind: unit tests without the Tailwind
    // API are unaffected (mirrors the isValidTailwindCandidate null pattern).
    const el = `<div className="text-sm" />`;
    expect(checkTailwind(el, allOn)).toHaveLength(1);
  });

  it("a color candidate still fans out (bg-red-500 → spectral)", () => {
    const el = `<div className="bg-red-500" />`;
    expect(checkTailwindWithResolver(el, allOn)).toHaveLength(1);
  });

  it("an unresolved candidate is kept (typo bg-nope → undefined-token)", () => {
    // resolver returns "color" for non-text-sm here; the point is it is NOT
    // "non-color", so the candidate is not dropped.
    const el = `<div className="bg-nope" />`;
    expect(checkTailwindWithResolver(el, allOn)).toHaveLength(1);
  });
});

describe("linter gating — per-rule enable/disable via config", () => {
  describe("no-opacity-modifier", () => {
    const el = `<div className="bg-primary/50" />`;

    it("catches bg-primary/50 when enabled", () => {
      const result = checkTailwind(el, { "no-opacity-modifier": { enabled: true } });
      expect(result).toHaveLength(1);
    });

    it("passes bg-primary/50 when disabled", () => {
      const result = checkTailwind(el, { "no-opacity-modifier": { enabled: false } });
      expect(result).toHaveLength(0);
    });
  });

  describe("no-dark-variant", () => {
    const el = `<div className="dark:bg-primary" />`;

    it("catches dark:bg-primary when enabled", () => {
      const result = checkTailwind(el, { "no-dark-variant": { enabled: true } });
      expect(result).toHaveLength(1);
    });

    it("passes dark:bg-primary when disabled", () => {
      const result = checkTailwind(el, { "no-dark-variant": { enabled: false } });
      expect(result).toHaveLength(0);
    });
  });

  describe("no-spectral-color", () => {
    const el = `<div className="bg-red-500" />`;

    it("catches bg-red-500 when enabled", () => {
      const result = checkTailwind(el, { "no-spectral-color": { enabled: true } });
      expect(result).toHaveLength(1);
    });

    it("passes bg-red-500 when disabled", () => {
      const result = checkTailwind(el, { "no-spectral-color": { enabled: false } });
      expect(result).toHaveLength(0);
    });
  });

  describe("no-undefined-token", () => {
    const el = `<div className="text-primary-foreground" />`;

    it("catches text-primary-foreground when enabled", () => {
      const result = checkTailwind(el, { "no-undefined-token": { enabled: true } });
      expect(result).toHaveLength(1);
    });

    it("passes text-primary-foreground when disabled", () => {
      const result = checkTailwind(el, { "no-undefined-token": { enabled: false } });
      expect(result).toHaveLength(0);
    });
  });

  describe("token-constraints", () => {
    // allow list: text → ["primary"]; "muted" is semantic but not in the allow list → fires
    const el = `<div className="text-muted" />`;

    it("catches text-muted when enabled", () => {
      const result = checkWithConstraints(el, { "token-constraints": { enabled: true } });
      expect(result).toHaveLength(1);
    });

    it("passes text-muted when disabled", () => {
      const result = checkWithConstraints(el, { "token-constraints": { enabled: false } });
      expect(result).toHaveLength(0);
    });
  });

  describe("no-style-color", () => {
    const el = `<div style={{ color: "red" }} />`;

    it("catches inline color style when enabled", () => {
      const result = checkStyle(el, { "no-style-color": { enabled: true } });
      expect(result).toHaveLength(1);
    });

    it("passes inline color style when disabled", () => {
      const result = checkStyle(el, { "no-style-color": { enabled: false } });
      expect(result).toHaveLength(0);
    });
  });

  describe("no-useless-hover", () => {
    const el = `<div className="hover:bg-primary" />`;

    it("catches hover: on a div when enabled", () => {
      const result = checkHover(el, { "no-useless-hover": { enabled: true } });
      expect(result).toHaveLength(1);
    });

    it("passes hover: on a div when disabled", () => {
      const result = checkHover(el, { "no-useless-hover": { enabled: false } });
      expect(result).toHaveLength(0);
    });
  });

  describe("no-component-color-override", () => {
    const el = `<Button className="bg-primary" />`;

    it("catches color override on Button when enabled", () => {
      const result = checkComponent(el, { "no-component-color-override": { enabled: true } });
      expect(result).toHaveLength(1);
    });

    it("passes color override on Button when disabled", () => {
      const result = checkComponent(el, { "no-component-color-override": { enabled: false } });
      expect(result).toHaveLength(0);
    });
  });

  describe("no-raw-css-color", () => {
    const el = `<div className="bg-[#ff0000]" />`;

    it("catches raw hex in arbitrary value when enabled", () => {
      const result = checkTailwind(el, { "no-raw-css-color": { enabled: true } });
      expect(result).toHaveLength(1);
    });

    it("passes raw hex in arbitrary value when disabled", () => {
      const result = checkTailwind(el, { "no-raw-css-color": { enabled: false } });
      expect(result).toHaveLength(0);
    });
  });
});
