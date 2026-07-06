import { describe, expect, it } from "vitest";
import { ansi, type CheckTokenFn } from "../helpers.js";
import { runTokenRuleOnSource } from "../shared.js";

const { checkToken } = (await import("./no-dark-variant.js")) as {
  checkToken: CheckTokenFn;
};

const lint = (source: string) =>
  runTokenRuleOnSource(checkToken, source, {}, ansi);

describe("no-dark-variant", () => {
  describe("violations", () => {
    it("reports dark:bg-primary", () => {
      const el = `<div className="dark:bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("dark:bg-primary");
    });

    it("reports dark:text-foreground", () => {
      const el = `<div className="dark:text-foreground" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("dark:text-foreground");
    });

    it("reports hover:dark:bg-primary (dark: anywhere in the modifier chain)", () => {
      const el = `<div className="hover:dark:bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("hover:dark:bg-primary");
    });

    it("reports md:dark:text-muted (responsive + dark:)", () => {
      const el = `<div className="md:dark:text-muted" />`;
      const result = lint(el);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("md:dark:text-muted");
    });

    // v1 (Change C) scopes the general token pipeline to static className/class
    // string and template values only. Class strings inside cn()/clsx() calls are
    // a documented v1.1 fast-follow (callee allowlist), so they are not scanned
    // here yet. no-component-color-override still descends into calls on watched
    // components — this deferral only affects the general spectral/dark/etc. rules.
    it("does not scan string arguments inside a cn() call (deferred to v1.1)", () => {
      const el = `<div className={cn("dark:text-muted", extra)} />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("reports all issues", () => {
      const el = `<div className={"dark:bg-primary dark:text-muted"} />`;
      const result = lint(el);
      expect(result).toHaveLength(2);
      expect(result[0]).toContain("dark:bg-primary");
      expect(result[1]).toContain("dark:text-muted");
    });
  });

  describe("non-violations", () => {
    it("allows a plain token with no dark: variant", () => {
      const el = `<div className="bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows hover:bg-primary", () => {
      const el = `<div className="hover:bg-primary" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows bg-dark-muted (dark in token name, not as a variant)", () => {
      const el = `<div className="bg-dark-muted" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });

    it("allows text-darkness (dark not followed by colon)", () => {
      const el = `<div className="text-darkness" />`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });
  });

  describe("escaping", () => {
    it("skips lines with color-lint-ignore", () => {
      const el = `<div className="dark:bg-primary" /> {/* color-lint-ignore */}`;
      const result = lint(el);
      expect(result).toHaveLength(0);
    });
  });
});
