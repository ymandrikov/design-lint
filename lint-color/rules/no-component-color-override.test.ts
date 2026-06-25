import { describe, expect, it } from "vitest";
import { ansi, makeReporter, type LintSourceFn } from "../helpers.js";

const { lintSource } = (await import("./no-component-color-override.js")) as {
  lintSource: LintSourceFn;
};

const tokens = {
  uiComponents: new Set(["Button", "Badge"]),
  colorPrefixes: ["bg", "text", "border"],
  semanticSet: new Set(["primary", "destructive", "muted"]),
  spectralSet: new Set(["red", "green", "blue"]),
};

function lint(source: string) {
  const { found, report } = makeReporter();
  lintSource(source, "test.tsx", {
    report,
    ansi,
    tokens,
  } as Parameters<LintSourceFn>[2]);
  return found;
}

describe("no-component-color-override", () => {
  describe("violations", () => {
    it("reports a semantic color token on a watched component", () => {
      const el = `<Button className="bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0].message).toContain("bg-primary");
      expect(result[0].message).toContain("<Button>");
    });

    it("reports a spectral color token on a watched component", () => {
      const el = `<Badge className="bg-red-500" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0].message).toContain("bg-red-500");
      expect(result[0].message).toContain("<Badge>");
    });

    it("reports multiple color tokens in the same className", () => {
      const el = `<Button className="bg-primary text-destructive" />`;
      const result = lint(el);
      expect(result).toHaveLength(2);
      expect(result[0].message).toContain("bg-primary");
      expect(result[0].message).toContain("<Button>");
      expect(result[1].message).toContain("text-destructive");
      expect(result[1].message).toContain("<Button>");
    });

    it("reports className written as JSX expression string", () => {
      const el = `<Button className={"bg-primary"} />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0].message).toContain("bg-primary");
      expect(result[0].message).toContain("<Button>");
    });

    it("reports color token using hover: variant prefix", () => {
      const el = `<Button className="hover:bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0].message).toContain("bg-primary");
      expect(result[0].message).toContain("<Button>");
    });

    it("reports string literal argument inside cn() call", () => {
      const el = `<Button className={cn("bg-primary", extra)} />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0].message).toContain("bg-primary");
      expect(result[0].message).toContain("<Button>");
    });

    it("reports string literal argument inside clsx() call", () => {
      const el = `<Button className={clsx("bg-primary", extra)} />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0].message).toContain("bg-primary");
      expect(result[0].message).toContain("<Button>");
    });

    it("reports bg- prefix in template literal (dynamic color name)", () => {
      const el = `<Button className={\`bg-\${color}\`} />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0].message).toContain("bg-");
      expect(result[0].message).toContain("<Button>");
    });

    it("reports text- prefix in template literal (all color prefixes work)", () => {
      const el = `<Button className={\`text-\${color}\`} />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0].message).toContain("text-");
      expect(result[0].message).toContain("<Button>");
    });

    it("reports bg-red- prefix in template literal (dynamic spectral shade)", () => {
      // `bg-red-${shade}` — static part "bg-red-" still identifies a spectral color
      const el = `<Button className={\`bg-red-\${shade}\`} />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0].message).toContain("<Button>");
    });

    it("reports all issues", () => {
      const el = `<Button className={"bg-primary"} style={{color: "#ff0000"}} />`;
      const result = lint(el);
      expect(result).toHaveLength(2);
      expect(result[0].message).toContain("bg-primary");
      expect(result[0].message).toContain("<Button>");
      expect(result[1].message).toContain("#ff0000");
      expect(result[1].message).toContain("<Button>");
    });
  });

  describe("non-violations", () => {
    it("allows a non-watched component", () => {
      const el = `<Card className="bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows a plain HTML element using a color token", () => {
      const el = `<div className="bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows non-color utility classes on a watched component", () => {
      const el = `<Button className="rounded-md px-4 text-sm" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows template literal with no color prefix (e.g. red-${500} is not valid Tailwind)", () => {
      // `red-${500}` has no color prefix — the correct form would be `bg-red-${shade}`
      const el = `<Button className={\`red-\${500}\`} />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows override when component is not included to uiComponents", () => {
      const el = `<Button className="bg-primary" />`;
      const { found, report } = makeReporter();
      lintSource(el, "test.tsx", {
        report,
        ansi,
        tokens: { ...tokens, uiComponents: new Set() },
      } as Parameters<LintSourceFn>[2]);
      expect(found).toHaveLength(0);
    });
  });

  describe("escaping", () => {
    it("skips lines with color-lint-ignore", () => {
      const el = `<Button className="bg-primary" /> {/* color-lint-ignore */}`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });
  });
});
