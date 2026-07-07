# Implementation Plan: Refactor and migrate the core linting engine (`linter.js`) from JavaScript to TypeScript

**Branch**: `ym/explore` (feature dir `008-migrate-linter-ts`) | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-migrate-linter-ts/spec.md`

## Summary

Rewrite `lint-color/linter.js` as `lint-color/linter.ts`, typing the orchestration hub every
rule runs inside: the factory `createLinter(config, tokens, ansi)` and the five `lint*Source`
methods it returns (`lintTailwindSource`, `lintStyleSource`, `lintHoverSource`,
`lintComponentSource`, `lintCssSource`), the rule-dispatch helpers (`buildDisabledRules`,
`lintSourceIfEnabled`, `checkTokenIfEnabled`, `checkValueIfEnabled`), and the per-token
pipeline (`checkTailwindToken`, `checkTailwindClasses`). The typed surface makes the
`{ line, message, ruleId }` violation record, the `{ violations, ignores }` result, and the
`config`/`tokens`/`ansi` inputs explicit. Types are defined locally and derived from
`classify.ts` (`ColorParts`, `Tokens`) — mirroring the already-migrated `no-spectral-color.ts`
convention — not imported from the test-scoped `helpers.ts`.

Update three runtime/test import specifiers (`./linter.js` → `./linter.ts`) in `index.js`,
`linter.test.ts`, and `linter.lintCss.test.ts` — the only importers. `linter.ts` becomes the
first `.ts` module to `import * as` the ten rule modules; under `tsconfig`
`allowJs: true, checkJs: false` the nine `.js` namespaces resolve with permissive
(`any`-param) signatures, so **no rule module is migrated or edited**. Node v26.1.0 runs `.ts`
directly via native type stripping (already proven by `ast.ts`, `classify.ts`,
`no-spectral-color.ts`), so no build/bundler/loader step is added. Baseline to hold:
`pnpm typecheck` clean, demo-app **23 violations, 1 suppressed**, `pnpm test` green.

## Technical Context

**Language/Version**: TypeScript source, run on Node v26.1.0 (native `.ts` type stripping; `type: module`, ESM); `tsconfig` `module`/`moduleResolution` `nodenext`, `strict`, `noEmit`, `allowImportingTsExtensions`, `allowJs: true`, `checkJs: false` all already set.

**Primary Dependencies**: `postcss` (already a dependency, used by `lintCssSource`); the ten rule modules (`./rules/*`, imported as namespaces); `composeColorParts` and the `ColorParts`/`Tokens` types from `./classify.ts`; the AST helpers (`parseSource`, `walk`, `jsxName`, `classNameStatics`, `ignoredLines`, `offsetToLine`) from `./ast.ts`. No new dependency.

**Storage**: N/A (operates on in-memory source strings; the CLI entrypoint does the file I/O).

**Testing**: Two dedicated Vitest suites already import this module — `linter.test.ts` and `linter.lintCss.test.ts` — and are the primary behavior contract; they MUST stay green with no assertion edits (only their import specifier changes). Behavior is also exercised end-to-end by `pnpm lint:demo`. Type gate: `pnpm typecheck` (`tsc --noEmit`). The full `pnpm test` suite MUST stay green.

**Target Platform**: Node CLI (`node lint-color/index.js`) plus the Vitest runner.

**Project Type**: Single project — CLI linter. No frontend/backend split.

**Performance Goals**: No change. Type stripping is erasure-only; the disabled-rules set, the dispatch guards, the compose-once per-token pipeline, and the PostCSS walk are preserved exactly, so runtime cost is identical.

**Constraints**: No build/bundle/loader step (SC-005). No `any` without inline justification (constitution I). Public export surface (factory + five method names + signatures) unchanged (FR-002). Rule dispatch, per-token pipeline, and CSS walk preserved (FR-005, FR-006). No rule module migrated (FR-008).

**Scale/Scope**: One module (209 lines, one factory + five methods + four helpers) + three import-specifier edits (`index.js`, `linter.test.ts`, `linter.lintCss.test.ts`). No rule modules, no CLI logic, no vendored helpers touched (FR-008).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Verdict |
|-----------|------------|---------|
| I. Code Quality & Simplicity | Types the orchestration hub — directly serves "types are the primary contract". Single-concern preserved (in-memory linting engine); no new abstraction; behavior-preserving refactor only. The factory inputs (`config`, `tokens`, `ansi`), the violation record, the result shape, and the four dispatch helpers become typed. Types are defined locally / derived from `classify.ts`, keeping production code independent of the test-scoped `helpers.ts`. `any` is expected only (if at all) at the `.js`-rule-namespace boundary, inline-justified. | PASS |
| II. Testing Standards | Behavior-preserving migration — no new behavior, so no new test owed. Unlike 007, this module already has two unit suites (`linter.test.ts`, `linter.lintCss.test.ts`); they are the behavior contract and stay green with no assertion edits (only the import specifier changes). Parity is held by those suites plus the unchanged `pnpm lint:demo` output (23 / 1, SC-003) and `pnpm typecheck`. | PASS |
| III. UX Consistency | No output change: same files scanned, same violations, messages, rule grouping, suppression counts, exit codes (FR-007). No public-contract change (rule names/ids/config untouched) → no version bump owed. | PASS |
| IV. Performance | Type stripping is erasure; zero runtime delta. The dispatch set, the three guards, the compose-once pipeline, and the PostCSS declaration/`@apply`/comment walk are preserved (FR-005, FR-006) — no extra pass, no new allocation. | PASS |

**Result**: PASS, no violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/008-migrate-linter-ts/
├── plan.md               # This file
├── research.md           # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── linter-module.md  # Phase 1 output — exported surface contract
└── tasks.md              # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
lint-color/
├── linter.js               # DELETE (replaced)
├── linter.ts               # NEW (migrated module)
├── index.js                # EDIT: import specifier ./linter.js → ./linter.ts (importer 1/3)
├── linter.test.ts          # EDIT: import specifier ./linter.js → ./linter.ts (importer 2/3)
└── linter.lintCss.test.ts  # EDIT: import specifier ./linter.js → ./linter.ts (importer 3/3)

# The ten rule modules and classify.ts/ast.ts are imported unchanged — not migrated, not edited.
```

**Structure Decision**: Single-project CLI linter. The change is confined to one module
swapped `.js`→`.ts` plus three import-specifier edits. No new directories, no tsconfig edit
(`allowJs`/`allowImportingTsExtensions`/`checkJs` already present), no dependency change.

## Complexity Tracking

No constitution violations — section intentionally empty.
