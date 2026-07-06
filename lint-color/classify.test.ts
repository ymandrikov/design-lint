import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { __unstable__loadDesignSystem } from "tailwindcss";

import {
  classifyColorPart,
  composeColorParts,
  findColorPrefix,
  splitColorToken,
  TAILWIND_COLOR_PREFIXES,
  TAILWIND_SPECTRAL_COLORS,
} from "./classify.js";
import { EDGE_TOKENS } from "./edge-tokens.js";

describe("splitColorToken — exact output over curated edge tokens", () => {
  for (const { token, expected, note } of EDGE_TOKENS) {
    it(`${token} — ${note}`, () => {
      expect(splitColorToken(token)).toEqual(expected);
    });
  }

  it("never throws on unbalanced brackets", () => {
    expect(() => splitColorToken("bg-primary]/50")).not.toThrow();
    expect(() => splitColorToken("text-(--x")).not.toThrow();
    expect(() => splitColorToken("]:[")).not.toThrow();
  });
});

describe("classifyColorPart", () => {
  const tokens = {
    semanticSet: new Set(["primary", "success-content"]),
    spectralSet: TAILWIND_SPECTRAL_COLORS,
  };

  it("recognizes a semantic token", () => {
    expect(classifyColorPart("primary", tokens)).toBe("semantic");
    expect(classifyColorPart("success-content", tokens)).toBe("semantic");
  });

  it("recognizes a spectral color with a numeric shade", () => {
    expect(classifyColorPart("red-500", tokens)).toBe("spectral");
    expect(classifyColorPart("blue-200", tokens)).toBe("spectral");
  });

  it("recognizes a spectral color inside a compound base (divide-x-red-500)", () => {
    expect(classifyColorPart("x-red-500", tokens)).toBe("spectral");
  });

  it("requires a numeric shade — red-foo is not spectral (finding preview #9)", () => {
    expect(classifyColorPart("red-foo", tokens)).toBeNull();
  });

  it("a bare spectral name without a shade is not a color", () => {
    expect(classifyColorPart("red", tokens)).toBeNull();
  });

  it("recognizes Tailwind keyword colors without a shade as static", () => {
    expect(classifyColorPart("black", tokens)).toBe("static");
    expect(classifyColorPart("white", tokens)).toBe("static");
    expect(classifyColorPart("transparent", tokens)).toBe("static");
    expect(classifyColorPart("current", tokens)).toBe("static");
    expect(classifyColorPart("inherit", tokens)).toBe("static");
  });

  it("recognizes arbitrary values and var shorthand", () => {
    expect(classifyColorPart("[color:red]", tokens)).toBe("arbitrary");
    expect(classifyColorPart("[#123456]", tokens)).toBe("arbitrary");
    expect(classifyColorPart("(--my-color)", tokens)).toBe("arbitrary");
  });

  it("treats a bracketed interior with a spectral-looking run as arbitrary, not spectral", () => {
    expect(classifyColorPart("(--red-500-rgb)", tokens)).toBe("arbitrary");
    expect(classifyColorPart("[--red-500-rgb]", tokens)).toBe("arbitrary");
  });

  it("returns null for non-color utilities and empty parts", () => {
    expect(classifyColorPart("sm", tokens)).toBeNull();
    expect(classifyColorPart("", tokens)).toBeNull();
  });
});

describe("composeColorParts — discarded strings return null", () => {
  const parts = (tok: string) => composeColorParts(tok, TAILWIND_COLOR_PREFIXES);

  it("returns null for a double top-level Modifier", () => {
    expect(parts("bg-red-500/50/50")).toBeNull();
  });

  it("returns null for empty Modifiers", () => {
    expect(parts("bg-red-500/")).toBeNull();
    expect(parts("bg-[color:red]/[]")).toBeNull();
    expect(parts("bg-[color:red]/()")).toBeNull();
  });

  it("returns null when an arbitrary segment fails isValidArbitrary", () => {
    expect(parts("text-[color:red")).toBeNull(); // unbalanced bracket
    expect(parts("bg-[red;]")).toBeNull(); // top-level ';'
    expect(parts("bg-[a{b}]")).toBeNull(); // '{}' inside arbitrary
  });

  it("returns null for a variant that is not a valid arbitrary segment", () => {
    expect(parts("{a:b}:bg-primary")).toBeNull();
    expect(parts("]:dark:bg-primary")).toBeNull();
  });

  it("keeps registry-free candidates (root existence is not checked)", () => {
    // `bogus` is not a real utility root, but the string is syntactically valid.
    expect(parts("bogus-[#123]")).not.toBeNull();
    expect(parts("bg-[url('a:b.png')]")).not.toBeNull();
    expect(parts("bg-(--my-color)")).not.toBeNull();
  });
});

describe("findColorPrefix — longest match", () => {
  it("prefers ring-offset over ring", () => {
    expect(findColorPrefix("ring-offset-blue-200", TAILWIND_COLOR_PREFIXES)).toBe(
      "ring-offset",
    );
    expect(findColorPrefix("ring-primary", TAILWIND_COLOR_PREFIXES)).toBe("ring");
  });

  it("matches plain prefixes", () => {
    expect(findColorPrefix("bg-primary", TAILWIND_COLOR_PREFIXES)).toBe("bg");
    expect(findColorPrefix("divide-x-red-500", TAILWIND_COLOR_PREFIXES)).toBe("divide");
  });

  it("returns null when no prefix matches", () => {
    expect(findColorPrefix("sr-only", TAILWIND_COLOR_PREFIXES)).toBeNull();
  });
});

// Oracle: our hand-rolled splitter must agree with Tailwind's own candidate
// parser on split SEMANTICS — how many variants, whether a Modifier is present,
// and which utility root the base carries — for every fixture it can parse.
// A Tailwind upgrade that changes those semantics fails here instead of silently
// changing lint results (ADR 0001). We compare structural agreement, not
// representation: parseCandidate lists variants innermost-first and exposes only
// the variant ROOT, while our splitter keeps source order and the raw segment.
describe("oracle — splitter agrees with Tailwind parseCandidate", () => {
  const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "../fixtures/demo-app");
  // parseCandidate's Candidate is a discriminated union (arbitrary vs functional);
  // every oracle token here is functional, so `root` exists at runtime.
  let parse: (tok: string) => { variants: unknown[]; modifier: unknown; root: string }[];

  beforeAll(async () => {
    const entryCSS = readFileSync(join(ROOT, "src/styles.css"), "utf-8");
    const ds = await __unstable__loadDesignSystem(entryCSS, {
      base: ROOT,
      loadStylesheet: async (id: string, base: string) => ({ path: id, base, content: "" }),
      loadModule: async (id: string, base: string) => ({ path: id, base, module: {} }),
    });
    parse = (tok) => [...ds.parseCandidate(tok)] as never;
  });

  for (const { token, oracleParses } of EDGE_TOKENS) {
    it(`${token}`, () => {
      const parsed = parse(token);
      // Compare OUR splitter's live output to Tailwind — not the fixture table,
      // so a broken splitColorToken fails here (the exact-output test above pins
      // the value level; this pins split semantics against the real parser).
      const actual = splitColorToken(token);
      // Negative direction (issue 02): Tailwind yields no Candidate ⇔ our
      // composeColorParts returns null. The demo-app DS registers every root and
      // variant these fixtures use, so a Tailwind rejection is always syntactic —
      // exactly the boundary composeColorParts enforces.
      const composed = composeColorParts(token, TAILWIND_COLOR_PREFIXES);
      expect(composed === null).toBe(!oracleParses);
      if (!oracleParses) {
        expect(parsed).toHaveLength(0);
        return;
      }
      expect(parsed.length).toBeGreaterThan(0);
      const pc = parsed[0];
      // variant count agrees
      expect(actual.variants.length).toBe(pc.variants.length);
      // Modifier presence agrees
      expect(actual.modifier === null).toBe(pc.modifier === null);
      // base carries Tailwind's utility root (root is syntactic — prefix only;
      // value-level agreement is the exact-output test's job)
      expect(
        actual.base === pc.root || actual.base.startsWith(pc.root + "-"),
      ).toBe(true);
    });
  }
});
