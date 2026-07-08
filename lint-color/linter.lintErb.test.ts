import { beforeAll, describe, expect, it } from "vitest";
import { ansi } from "./helpers.js";
import { TAILWIND_COLOR_PREFIXES, TAILWIND_SPECTRAL_COLORS } from "./classify.ts";
import { createLinter } from "./linter.ts";
import { loadHerb, parseErb, erbParseErrors } from "./ast-erb.ts";

// herb needs its one-time async WASM init before any parse (C5). Mirrors the
// startup await index.ts does; every lintErbSource call below relies on it.
beforeAll(async () => {
  await loadHerb();
});

type Rules = Record<string, { enabled: boolean }>;

// Mirror linter.test.ts: a minimal token set where `primary` is the only
// semantic token and the spectral palette is the real Tailwind set, so
// `text-red-500` is a valid candidate that fires no-spectral-color while
// `text-primary` is clean.
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

const allRulesEnabled: Rules = { "no-spectral-color": { enabled: true } };

function lintErb(source: string, rules: Rules = allRulesEnabled) {
  return createLinter(rules, minimalTokens, ansi).lintErbSource(source, "test.html.erb");
}

function lintTsx(source: string, rules: Rules = allRulesEnabled) {
  return createLinter(rules, minimalTokens, ansi).lintTailwindSource(source, "test.tsx");
}

// T004 — static class-token extraction
describe("lintErbSource — static class tokens (US1)", () => {
  it("reports exactly one violation for a spectral class and none for a semantic token", () => {
    const source = `<div class="text-red-500">a</div>\n<div class="text-primary">b</div>`;
    const { violations } = lintErb(source);
    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBe(1);
    expect(violations[0].message).toContain("text-red-500");
  });

  it("does not flag the semantic token on its own", () => {
    expect(lintErb(`<div class="text-primary"></div>`).violations).toHaveLength(0);
  });

  it("matches .html.erb multi-token class attributes at the right line", () => {
    const source = `<p>x</p>\n<span class="p-4 text-red-500 flex">y</span>`;
    const { violations } = lintErb(source);
    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBe(2);
  });
});

// T005 — JSX↔ERB parity (SC-002)
describe("lintErbSource — parity with lintTailwindSource (SC-002)", () => {
  it("yields the same ruleId and message for the same offending class", () => {
    const erb = lintErb(`<div class="text-red-500"></div>`).violations;
    const tsx = lintTsx(`<div className="text-red-500" />`).violations;
    expect(erb).toHaveLength(1);
    expect(tsx).toHaveLength(1);
    expect(erb[0].ruleId).toBe(tsx[0].ruleId);
    expect(erb[0].message).toBe(tsx[0].message);
  });
});

// T011 — interpolation is a token boundary (SC-003, FR-005)
describe("lintErbSource — interpolation boundary (US2)", () => {
  it("lints the static token but skips the adjacent ERB group", () => {
    const { violations } = lintErb(`<div class="text-red-500 <%= dyn %>"></div>`);
    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain("text-red-500");
  });

  it("emits nothing when interpolation splits a single token", () => {
    expect(lintErb(`<div class="text-<%= shade %>-500"></div>`).violations).toHaveLength(0);
  });

  it("emits nothing for a class wrapped in silent ERB control flow", () => {
    expect(
      lintErb(`<div class="<% if x %>text-red-500<% end %>"></div>`).violations,
    ).toHaveLength(0);
  });
});

// T012 — suppression via <%# color-lint-ignore %>
describe("lintErbSource — suppression (D5)", () => {
  it("suppresses a violation on the ignored line and records the ignore", () => {
    const result = lintErb(`<div class="text-red-500"><%# color-lint-ignore %></div>`);
    expect(result.violations).toHaveLength(0);
    expect(result.ignores).toEqual([1]);
  });
});

// T013 — malformed template is crash-resistant (SC-005, FR-006)
describe("lintErbSource — malformed templates (US2)", () => {
  it("does not throw and still lints the recovered content", () => {
    const source = `<div class="text-red-500"><span></div>`;
    expect(() => lintErb(source)).not.toThrow();
    expect(lintErb(source).violations).toHaveLength(1);
  });

  it("surfaces parse errors via recursiveErrors without aborting", () => {
    const errors = erbParseErrors(parseErb(`<div class="text-red-500"><span></div>`));
    expect(errors.length).toBeGreaterThan(0);
  });

  it("keeps a valid sibling source fully lintable after a malformed one", () => {
    lintErb(`<div class="text-red-500"><span></div>`);
    const sibling = lintErb(`<div class="text-red-500"></div>`);
    expect(sibling.violations).toHaveLength(1);
  });
});
