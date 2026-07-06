// Shared types and test helpers for lint-color rule tests.
// scripts/ is excluded from tsconfig, so rule modules are imported via cast.

export type Ansi = { red: (s: string) => string; blue: (s: string) => string };
export type ReportFn = (line: number, message: string) => void;

export type LintCtx = {
  report: ReportFn;
  ansi: Ansi;
  tokens?: Record<string, unknown>;
  ruleConfig?: Record<string, unknown>;
};
export type TokenCtx = {
  tokens: Record<string, unknown>;
  ansi: Ansi;
  ruleConfig?: Record<string, unknown>;
};

export type ColorParts = {
  variants: string[];
  base: string;
  modifier: string | null;
  colorPrefix: string | null;
  colorPart: string | null;
};

export type LintSourceFn = (source: string, filePath: string, ctx: LintCtx) => void;
export type CheckLineFn = (line: string, ctx: { ansi: Ansi }) => string | null;
export type CheckTokenFn = (
  rawTok: string,
  parts: ColorParts,
  ctx: TokenCtx,
) => string | null;

export type RuleModule = {
  id: number;
  name: string;
  lintSource?: LintSourceFn;
  checkLine?: CheckLineFn;
  checkToken?: CheckTokenFn;
};

export type RuleConfig = { enabled?: boolean; [key: string]: unknown };

export const ansi: Ansi = { red: (s) => s, blue: (s) => s };

export function makeReporter() {
  const found: { line: number; message: string }[] = [];
  const report: ReportFn = (line, message) => found.push({ line, message });
  return { found, report };
}
