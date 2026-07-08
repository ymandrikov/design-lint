// End-to-end: run the CLI against fixtures/demo-app and assert on real output.
import { spawnSync } from "node:child_process";
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
