import { describe, expect, it } from "vitest";
import { decodeArbitraryValue } from "./decode-arbitrary-value.ts";

// Ported from tailwindcss packages/tailwindcss/src/utils/decode-arbitrary-value.test.ts
// at commit 9b0e8af (v4.3.2). Only the underscore-decoding + url()/var()/theme()
// first-argument exception cases are ported — the math-operator normalization
// block is out of scope for this linter (see the vendored module header).
describe("decoding arbitrary values", () => {
  it("should replace an underscore with a space", () => {
    expect(decodeArbitraryValue("foo_bar")).toBe("foo bar");
  });

  it("should replace multiple underscores with spaces", () => {
    expect(decodeArbitraryValue("__foo__bar__")).toBe("  foo  bar  ");
  });

  it("should replace escaped underscores with a normal underscore", () => {
    expect(decodeArbitraryValue("foo\\_bar")).toBe("foo_bar");
  });

  it("should not replace underscores in url()", () => {
    expect(decodeArbitraryValue("url(./my_file.jpg)")).toBe("url(./my_file.jpg)");
    expect(decodeArbitraryValue("no-repeat_url(./my_file.jpg)")).toBe(
      "no-repeat url(./my_file.jpg)",
    );
  });

  it("should not replace underscores in the first argument of var()", () => {
    expect(decodeArbitraryValue("var(--spacing-1_5)")).toBe("var(--spacing-1_5)");
    expect(decodeArbitraryValue("var(--spacing-1_5,_1rem)")).toBe("var(--spacing-1_5, 1rem)");
    expect(decodeArbitraryValue("var(--spacing-1_5,_var(--spacing-2_5,_1rem))")).toBe(
      "var(--spacing-1_5, var(--spacing-2_5, 1rem))",
    );
  });

  it("should not replace underscores in the first argument of theme()", () => {
    expect(decodeArbitraryValue("theme(--spacing-1_5)")).toBe("theme(--spacing-1_5)");
    expect(decodeArbitraryValue("theme(--spacing-1_5,_1rem)")).toBe("theme(--spacing-1_5, 1rem)");
    expect(decodeArbitraryValue("theme(--spacing-1_5,_theme(--spacing-2_5,_1rem))")).toBe(
      "theme(--spacing-1_5, theme(--spacing-2_5, 1rem))",
    );
  });

  it("should leave var(…) as is", () => {
    expect(decodeArbitraryValue("var(--foo)")).toBe("var(--foo)");
    expect(decodeArbitraryValue("var(--headings-h1-size)")).toBe("var(--headings-h1-size)");
  });
});
