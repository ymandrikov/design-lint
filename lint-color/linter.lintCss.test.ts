import { describe, expect, it } from "vitest";
import { ansi } from "./helpers.js";
import { TAILWIND_COLOR_PREFIXES, TAILWIND_SPECTRAL_COLORS } from "./shared.js";
import { createLinter } from "./linter.js";

const RAW_CSS_RULE_ID = 2;
const SPECTRAL_RULE_ID = 4;

const minimalTokens = {
  colorPrefixes: TAILWIND_COLOR_PREFIXES,
  semanticSet: new Set(["primary", "muted"]),
  spectralSet: TAILWIND_SPECTRAL_COLORS,
  uiComponents: new Set<string>(),
  isValidTailwindCandidate: () => true,
};

type Rules = Record<string, { enabled: boolean }>;

const allEnabled: Rules = {
  "no-raw-css-color": { enabled: true },
  "no-spectral-color": { enabled: true },
};

function lintCss(source: string, isExempt = false, rules: Rules = allEnabled) {
  return createLinter(rules, minimalTokens, ansi).lintCssSource(source, isExempt);
}

describe("lintCssSource — raw color detection on declaration values", () => {
  it("flags a raw hex declaration value with line + ruleId + message", () => {
    const { violations } = lintCss(".card {\n  color: #ff0000;\n}");
    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBe(2);
    expect(violations[0].ruleId).toBe(RAW_CSS_RULE_ID);
    expect(violations[0].message).toContain("#ff0000");
  });

  it("does NOT flag a hex-shaped id selector (finding #7)", () => {
    const { violations } = lintCss("#fed {\n  color: var(--color-primary);\n}");
    expect(violations).toHaveLength(0);
  });

  it("does NOT flag url(#id) references (finding #8)", () => {
    const { violations } = lintCss(".icon {\n  fill: url(#gradientId);\n}");
    expect(violations).toHaveLength(0);
  });

  // is-color is intentionally loose (issue 03): any `#`-prefixed token is a
  // color, matching Tailwind — so an invalid-length hex is flagged too.
  it("flags a 5-digit hex value (is-color is loose)", () => {
    const { violations } = lintCss(".x {\n  color: #abcde;\n}");
    expect(violations).toHaveLength(1);
  });

  it("flags a 7-digit hex value (is-color is loose)", () => {
    const { violations } = lintCss(".x {\n  color: #abcdef0;\n}");
    expect(violations).toHaveLength(1);
  });

  it("flags a CSS named color (issue 03 — color: red)", () => {
    const { violations } = lintCss(".x {\n  color: red;\n}");
    expect(violations).toHaveLength(1);
  });

  it("allows a var(--color-*) token value", () => {
    const { violations } = lintCss(".x {\n  color: var(--color-primary);\n}");
    expect(violations).toHaveLength(0);
  });

  it("flags rgb() function values", () => {
    const { violations } = lintCss(".x {\n  background: rgb(255, 0, 0);\n}");
    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBe(2);
  });
});

describe("lintCssSource — @apply pipeline", () => {
  it("flags a spectral color in @apply", () => {
    const { violations } = lintCss(".card {\n  @apply bg-red-500;\n}");
    const spectral = violations.filter((v) => v.ruleId === SPECTRAL_RULE_ID);
    expect(spectral).toHaveLength(1);
    expect(spectral[0].line).toBe(2);
    expect(spectral[0].message).toContain("bg-red-500");
  });

  it("allows a semantic token in @apply", () => {
    const { violations } = lintCss(".card {\n  @apply bg-primary;\n}");
    expect(violations).toHaveLength(0);
  });
});

describe("lintCssSource — ignore directive", () => {
  it("suppresses a same-line raw color and counts the ignore", () => {
    const { violations, ignores } = lintCss(
      ".x {\n  color: #ff0000; /* color-lint-ignore */\n}",
    );
    expect(violations).toHaveLength(0);
    expect(ignores).toEqual([2]);
  });

  it("does not suppress a violation on a different line", () => {
    const { violations, ignores } = lintCss(
      ".x {\n  /* color-lint-ignore */\n  color: #ff0000;\n}",
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBe(3);
    expect(ignores).toEqual([2]);
  });
});

describe("lintCssSource — exempt files", () => {
  it("skips raw-color rules for exempt (color token) files", () => {
    const { violations } = lintCss(
      "@theme {\n  --color-primary: #ff0000;\n}",
      true,
    );
    expect(violations).toHaveLength(0);
  });
});

describe("lintCssSource — gating", () => {
  it("passes raw color when no-raw-css-color disabled", () => {
    const { violations } = lintCss(".x {\n  color: #ff0000;\n}", false, {
      "no-raw-css-color": { enabled: false },
    });
    expect(violations).toHaveLength(0);
  });
});
