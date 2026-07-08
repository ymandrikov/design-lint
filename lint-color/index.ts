#!/usr/bin/env node
// Color design-system lint — orchestrates one-rule linters over src/.
// Run: node lint-color/index.ts [target-root]
// target-root defaults to two directories up (legacy in-host layout).

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { __unstable__loadDesignSystem } from "tailwindcss";

import { bold, dim, red } from "./ansi.ts";
import {
  getAllFiles,
  isStorybookFile,
  resolveExistingSourceDirs,
  validateSourceDirs,
} from "./files.ts";
import {
  makeResolveNamespaceKind,
  TAILWIND_COLOR_PREFIXES,
  TAILWIND_SPECTRAL_COLORS,
} from "./classify.ts";

import * as ruleStyleColor from "./rules/no-style-color.ts";
import * as ruleRawCssColor from "./rules/no-raw-css-color.ts";
import * as ruleVarColor from "./rules/no-var-color.ts";
import * as ruleAlphaModifier from "./rules/no-opacity-modifier.ts";
import * as ruleSpectralColor from "./rules/no-spectral-color.ts";
import * as ruleColorRules from "./rules/token-constraints.ts";
import * as ruleDarkModifier from "./rules/no-dark-variant.ts";
import * as ruleHoverInteractive from "./rules/no-useless-hover.ts";
import * as ruleUiColorOverride from "./rules/no-component-color-override.ts";
import * as ruleUndefinedToken from "./rules/no-undefined-token.ts";

import { createLinter } from "./linter.ts";
import { loadHerb } from "./ast-erb.ts";

// Shape of design-system/lint/colors.json at the JSON.parse boundary (the one
// external-data seam). Every rule sub-config is open-ended; only the fields this
// entrypoint reads are named. `componentsDirectory` rides under the component
// rule; `description` is the designer-facing label surfaced in the report.
type RuleConfig = {
  enabled?: boolean;
  description?: string;
  componentsDirectory?: string;
  [key: string]: unknown;
};
type Config = {
  colorTokenFiles: string[];
  // Target-root-relative directories to scan. Absent ⇒ default ["src"]. Raw at
  // the JSON.parse seam (validateSourceDirs owns every type check), so typed
  // permissively here and re-checked as `unknown` before use.
  sourceDirectories?: string[];
  rules: Record<string, RuleConfig>;
};

// What each rule namespace exposes to the report-label builder. The nine `.js`
// rules resolve permissively under checkJs:false; this view pins the two members
// read here without pulling the rules/ layer into scope.
type RuleModule = { id: number; name: string };

// The result shape every linter.lint*Source method returns (mirrors linter.ts).
type LintResult = {
  violations: { line: number; message: string; ruleId: number }[];
  ignores: number[];
};

type OutViolation = { file: string; line: number; rule: number; message: string };
type OutIgnore = { file: string; line: number };

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = process.argv[2] ? resolve(process.argv[2]) : join(__dirname, "../..");
const req = createRequire(import.meta.url);

// Options accepted by the Tailwind loader; its resolver callbacks type their
// returns with a `path` field (and `module: Plugin | Config`) this linter's
// loaders never supplied — those fields were dead at runtime for the single
// candidatesToCss call, verified by the unchanged demo run. Cast the callbacks
// to the package's expected type at this third-party (__unstable__) seam rather
// than emit a `path` that could alter candidate resolution.
type LoadOpts = NonNullable<Parameters<typeof __unstable__loadDesignSystem>[1]>;

// Shared loader for both design systems (the color-token-only oracle and the
// namespace-complete resolver). The resolver callbacks read files relative to
// the target root and resolve package `@import`s from node_modules.
//
// `extraResolvePaths` widens package resolution beyond the target. The oracle
// passes none — so a target whose token file's `@import "tailwindcss"` does not
// resolve stays color-token-only (bg-black / text-red-500 keep being flagged,
// research D2). The namespace-complete resolver passes the LINTER's own dir so
// Tailwind's default theme (font-size, shadow, width namespaces) always loads,
// regardless of the target's install — that is what lets it classify
// non-color utilities.
function loadDesignSystem(entryCSS: string, extraResolvePaths: string[] = []) {
  const resolvePaths = [ROOT, ...extraResolvePaths];
  return __unstable__loadDesignSystem(entryCSS, {
    base: ROOT,
    loadStylesheet: (async (id: string, base: string) => {
      try {
        const local = join(base, id);
        return { content: readFileSync(local, "utf-8"), base: dirname(local) };
      } catch {}
      try {
        const pkgDir = dirname(req.resolve(`${id}/package.json`, { paths: [base, ...resolvePaths] }));
        const pkgJson = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf-8"));
        const css = join(pkgDir, pkgJson.style || "index.css");
        return { content: readFileSync(css, "utf-8"), base: dirname(css) };
      } catch {}
      return { content: "", base };
    }) as LoadOpts["loadStylesheet"],
    loadModule: (async (id: string, base: string) => {
      try {
        let resolved: string;
        try { resolved = req.resolve(id, { paths: [base, ...resolvePaths] }); }
        catch { resolved = join(base, id); }
        const mod = await import(pathToFileURL(resolved).href);
        return { module: mod.default ?? mod, base: dirname(resolved) };
      } catch {
        return { module: {}, base };
      }
    }) as unknown as LoadOpts["loadModule"],
  });
}

// The undefined-token / spectral oracle: built from the target's color-token CSS
// AS-IS (research D2). It knows the target's --color-* semantic tokens; a target
// whose token file omits `@import "tailwindcss"` therefore rejects bg-black /
// text-red-500 — exactly the true positives no-undefined-token must keep.
async function buildIsValidTailwindCandidate(
  cssEntryFile: string,
): Promise<(tok: string) => boolean> {
  const entryCSS = readFileSync(join(ROOT, cssEntryFile), "utf-8");
  const ds = await loadDesignSystem(entryCSS);
  return (tok: string) => ds.candidatesToCss([tok]).some((r) => r !== null && r !== "");
}

// The namespace-complete resolver (research D1/D2): Tailwind's full default theme
// MERGED with the target's color tokens. Answers whether a candidate resolves to
// a non-color CSS property so the filter can drop it. Kept separate from the
// oracle above so enriching resolution here never regresses undefined-token.
async function buildResolveNamespaceKind(
  colorTokenFiles: string[],
): Promise<(base: string) => ReturnType<ReturnType<typeof makeResolveNamespaceKind>>> {
  // Merge every color-token file, then guarantee exactly one Tailwind import so
  // the default namespaces (font-size, shadow, width, …) are always present —
  // regardless of whether the target's own files import Tailwind.
  const merged = colorTokenFiles
    .map((f) => readFileSync(join(ROOT, f), "utf-8"))
    .join("\n")
    .replace(/@import\s+["']tailwindcss["'];?/g, "");
  // Resolve Tailwind from the linter's own install (__dirname) so the default
  // theme loads even when the target project cannot resolve it.
  const ds = await loadDesignSystem(`@import "tailwindcss";\n${merged}`, [__dirname]);
  return makeResolveNamespaceKind((candidates) => ds.candidatesToCss(candidates));
}

const ansi = { red, blue: (s: string) => (process.stdout.isTTY ? `\x1b[34m${s}\x1b[0m` : s), dim };

const config: Config = JSON.parse(
  readFileSync(join(ROOT, "design-system/lint/colors.json"), "utf-8"),
);

// Resolve which directories to scan before any expensive work. A malformed
// `sourceDirectories` (empty, wrong type, absolute, ..-escaping) fails loud and
// exits non-zero here — never a silent clean pass. A configured dir that doesn't
// exist is surfaced and forces a non-zero exit even if the rest lint clean.
let validatedSourceDirs: string[];
try {
  validatedSourceDirs = validateSourceDirs(config.sourceDirectories);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
const { existing: SOURCE_DIRS, missing: MISSING_DIRS } = resolveExistingSourceDirs(
  validatedSourceDirs,
  ROOT,
);
for (const dir of MISSING_DIRS) {
  console.error(`Configured source directory not found: ${dir}`);
}
if (SOURCE_DIRS.length === 0) {
  console.error("No configured source directories exist; nothing to scan.");
  process.exit(1);
}
const hadMissingDir = MISSING_DIRS.length > 0;

// Walk every existing source dir for the given extensions, deduplicating by
// resolved absolute path so a file reachable through overlapping or nested
// configured dirs is linted exactly once.
function collectSourceFiles(...exts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const dir of SOURCE_DIRS) {
    for (const f of getAllFiles(dir, ...exts)) {
      if (isStorybookFile(f)) continue;
      const abs = resolve(f);
      if (seen.has(abs)) continue;
      seen.add(abs);
      out.push(f);
    }
  }
  return out;
}

const EXEMPT_CSS = new Set(config.colorTokenFiles.map((f) => join(ROOT, f)));

// Derive semantic token names from --color-* aliases in colorTokenFiles.
// Adding a token to those files is enough — no manual sync required.
const derivedSemanticTokens = config.colorTokenFiles.flatMap((f) => [
  ...readFileSync(join(ROOT, f), "utf-8").matchAll(/--color-([\w-]+)\s*:/g),
].map((m) => m[1]));

const componentOverrideConfig: RuleConfig = config.rules["no-component-color-override"] ?? {};

function kebabToPascal(s: string): string {
  return s.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("");
}

function loadUiComponents(): Set<string> {
  const dir = componentOverrideConfig.componentsDirectory;
  if (!dir) return new Set();
  try {
    return new Set(
      readdirSync(join(ROOT, dir))
        .filter((f) => f.endsWith(".tsx"))
        .map((f) => kebabToPascal(f.replace(/\.tsx$/, ""))),
    );
  } catch {
    return new Set();
  }
}

const isValidTailwindCandidate = await buildIsValidTailwindCandidate(config.colorTokenFiles[0]).catch(() => null);
const resolveNamespaceKind = await buildResolveNamespaceKind(config.colorTokenFiles).catch(() => null);

const tokens = {
  semanticSet: new Set(derivedSemanticTokens),
  spectralSet: TAILWIND_SPECTRAL_COLORS,
  colorPrefixes: TAILWIND_COLOR_PREFIXES,
  uiComponents: loadUiComponents(),
  isValidTailwindCandidate,
  resolveNamespaceKind,
};

const linter = createLinter(config.rules ?? {}, tokens, ansi);

const violations: OutViolation[] = [];
const ignores: OutIgnore[] = [];

function accumulate({ violations: vs, ignores: is }: LintResult, filePath: string): void {
  for (const { line, message, ruleId } of vs) {
    violations.push({ file: relative(ROOT, filePath), line, rule: ruleId, message });
  }
  for (const lineNum of is) {
    ignores.push({ file: relative(ROOT, filePath), line: lineNum });
  }
}

for (const f of collectSourceFiles(".css")) {
  const source = readFileSync(f, "utf-8");
  accumulate(linter.lintCssSource(source, EXEMPT_CSS.has(f)), f);
}

for (const f of collectSourceFiles(".tsx", ".ts")) {
  const source = readFileSync(f, "utf-8");
  accumulate(linter.lintStyleSource(source, f), f);
  accumulate(linter.lintTailwindSource(source, f), f);
  accumulate(linter.lintHoverSource(source, f), f);
  accumulate(linter.lintComponentSource(source, f), f);
}

// One-time herb WASM init before any .erb parse; Herb.parse is sync thereafter.
// A single `.erb` glob covers `.html.erb` too — extname("x.html.erb") === ".erb".
await loadHerb();
for (const f of collectSourceFiles(".erb")) {
  const source = readFileSync(f, "utf-8");
  accumulate(linter.lintErbSource(source, f), f);
}

const ignoreHint =
  ignores.length > 10
    ? " — consider revisiting the token rules or adding new tokens"
    : "";
const ignoresSummary =
  ignores.length > 0
    ? `  ${dim(`(${ignores.length} line${ignores.length !== 1 ? "s" : ""} suppressed with color-lint-ignore${ignoreHint})`)}`
    : "";

if (violations.length === 0) {
  console.log(
    `✓ No color lint violations found.${ignoresSummary ? `\n${ignoresSummary}` : ""}`,
  );
  // A missing configured dir forces non-zero even with zero violations — a
  // configured path could not be honored, so the run is not a clean pass.
  process.exit(hadMissingDir ? 1 : 0);
}

// Build rule label from colors.json description — that's the designer-facing source of truth.
const ruleModules: RuleModule[] = [
  ruleStyleColor, ruleRawCssColor, ruleVarColor, ruleAlphaModifier,
  ruleSpectralColor, ruleColorRules, ruleDarkModifier, ruleHoverInteractive,
  ruleUiColorOverride, ruleUndefinedToken,
];
const ruleLabel: Record<number, string> = Object.fromEntries(
  ruleModules.map((r) => [r.id, config.rules[r.name]?.description ?? `Rule ${r.id}`]),
);

const byRule = Map.groupBy(violations, (v) => v.rule);

let total = 0;
for (const [rule, items] of [...byRule.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`\n${bold(ruleLabel[rule] ?? `Rule ${rule}`)} (${items.length})`);
  for (const { file, line, message } of items) {
    console.log(`  ${dim(`${file}:${line}`)}  ${message}`);
    total++;
  }
}

console.log(
  `\n${total} violation${total !== 1 ? "s" : ""} found.${ignoresSummary ? `\n${ignoresSummary}` : ""}`,
);
process.exit(1);
