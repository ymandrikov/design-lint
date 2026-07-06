// End-to-end: run the CLI against fixtures/demo-app and assert on real output.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function runCli(target: string) {
  return spawnSync("node", [join(ROOT, "lint-color/index.js"), target], {
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
    // rule 2 — raw colors: arbitrary value + card.css. The style literal
    // `color: "#ff0000"` is no longer double-flagged here (Change C: the token
    // pipeline scans className only) — it is still caught by rule 1 below.
    expect(out).toContain("No raw color values in component CSS. Use semantic tokens instead (2)");
    // rule 3 — opacity modifier: numeric + arbitrary + var-shorthand (finding #3)
    // + static keyword color (bg-black/50). text-sm/6 (line-height) is seeded too
    // but must NOT fire — hence 4, not 5.
    expect(out).toContain("No opacity modifiers on color classes. Add a semantic token instead (4)");
    expect(out).toContain("bg-primary/50");
    expect(out).toContain("bg-primary/[0.5]");
    expect(out).toContain("bg-primary/(--alpha)");
    expect(out).toContain("bg-black/50");
    expect(out).not.toContain("text-sm/6");
    // rule 4 — spectral: app.tsx + card.css @apply
    expect(out).toContain("No spectral (palette) Tailwind color classes. Use semantic tokens instead (2)");
    expect(out).toContain("try text-success-content");
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

    expect(out).toContain("16 violations found.");
    expect(out).toContain("(1 line suppressed with color-lint-ignore)");
  });

  it("does not flag clean semantic usage", () => {
    expect(result.stdout).not.toContain("text-link");
    expect(result.stdout).not.toContain("border-border");
  });
});
