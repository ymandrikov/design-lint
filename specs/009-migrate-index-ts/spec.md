# Feature Specification: Refactor and migrate the CLI entrypoint (`index.js`) from JavaScript to TypeScript

**Feature Branch**: `ym/explore`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Refactor lint-color/index.js and migrate from JS to TS."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The CLI entrypoint is type-checked at its own contract (Priority: P1)

A rule author opens the linter's entrypoint and finds it written in TypeScript. The orchestration
the file performs — building the Tailwind candidate validator (`buildIsValidTailwindCandidate`),
loading the design-system config, deriving semantic token names, discovering UI components
(`loadUiComponents`), assembling the `tokens` bundle, running every rule over each source file,
and formatting the grouped violation report — carries compiler-enforced types. The config object
parsed from `colors.json`, the `violations`/`ignores` accumulators, the `accumulate(result,
filePath)` helper's shape, and the `tokens` bundle passed to `createLinter` are all typed against
the contracts the migrated sibling modules (`classify.ts`, `linter.ts`, `files.ts`, `ansi.ts`)
already export. `pnpm typecheck` now covers the body of this module — the top of the call tree —
not just the modules it drives.

**Why this priority**: This is the whole point of the change. `index.js` is the last JavaScript
source in the `lint-color` orchestration layer: every sibling it imports (`ansi`, `files`,
`classify`, `linter`, `no-spectral-color`) is already TypeScript, and this file is the one place
their typed contracts are assembled into a run. The constitution names TypeScript types "the
primary contract," and the entrypoint that wires the whole linter together is still authored in
untyped JavaScript. Typing the config parse, the `tokens` bundle, the accumulator records, and the
report-formatting locals is the value delivered; everything else is preservation.

**Independent Test**: Confirm the module now lives at a `.ts` path, `pnpm typecheck` passes with
zero errors, and the file's own locals, function parameters, and return values carry types (no
implicit `any` on parameters or returns; any explicit `any` carries an inline justification).

**Acceptance Scenarios**:

1. **Given** the migrated entrypoint, **When** `pnpm typecheck` runs, **Then** it reports zero errors and the module's own config object, accumulators, helper parameters, and `tokens` bundle are typed.
2. **Given** the assembled `tokens` bundle and `config.rules`, **When** passed to `createLinter`, **Then** they satisfy the typed signature `linter.ts` exports, with no cast bridging the two.

---

### User Story 2 - The linter still runs and reports exactly as before (Priority: P1)

An app developer runs the linter (`pnpm lint:demo` / `node lint-color/index.ts fixtures/demo-app`)
exactly as before. The entrypoint parses the same config, discovers the same files, runs the same
rules in the same order, and prints the same grouped report — same violations, same messages, same
counts, same suppression summary, same exit codes (0 when clean, 1 when violations are found) — as
it did when the file was JavaScript. The `pnpm lint:demo` script continues to launch the linter
with no build, bundle, or loader step introduced.

**Why this priority**: The entrypoint IS the linter's runtime; a `.ts` entrypoint the runtime can
no longer launch breaks every lint run. Because this file is invoked directly by name (via the
`lint:demo` package script and by hand as `node lint-color/index.<ext>`), its filename is part of
the run contract: renaming `index.js` → `index.ts` requires the invoking `lint:demo` script to
reference the new path, and that script edit is part of this change, not an afterthought. Node
`^26.1.0` runs `.ts` sources directly via native type stripping, so no build step is added.

**Independent Test**: Run `pnpm lint:demo` over the demo-app fixture before and after the migration
and confirm the full run — files scanned, violations, messages, counts, suppression summary, and
exit code — is byte-for-byte identical.

**Acceptance Scenarios**:

1. **Given** the `pnpm lint:demo` script, **When** it is run after the migration, **Then** it launches the migrated `.ts` entrypoint and produces output identical to the pre-migration run.
2. **Given** the demo-app fixture, **When** the linter runs after migration, **Then** the complete report (files, violations, messages, counts, suppression line) and the process exit code are identical to the pre-migration run.
3. **Given** the CLI entrypoint invoked directly (`node lint-color/index.ts fixtures/demo-app`), **When** it loads with no build or bundle step, **Then** it resolves, runs top-level `await`, and exits with the same code as before.

---

### User Story 3 - Orchestration and report formatting are preserved exactly (Priority: P2)

A design-system maintainer sees no change in how the linter behaves because the entrypoint's
observable logic is unchanged: the target-root resolution (`process.argv[2]` else two directories
up), the `__unstable__loadDesignSystem` setup with its `loadStylesheet`/`loadModule` resolvers and
their `try/catch` fallbacks, the derivation of semantic tokens from `--color-*` aliases, the
`kebabToPascal` component-name mapping, the CSS pass then the TS/TSX pass over discovered files, the
`Map.groupBy` grouping of violations by rule, the rule-label lookup from `colors.json` descriptions,
and the `ignores.length > 10` hint threshold in the suppression summary.

**Why this priority**: Preserving observable behavior is the contract of a language migration. It is
P2 only because Stories 1 and 2 already assert typing and end-to-end parity; this story pins the
specific orchestration and formatting cases the entrypoint encodes.

**Acceptance Scenarios**:

1. **Given** no CLI argument, **When** the entrypoint resolves the target root, **Then** it uses the same two-directories-up default as today; **Given** an explicit `argv[2]`, **Then** it resolves that path, unchanged.
2. **Given** the demo-app config and sources, **When** the run assembles the report, **Then** the rule grouping, per-rule labels, ordering (rules sorted ascending by id), and the suppression summary (including the `> 10` hint) are identical to today.
3. **Given** a design-system entry CSS that fails to load, **When** `buildIsValidTailwindCandidate` rejects, **Then** `isValidTailwindCandidate` falls back to `null` exactly as the current `.catch(() => null)` guard does.

---

### Edge Cases

- **Renamed entrypoint and the `lint:demo` script**: unlike the sibling migrations (where `index.js` was only an *importer* to update), this file *is* the thing invoked by name. The `package.json` `lint:demo` script (`node lint-color/index.js fixtures/demo-app`) must be updated to the `.ts` path, or the script breaks. This is the one non-source edit the migration requires and is part of the run contract.
- **Shebang line**: the file opens with `#!/usr/bin/env node`. There is no `bin` entry in `package.json` (the file is invoked as an argument to `node`, not executed directly), so the shebang is cosmetic today. It is preserved as-is; it neither helps nor harms `.ts` execution under `node lint-color/index.ts`.
- **Permissively-typed rule namespaces**: the ten `import * as rule... from "./rules/*.js"` namespaces resolve under `allowJs`/`checkJs:false` as permissive values; the `ruleLabel` builder reads `r.id`/`r.name` off them. These remain untyped at the boundary (the rule modules are out of scope). Any resulting `any` at that seam carries an inline justification; no rule module is migrated by this change.
- **Untyped Tailwind internal**: `__unstable__loadDesignSystem` and the `ds` design-system handle it returns are third-party/internal API surface whose types may be absent or `any`. The migration types what it controls (the resolver callbacks' parameters, the returned predicate) and does not fabricate types for the Tailwind internal beyond what its package provides; any `any` at that seam carries an inline justification.
- **Top-level `await`**: the module uses top-level `await` (`await buildIsValidTailwindCandidate(...)`); this is preserved and requires no config change under the existing ESM (`type: module`) + `nodenext` setup.
- **Behavior-preserving refactor only**: any structural cleanup done alongside the migration (typing a local, re-sectioning, a comment tidy) must not change any observable output or exit code; it is bounded by the same before/after demo-app parity as the migration itself.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CLI entrypoint MUST be authored in TypeScript, replacing the existing JavaScript module, at a `.ts` path (`lint-color/index.ts`).
- **FR-002**: The migrated entrypoint MUST preserve its observable runtime behavior exactly — the same config parse, file discovery, rule execution order, grouped report, suppression summary, and process exit codes (0 clean / 1 with violations) — so every consumer that runs the linter keeps working unchanged.
- **FR-003**: Every reference that invokes the entrypoint by path MUST be updated to the migrated `.ts` path — specifically the `package.json` `lint:demo` script — so the linter launches with no other loader or build configuration required. No new build, bundle, or transpile step may be introduced.
- **FR-004**: The module's config object, derived token sets, accumulator records (`violations`, `ignores`), helper parameters (`accumulate`, `buildIsValidTailwindCandidate`, `loadUiComponents`, `kebabToPascal`), and the `tokens` bundle MUST carry types, consuming the contracts the migrated sibling modules (`classify.ts`, `linter.ts`, `files.ts`, `ansi.ts`) export. Any explicit `any` (e.g. at the permissive rule-namespace or Tailwind-internal seam) MUST carry an inline justification. `pnpm typecheck` MUST pass with zero errors.
- **FR-005**: The target-root resolution MUST be preserved exactly: `process.argv[2]` resolved if present, otherwise two directories up from the module (`join(__dirname, "../..")`), with `SRC` = `join(ROOT, "src")` unchanged.
- **FR-006**: The design-system loader (`buildIsValidTailwindCandidate`) MUST preserve its behavior exactly — the `__unstable__loadDesignSystem` call, the `loadStylesheet` and `loadModule` resolver callbacks with their local-then-package `try/catch` fallbacks, the returned `candidatesToCss` predicate, and the top-level `.catch(() => null)` fallback that yields `null` on failure.
- **FR-007**: The report assembly MUST be preserved exactly: violations grouped by rule via `Map.groupBy`, rules sorted ascending by numeric id, per-rule labels drawn from `colors.json` `description` (falling back to `Rule ${id}`), the total count line, and the suppression summary including the `ignores.length > 10` hint threshold and singular/plural wording.
- **FR-008**: The change MUST be scoped to this one module (plus the single `package.json` `lint:demo` script edit in FR-003). Migrating rule modules or altering orchestration logic is out of scope. Any refactoring is behavior-preserving.
- **FR-009**: The demo-app run (`pnpm lint:demo`) MUST be unchanged (zero net delta) after the migration — same violations, messages, counts, suppression summary, and exit code — and `pnpm test` MUST remain green.

### Key Entities *(include if feature involves data)*

- **Lint config**: the object parsed from `design-system/lint/colors.json` — `colorTokenFiles`, `rules` (keyed by rule name, each with a `description`), and the `no-component-color-override` sub-config (`componentsDirectory`). Its runtime values must be identical before and after; the migration gives it a declared shape at the parse boundary.
- **Tokens bundle**: the `{ semanticSet, spectralSet, colorPrefixes, uiComponents, isValidTailwindCandidate }` object assembled and passed to `createLinter`; its type MUST satisfy the `tokens` parameter `linter.ts` declares, with no cast bridging the seam.
- **Violation / ignore record**: the accumulated `{ file, line, rule, message }` violations and `{ file, line }` ignores; their shapes are typed and their values (and ordering) are identical before and after.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The CLI entrypoint source is a TypeScript module (`lint-color/index.ts`); zero JavaScript source remains in the `lint-color` orchestration layer (every non-`rules/` module is now `.ts`).
- **SC-002**: `pnpm typecheck` passes with zero errors, with the entrypoint's own body now within type coverage.
- **SC-003**: The demo-app fixture (`pnpm lint:demo`) produces an identical run — files scanned, violations, messages, counts, suppression summary, and process exit code — before and after the change (zero net delta: `23 violations found.` with `1 line suppressed`).
- **SC-004**: `pnpm test` is green after the change with no test count regression.
- **SC-005**: The linter runs end-to-end via its normal entrypoint (`node lint-color/index.ts` / `pnpm lint:demo`) with no new build, bundling, or loader step introduced by the change.
- **SC-006**: The migrated module introduces zero unjustified `any`; every `any` (at the rule-namespace or Tailwind-internal seam, if any) carries an inline rationale.

## Assumptions

- The project runs TypeScript source directly (Node engine `^26.1.0` native type stripping, `tsconfig` `noEmit`); the migrated `.ts` entrypoint can be launched and executed — including its top-level `await` — without adding a compile or bundle step, invoked as `node lint-color/index.ts` per the repo's established convention.
- This file is the last JavaScript module in the `lint-color` orchestration layer; every sibling it imports is already TypeScript, so the migration consumes existing typed contracts rather than defining new ones.
- The entrypoint is invoked by path (the `lint:demo` package script and by hand), not imported by any other module; the only external edit the migration needs is the `lint:demo` script path. No `bin` entry exists, so the shebang is cosmetic and preserved as-is.
- The ten rule namespaces (`./rules/*.js`) and the Tailwind internal `__unstable__loadDesignSystem` remain out of scope; the permissive/absent types at those seams are accepted (with inline justification for any `any`) rather than resolved by this change.
- This module has no dedicated unit test; its behavior is verified end-to-end by the unchanged demo-app run (`pnpm lint:demo`) and by `pnpm typecheck`. Adding a focused test is optional and out of the migration's required scope.
- This is a language migration with behavior-preserving refactoring, not a behavior change: no new orchestration behavior, no new configuration surface, and no change to which files are scanned, which rules run, or how the report is formatted.
