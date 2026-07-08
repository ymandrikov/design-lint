// Run-level reporting — pure renderers over one RunResult.
// index.ts builds the RunResult, picks a renderer, prints, and exits;
// nothing here touches process, console, or the filesystem.

// The styling the human renderer needs; index.ts passes the TTY-sensitive
// functions from ansi.ts (JSON mode never styles — renderJson takes no ansi).
type ReportAnsi = { bold: (s: string) => string; dim: (s: string) => string };

export type RunViolation = {
  file: string; // target-root-relative path
  line: number; // 1-based
  rule: string; // kebab-case rule name, matches colors.json rules keys
  message: string;
};

export type RunIgnore = { file: string; line: number };

export type RunResult = {
  violations: RunViolation[];
  ignores: RunIgnore[];
  // Run diagnostics surfaced during linting (today: ERB parse notes), file-prefixed.
  warnings: string[];
  // Configured source dirs that don't exist on disk.
  missingSourceDirs: string[];
  // rule name → designer-facing description from colors.json (fallback: rule
  // name). Key order is the rule-group display order (index.ts builds it in
  // ascending rule-id order, preserving the report's historical grouping).
  // Human renderer only; never serialized.
  ruleLabels: Record<string, string>;
};

// The machine-readable run record (contracts/run-record.schema.json): one JSON
// document, canonically sorted so an identical target tree yields byte-identical
// output (research D7). Messages must already be plain — JSON mode injects an
// identity ansi at startup (research D10). Returns the doc with its trailing newline.
export function renderJson(run: RunResult): string {
  // Code-unit comparison, not localeCompare — locale-independent, so the same
  // tree sorts identically on every machine.
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const violations = [...run.violations].sort(
    (a, b) =>
      cmp(a.file, b.file) ||
      a.line - b.line ||
      cmp(a.rule, b.rule) ||
      cmp(a.message, b.message),
  );
  const doc = {
    summary: { violations: violations.length, ignores: run.ignores.length },
    violations: violations.map(({ file, line, rule, message }) => ({ file, line, rule, message })),
    ignores: run.ignores,
    warnings: run.warnings,
    missingSourceDirs: run.missingSourceDirs,
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

function ignoresSummaryLine(run: RunResult, ansi: ReportAnsi): string {
  const n = run.ignores.length;
  if (n === 0) return "";
  const ignoreHint =
    n > 10 ? " — consider revisiting the token rules or adding new tokens" : "";
  return `  ${ansi.dim(`(${n} line${n !== 1 ? "s" : ""} suppressed with color-lint-ignore${ignoreHint})`)}`;
}

// The human report: clean message, or rule-grouped detail + suppression summary.
// Returns the report without a trailing newline; the caller console.logs it.
export function renderHuman(run: RunResult, ansi: ReportAnsi): string {
  const ignoresSummary = ignoresSummaryLine(run, ansi);

  if (run.violations.length === 0) {
    return `✓ No color lint violations found.${ignoresSummary ? `\n${ignoresSummary}` : ""}`;
  }

  const byRule = Map.groupBy(run.violations, (v) => v.rule);
  // Group order = ruleLabels key order; rules outside the label map (should not
  // happen — labels and violations come from the same rule modules) sort last.
  const labelOrder = Object.keys(run.ruleLabels);
  const groupRank = (rule: string) => {
    const i = labelOrder.indexOf(rule);
    return i === -1 ? labelOrder.length : i;
  };

  // Summary header (contracts/cli.md): total, affected-file count, then one
  // right-aligned count per triggered rule, descending, so a large run answers
  // "what dominates" in one screenful. Ties keep the rule-group display order.
  const groups = [...byRule.entries()].sort(
    (a, b) => groupRank(a[0]) - groupRank(b[0]),
  );
  const n = run.violations.length;
  const fileCount = new Set(run.violations.map((v) => v.file)).size;
  const byCount = [...groups].sort(
    (a, b) => b[1].length - a[1].length || groupRank(a[0]) - groupRank(b[0]),
  );
  const countWidth = String(byCount[0][1].length).length + 2;

  const lines: string[] = [
    `Color lint: ${n} violation${n !== 1 ? "s" : ""} in ${fileCount} file${fileCount !== 1 ? "s" : ""}`,
    "",
    ...byCount.map(
      ([rule, items]) =>
        `${String(items.length).padStart(countWidth)}  ${run.ruleLabels[rule] ?? rule}`,
    ),
  ];

  let total = 0;
  for (const [rule, items] of groups) {
    lines.push("", `${ansi.bold(run.ruleLabels[rule] ?? rule)} (${items.length})`);
    for (const { file, line, message } of items) {
      lines.push(`  ${ansi.dim(`${file}:${line}`)}  ${message}`);
      total++;
    }
  }

  lines.push(
    "",
    `${total} violation${total !== 1 ? "s" : ""} found.${ignoresSummary ? `\n${ignoresSummary}` : ""}`,
  );
  return lines.join("\n");
}
