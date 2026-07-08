// End-to-end: run the CLI against fixtures/demo-app and assert on real output.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function runCli(target: string) {
  return spawnSync("node", [join(ROOT, "lint-color/index.ts"), target], {
    cwd: ROOT,
    encoding: "utf-8",
  });
}

// A throwaway target carrying only a colors.json with the given (possibly
// malformed) sourceDirectories value. Validation runs before any scan, so these
// cases never reach the Tailwind loader — no token CSS or source files needed.
function tempTargetWithSourceDirs(sourceDirectories: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "srcdirs-"));
  mkdirSync(join(dir, "design-system/lint"), { recursive: true });
  writeFileSync(
    join(dir, "design-system/lint/colors.json"),
    JSON.stringify({ colorTokenFiles: ["tokens.css"], sourceDirectories, rules: {} }),
  );
  return dir;
}

describe("CLI against fixtures/demo-app", () => {
  const result = runCli(join(ROOT, "fixtures/demo-app"));

  it("exits 1 when violations are found", () => {
    expect(result.status).toBe(1);
  });

  it("reports every rule exactly as seeded", () => {
    const out = result.stdout;

    // rule 1 — style prop color
    expect(out).toContain("No color or backgroundColor in style= props (1)");
    // rule 2 — raw colors (6): card.css hex + card.css named color + four
    // className arbitrary forms. The style literal `color: "#ff0000"` is no
    // longer double-flagged here (Change C: the token pipeline scans className
    // only) — it is still caught by rule 1 above.
    expect(out).toContain("No raw color values in component CSS. Use semantic tokens instead (6)");
    // named color in CSS is now raw (CSS path shares the vendored is-color)
    expect(out).toContain("Raw color value rebeccapurple");
    // arbitrary-value raw colors: named, var-with-literal-fallback, arb-property
    expect(out).toContain("bg-[red]");
    expect(out).toContain("bg-[var(--x,red)]");
    expect(out).toContain("[color:red]");
    // rule 3 — opacity modifier: numeric + arbitrary + var-shorthand (finding #3)
    // + static keyword color (bg-black/50). text-sm/6 (line-height) is seeded too
    // but must NOT fire — hence 4, not 5.
    expect(out).toContain("No opacity modifiers on color classes. Add a semantic token instead (4)");
    expect(out).toContain("bg-primary/50");
    expect(out).toContain("bg-primary/[0.5]");
    expect(out).toContain("bg-primary/(--alpha)");
    expect(out).toContain("bg-black/50");
    expect(out).not.toContain("text-sm/6");
    // rule 6 — no-var-color (3): var shorthand, color:-hinted var, arb-property var.
    // All reference a real semantic token yet still fire — one sanctioned spelling.
    // Count (3) pins that all three fire; the two prefixed spellings identify which.
    expect(out).toContain("No CSS variable behind a color class. Use the token's semantic utility class instead (3)");
    expect(out).toContain("bg-(--color-primary)");
    expect(out).toContain("text-[color:var(--color-primary)]");
    // rule 4 — spectral: app.tsx + card.css @apply. The invalid candidate
    // bg-red-500/50/50 (double modifier) is discarded by Tailwind, so spectral
    // stays 2 — asserted directly below as a zero-violation guard.
    expect(out).toContain("No spectral (palette) Tailwind color classes. Use semantic tokens instead (2)");
    expect(out).toContain("try text-success-content");
    expect(out).not.toContain("bg-red-500/50/50");
    // rule 5 — token constraints: text-muted + hover:bg-primary
    expect(out).toContain("Color class violates token constraints (2)");
    expect(out).toContain("use bg-primary-hover");
    // rule 9 — dark variant
    expect(out).toContain("Don't use dark: variant. Use semantic tokens instead (1)");
    // rule 10 — useless hover
    expect(out).toContain("Don't use hover: on non-interactive elements (1)");
    // rule 11 — component override: still 1. bg-red-foo on a <Button> is NOT an
    // override (finding #9 — spectral name without a numeric shade isn't a color).
    expect(out).toContain("Don't override color className on component. Choose from the variants, or create a new one (1)");
    expect(out).toContain("<Button>");
    // rule 12 — undefined token: bg-nonexistent + bg-red-foo (the latter is a real
    // undefined token even though it is no longer a spurious override).
    expect(out).toContain("Color class references a token not defined in the color token files (2)");
    expect(out).toContain("bg-nonexistent");
    expect(out).toContain("bg-red-foo");

    // Invalid candidates and non-color typehints (bg-red-500/50/50,
    // bg-[length:200px], bg-[image:url(x)]) are seeded but never fire — the total
    // stays 23 and every per-rule count above is exact, so any false positive on
    // them would break one of those counts. Verdict-level coverage lives in the
    // classify/rule unit suites; here the exact total is the wiring guard.
    expect(out).toContain("23 violations found.");
    expect(out).toContain("(1 line suppressed with color-lint-ignore)");
  });

  it("does not flag clean semantic usage", () => {
    expect(result.stdout).not.toContain("text-link");
    expect(result.stdout).not.toContain("border-border");
  });

  // T007 — non-regression (SC-004, FR-009): the ERB path is additive. The demo
  // run scans no .erb files, so its output is unchanged by the feature. Every
  // exact count asserted above (23 total, per-rule counts) is the guard — a
  // regression from the ERB wiring would break one of them.
  it("demo output is unaffected by the ERB path (byte-stable total)", () => {
    expect(result.stdout).toContain("23 violations found.");
    expect(result.stdout).not.toContain(".erb");
  });
});

describe("CLI against fixtures/erb-app", () => {
  const result = runCli(join(ROOT, "fixtures/erb-app"));

  it("exits 1 when ERB violations are found", () => {
    expect(result.status).toBe(1);
  });

  // T006 — exact ERB violations appear in one combined run alongside the .tsx file.
  it("reports each ERB and mixed .tsx spectral violation exactly once", () => {
    const out = result.stdout;
    expect(out).toContain("No spectral (palette) Tailwind color classes. Use semantic tokens instead (6)");
    // static + interpolation (static token only) + malformed (recovered) + valid sibling + ERB parity file
    expect(out).toContain("src/static.html.erb:1  text-red-500");
    expect(out).toContain("src/interpolation.html.erb:1  text-red-500");
    expect(out).toContain("src/malformed.html.erb:1  text-red-500");
    expect(out).toContain("src/valid-sibling.html.erb:1  text-red-500");
    expect(out).toContain("src/parity/box.html.erb:1  text-red-500");
    // parity: the .tsx twin of box.html.erb, same rule + message, same run
    expect(out).toContain("src/parity/box.tsx:1  text-red-500");
    expect(out).toContain("6 violations found.");
  });

  it("suppresses the color-lint-ignore line and never reports the split/dynamic tokens", () => {
    const out = result.stdout;
    expect(out).toContain("(1 line suppressed with color-lint-ignore)");
    expect(out).not.toContain("suppressed.html.erb");
    // no partial-token fragments from text-<%= shade %>-500
    expect(out).not.toContain("text--500");
    expect(out).not.toMatch(/text-\s/);
    // semantic token stays clean
    expect(out).not.toContain("text-primary");
  });

  it("surfaces the malformed-template parse note without aborting the run", () => {
    expect(result.stderr).toContain("malformed.html.erb: ERB parse note");
  });
});

// T007 (US1, SC-001) — a target whose source lives under app/ (no src/) lints
// via sourceDirectories:["app"], reporting the violation root-relative, exit 1.
describe("CLI against fixtures/rails-app (source under app/, no src/)", () => {
  const result = runCli(join(ROOT, "fixtures/rails-app"));

  it("lints the app/ tree without requiring src/, exit 1", () => {
    expect(result.status).toBe(1);
    // Path is relative to the target root, not the source directory.
    expect(result.stdout).toContain("app/views/home.html.erb:1  text-red-500");
    expect(result.stdout).toContain("1 violation found.");
    // The default src/ is fully replaced — its absence is not an error.
    expect(result.stderr).not.toContain("src");
  });
});

// T008 (US1, SC-004, FR-006/007/008) — misconfiguration always fails loud and
// exits non-zero, never a silent clean pass or a crash.
describe("CLI misconfiguration handling", () => {
  it("names a missing dir, still lints the existing sibling, exits non-zero", () => {
    // rails-app-missing configures ["app","ghost"]; app/ exists, ghost does not.
    const result = runCli(join(ROOT, "fixtures/rails-app-missing"));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("ghost");
    // The existing sibling still lints in the same run.
    expect(result.stdout).toContain("app/views/home.html.erb:1  text-red-500");
  });

  const cases: { name: string; value: unknown; needle: RegExp }[] = [
    { name: "empty list", value: [], needle: /empty/i },
    { name: "absolute path", value: ["/etc"], needle: /relative/i },
    { name: "..-escaping path", value: ["../secrets"], needle: /escape/i },
    { name: "non-array value", value: "app", needle: /list/i },
    { name: "non-string entry", value: ["app", 3], needle: /string/i },
  ];

  for (const { name, value, needle } of cases) {
    it(`rejects ${name}: actionable message on stderr, non-zero exit, no crash`, () => {
      const result = runCli(tempTargetWithSourceDirs(value));
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(needle);
      // Never a clean pass, never a thrown stack trace.
      expect(result.stdout).not.toContain("No color lint violations found");
      expect(result.stderr).not.toContain("    at ");
    });
  }
});

// Feature 014 — namespace-aware color classification. One mixed corpus proves
// the three properties: non-color utilities are silent (US1), every genuine
// color finding survives byte-for-byte (US2), and a novel scale value needs no
// code change (US3). Exact counts + messages are the contract (SC-005, FR-009).
describe("CLI against fixtures/mixed-namespaces (namespace-aware classification)", () => {
  const result = runCli(join(ROOT, "fixtures/mixed-namespaces"));

  it("exits 1 — genuine color violations remain", () => {
    expect(result.status).toBe(1);
  });

  // T012 (US1, SC-001) — non-color utilities produce zero violations. Each of
  // these would otherwise be flagged by no-undefined-token (the color-only
  // oracle rejects them); the filter drops them before any color rule runs.
  it("US1 — no violation for any non-color utility", () => {
    const out = result.stdout;
    for (const cls of [
      "text-sm", "text-xs", "text-lg", "text-xl",
      "shadow-lg", "border-2", "ring-2", "outline-2", "divide-y-2",
    ]) {
      expect(out).not.toContain(cls);
    }
  });

  // T015 (US2, SC-002) — every genuine color finding is preserved with its
  // unchanged message and count.
  it("US2 — spectral: text-red-500 still flagged", () => {
    expect(result.stdout).toContain("No spectral (palette) Tailwind color classes. Use semantic tokens instead (1)");
    expect(result.stdout).toContain("text-red-500 — spectral color class");
  });

  it("US2 — opacity: bg-accent/50 still flagged", () => {
    expect(result.stdout).toContain("No opacity modifiers on color classes. Add a semantic token instead (1)");
    expect(result.stdout).toContain("bg-accent/50 — opacity modifier on color class");
  });

  it("US2 — undefined-token: bg-black, text-accnt (typo), and text-red-500 all flagged", () => {
    expect(result.stdout).toContain("Color class references a token not defined in the color token files (3)");
    expect(result.stdout).toContain("black is not defined");
    expect(result.stdout).toContain("accnt is not defined");
    expect(result.stdout).toContain("red-500 is not defined");
  });

  // text-base is a color reference (--color-base shadows the font size, D3) —
  // it stays flagged by token-constraints alongside text-danger.
  it("US2 — token-constraints: text-danger and text-base (collision) both flagged", () => {
    expect(result.stdout).toContain("Color class violates token constraints (2)");
    expect(result.stdout).toContain("text-danger — danger not allowed for text-");
    expect(result.stdout).toContain("text-base — base not allowed for text-");
  });

  // T018 (US3, SC-003, FR-006) — text-10xl uses a scale value added only to the
  // fixture's design system (tokens.css), with no lint-color/ source change. The
  // namespace-complete resolver classifies it non-color automatically.
  it("US3 — novel size text-10xl produces zero color violations", () => {
    expect(result.stdout).not.toContain("text-10xl");
  });

  // Exact total pins that nothing else fires and nothing was lost.
  it("reports exactly the seven genuine color violations", () => {
    expect(result.stdout).toContain("7 violations found.");
  });
});

// T011 (US2, SC-003, FR-009) — two configured dirs including a nested pair; the
// file reachable through both is linted exactly once (exact total proves dedup).
describe("CLI against fixtures/multi-src-app (overlapping/nested dirs)", () => {
  const result = runCli(join(ROOT, "fixtures/multi-src-app"));

  it("reports each dir's violation once, deduped across the nested pair", () => {
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("app/page.html.erb:1  text-red-500");
    expect(result.stdout).toContain("app/components/widget.html.erb:1  text-red-500");
    // Without dedup the nested widget (reachable via "app" and "app/components")
    // would count twice → 3. Exactly 2 pins the single-scan guarantee.
    expect(result.stdout).toContain("2 violations found.");
  });
});
