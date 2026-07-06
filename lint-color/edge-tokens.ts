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
    note: "Modifier after a closed bracket group is depth-0",
  },
  {
    token: "md:hover:text-primary",
    expected: { variants: ["md", "hover"], base: "text-primary", modifier: null },
    oracleParses: false,
    note: "two stacked variants in source order (md unregistered in the minimal DS)",
  },
  {
    token: "text-[color:red",
    expected: { variants: [], base: "text-[color:red", modifier: null },
    oracleParses: false,
    note: "unbalanced bracket — best-effort, never throws (parseCandidate rejects)",
  },
];
