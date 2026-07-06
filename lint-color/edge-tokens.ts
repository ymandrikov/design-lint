// Curated edge-case candidate tokens with their expected splitColorToken parts.
// One source of truth consumed by BOTH the exact-output test (asserts our
// splitter produces exactly these parts) and the oracle test (asserts our
// splitter agrees with Tailwind's own parseCandidate wherever it parses).

export type SplitParts = {
  variants: string[];
  base: string;
  modifier: string | null;
};

export type EdgeToken = {
  token: string;
  expected: SplitParts;
  // parseCandidate rejects unbalanced / malformed input — skip it in the oracle.
  oracleParses: boolean;
  note: string;
};

export const EDGE_TOKENS: EdgeToken[] = [
  {
    token: "hover:bg-primary/[0.5]",
    expected: { variants: ["hover"], base: "bg-primary", modifier: "[0.5]" },
    oracleParses: true,
    note: "arbitrary opacity Modifier behind a variant",
  },
  {
    token: "text-[color:red]",
    expected: { variants: [], base: "text-[color:red]", modifier: null },
    oracleParses: true,
    note: "inner ':' is NOT a variant separator (finding #5)",
  },
  {
    token: "data-[state=open]:hover:bg-x",
    expected: {
      variants: ["data-[state=open]", "hover"],
      base: "bg-x",
      modifier: null,
    },
    oracleParses: true,
    note: "arbitrary variant keeps its bracket group intact",
  },
  {
    token: "bg-(--my-color)",
    expected: { variants: [], base: "bg-(--my-color)", modifier: null },
    oracleParses: true,
    note: "v4 var shorthand as the value",
  },
  {
    token: "bg-primary/(--alpha)",
    expected: { variants: [], base: "bg-primary", modifier: "(--alpha)" },
    oracleParses: true,
    note: "v4 var shorthand as the Modifier",
  },
  {
    token: "!bg-primary",
    expected: { variants: [], base: "bg-primary", modifier: null },
    oracleParses: true,
    note: "v3 leading important marker stripped",
  },
  {
    token: "bg-primary!",
    expected: { variants: [], base: "bg-primary", modifier: null },
    oracleParses: true,
    note: "v4 trailing important marker stripped",
  },
  {
    token: "hover:!bg-primary/50",
    expected: { variants: ["hover"], base: "bg-primary", modifier: "50" },
    oracleParses: true,
    note: "important marker between variant and base, with numeric Modifier",
  },
  {
    token: "bg-primary/50",
    expected: { variants: [], base: "bg-primary", modifier: "50" },
    oracleParses: true,
    note: "plain numeric opacity Modifier",
  },
  {
    token: "bg-red-500",
    expected: { variants: [], base: "bg-red-500", modifier: null },
    oracleParses: true,
    note: "spectral color, no variant or Modifier",
  },
  {
    token: "text-sm/6",
    expected: { variants: [], base: "text-sm", modifier: "6" },
    oracleParses: true,
    note: "line-height Modifier on a non-color utility",
  },
  {
    token: "text-lg/[1.4]",
    expected: { variants: [], base: "text-lg", modifier: "[1.4]" },
    oracleParses: true,
    note: "arbitrary line-height Modifier on a non-color utility",
  },
  {
    token: "divide-x-red-500",
    expected: { variants: [], base: "divide-x-red-500", modifier: null },
    oracleParses: true,
    note: "compound utility root; segment scan still classifies",
  },
  {
    token: "text-[color:red]/50",
    expected: { variants: [], base: "text-[color:red]", modifier: "50" },
    oracleParses: true,
    note: "Modifier after a closed bracket group is top-level",
  },
  {
    token: "md:hover:text-primary",
    expected: { variants: ["md", "hover"], base: "text-primary", modifier: null },
    oracleParses: true,
    note: "two stacked variants in source order (md registered via --breakpoint-md)",
  },
  {
    token: "text-[color:red",
    expected: { variants: [], base: "text-[color:red", modifier: null },
    oracleParses: false,
    note: "unbalanced bracket — best-effort, never throws (parseCandidate rejects)",
  },
  {
    token: "bg-[url('a:b.png')]",
    expected: { variants: [], base: "bg-[url('a:b.png')]", modifier: null },
    oracleParses: true,
    note: "quoted ':' inside an arbitrary value is not a variant separator",
  },
  {
    token: "bg-[url('a/b.png')]/50",
    expected: { variants: [], base: "bg-[url('a/b.png')]", modifier: "50" },
    oracleParses: true,
    note: "quoted '/' inside an arbitrary value is not a Modifier separator",
  },
  {
    token: 'hover:bg-[url("a:b/c.png")]',
    expected: { variants: ["hover"], base: 'bg-[url("a:b/c.png")]', modifier: null },
    oracleParses: true,
    note: "double-quoted ':' and '/' stay inside the base behind a variant",
  },
  {
    token: String.raw`bg-[a\]b:c]`,
    expected: { variants: [], base: String.raw`bg-[a\]b:c]`, modifier: null },
    oracleParses: true,
    note: "backslash-escaped ']' does not close the bracket group",
  },
  {
    token: "{a:b}:bg-primary",
    expected: { variants: ["{a:b}"], base: "bg-primary", modifier: null },
    oracleParses: false,
    note: "'{}' group tracked like brackets — inner ':' is not a variant separator",
  },
  {
    token: "bg-[url('a.png)]/50",
    expected: { variants: [], base: "bg-[url('a.png)]/50", modifier: null },
    oracleParses: false,
    note: "unmatched quote swallows the remainder, exactly as Tailwind's segment does — the '/' is not a Modifier separator (rejection of such strings is issue 02)",
  },
  {
    token: "]:dark:bg-primary",
    expected: { variants: ["]", "dark"], base: "bg-primary", modifier: null },
    oracleParses: false,
    note: "stray closer is ignored (no negative depth), so later ':' still splits — matches segment; old depth counter kept the whole string as base",
  },

  // --- Arbitrary-property candidates (issue 05): the whole base is a
  //     "[prop:value]" group, so there is no color prefix. parseCandidate emits
  //     an `arbitrary` Candidate with no `root`, so the oracle skips the
  //     root-agreement check (see the oracle test).
  {
    token: "[color:red]",
    expected: { variants: [], base: "[color:red]", modifier: null },
    oracleParses: true,
    note: "arbitrary-property candidate — property color, literal value",
  },
  {
    token: "[background-color:#123]",
    expected: { variants: [], base: "[background-color:#123]", modifier: null },
    oracleParses: true,
    note: "arbitrary-property candidate — hex value behind a color property",
  },
  {
    token: "[--my-color:red]",
    expected: { variants: [], base: "[--my-color:red]", modifier: null },
    oracleParses: true,
    note: "custom property leads with '-' — a valid arbitrary-property name",
  },
  {
    token: "[color:var(--color-primary)]",
    expected: { variants: [], base: "[color:var(--color-primary)]", modifier: null },
    oracleParses: true,
    note: "var reference behind a color property (classifies var)",
  },
  {
    token: "[margin:4px]",
    expected: { variants: [], base: "[margin:4px]", modifier: null },
    oracleParses: true,
    note: "non-color arbitrary property — a Candidate, but invisible to color rules",
  },
  {
    token: "dark:[color:red]",
    expected: { variants: ["dark"], base: "[color:red]", modifier: null },
    oracleParses: true,
    note: "Tailwind variant on an arbitrary-property candidate stays intact",
  },

  // --- Discarded strings: Tailwind rejects at the syntax level, so these are
  //     not Candidates (issue 02). splitColorToken still best-effort-decomposes
  //     them (pins the value level); composeColorParts returns null (see the
  //     negative-direction oracle) and every rule skips them.
  {
    token: "bg-red-500/50/50",
    expected: { variants: [], base: "bg-red-500/50", modifier: "50" },
    oracleParses: false,
    note: "two top-level Modifiers — Tailwind discards a double '/'",
  },
  {
    token: "bg-red-500/",
    expected: { variants: [], base: "bg-red-500", modifier: "" },
    oracleParses: false,
    note: "trailing-slash typo — the empty Modifier is not a valid named value",
  },
  {
    token: "bg-[color:red]/[]",
    expected: { variants: [], base: "bg-[color:red]", modifier: "[]" },
    oracleParses: false,
    note: "empty arbitrary Modifier '[]' is invalid",
  },
  {
    token: "bg-[color:red]/()",
    expected: { variants: [], base: "bg-[color:red]", modifier: "()" },
    oracleParses: false,
    note: "empty var-shorthand Modifier '()' is invalid",
  },
  {
    token: "bg-[red;]",
    expected: { variants: [], base: "bg-[red;]", modifier: null },
    oracleParses: false,
    note: "top-level ';' inside an arbitrary value — isValidArbitrary rejects",
  },
  {
    token: "bg-[a{b}]",
    expected: { variants: [], base: "bg-[a{b}]", modifier: null },
    oracleParses: false,
    note: "'{}' inside an arbitrary value — isValidArbitrary rejects",
  },
  {
    token: "[Color:red]",
    expected: { variants: [], base: "[Color:red]", modifier: null },
    oracleParses: false,
    note: "arbitrary-property name must start a-z or '-' — uppercase is not a Candidate",
  },
  {
    token: "[color:]",
    expected: { variants: [], base: "[color:]", modifier: null },
    oracleParses: false,
    note: "empty arbitrary-property value — not a Candidate",
  },
  {
    token: "[foo]",
    expected: { variants: [], base: "[foo]", modifier: null },
    oracleParses: false,
    note: "arbitrary-property shape with no ':' separator — not a Candidate",
  },
  {
    token: "[0color:red]",
    expected: { variants: [], base: "[0color:red]", modifier: null },
    oracleParses: false,
    note: "arbitrary-property name must not start with a digit — not a Candidate",
  },
];
