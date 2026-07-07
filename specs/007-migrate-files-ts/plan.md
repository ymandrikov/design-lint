# Implementation Plan: Refactor and migrate the file-discovery layer (`files.js`) from JavaScript to TypeScript

**Branch**: `ym/explore` (feature dir `007-migrate-files-ts`) | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-migrate-files-ts/spec.md`

## Summary

Rewrite `lint-color/files.js` as `lint-color/files.ts`, typing the file-discovery entry gate
the linter runs before any rule fires: the recursive walk `getAllFiles(dir: string,
...exts: string[]): string[]` and the Storybook predicate `isStorybookFile(filePath:
string): boolean`, plus the `Dirent<string>` records the walk filters (`isFile()`) and maps
(`extname(name)`, `parentPath`). The one non-erasure change: the JS `parentPath ?? path`
becomes `parentPath` alone — the deprecated `Dirent.path` alias is gone from `@types/node
^26.1.0` and, since `parentPath` is always populated, the fallback was dead code (output-
identical, verified by the demo). Otherwise annotations-plus-erasure, behavior-preserving.

Update the single runtime import specifier (`./files.js` → `./files.ts`) in `index.js` — the
only importer. There is no `files.test.ts` today, so no test specifier or assertion changes.
Node v26.1.0 runs `.ts` sources directly via native type stripping (already proven by shipped
`ast.ts`, `ansi.ts`, `classify.ts`, `no-spectral-color.ts`), so no build/bundler/loader step
is added. `tsconfig` already carries `allowImportingTsExtensions`, so no tsconfig edit is
needed. Baseline to hold: `pnpm typecheck` clean, demo-app **23 violations, 1 suppressed**.

## Technical Context

**Language/Version**: TypeScript source, run on Node v26.1.0 (native `.ts` type stripping; `type: module`, ESM); `tsconfig` `module`/`moduleResolution` `nodenext`, `strict`, `noEmit`, `allowImportingTsExtensions` already set.

**Primary Dependencies**: none new. The module depends only on the Node standard library (`node:fs` `readdirSync`, `node:path` `extname`/`join`); entries infer as `Dirent<string>` from `@types/node ^26.1.0` (already in-repo, no explicit import). No parser/AST types.

**Storage**: N/A (reads the filesystem via `readdirSync`; writes nothing).

**Testing**: No dedicated unit test exists for this module. Behavior is exercised end-to-end by `pnpm lint:demo`, which drives `getAllFiles`/`isStorybookFile` through the CLI entrypoint and asserts the demo-app violation set. Type gate: `pnpm typecheck` (`tsc --noEmit`). The full `pnpm test` suite must also stay green (nothing imports this module, so it is unaffected, but the gate still runs).

**Target Platform**: Node CLI (`node lint-color/index.js`).

**Project Type**: Single project — CLI linter. No frontend/backend split.

**Performance Goals**: No change. Type stripping is erasure-only; the `readdirSync` recursive walk and the filter/map pipeline are preserved exactly, so runtime cost is identical.

**Constraints**: No build/bundle/loader step (SC-004). No `any` without inline justification (constitution I). Public export surface (names + signatures) unchanged (FR-002). Recursive walk and Storybook exclusion preserved (FR-005, FR-006).

**Scale/Scope**: One module (20 lines, 2 exports) + one runtime import-specifier edit in `index.js`. No sibling modules, no tests, no vendored helpers touched (FR-008).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Verdict |
|-----------|------------|---------|
| I. Code Quality & Simplicity | Types the discovery entry gate — directly serves "types are the primary contract". Single-concern preserved; no new abstraction; behavior-preserving refactor only. The walk's inputs (`string`, `...string[]`), its `string[]` output, and the `Dirent` handling become typed. No `any` expected — the module reads plain strings and standard-library `Dirent` records. | PASS |
| II. Testing Standards | Behavior-preserving migration — no new behavior, so no new test owed. This module has no unit suite today; parity is held by the unchanged `pnpm lint:demo` output (23 violations, 1 suppressed, SC-003) and `pnpm typecheck`. `pnpm test` stays green (unaffected). Adding a unit test is permitted but not required by this migration. | PASS |
| III. UX Consistency | No output change: same files scanned, same violations, messages, suppression counts, exit codes (FR-007). No public-contract change (rule names/flags/config untouched) → no version bump owed. | PASS |
| IV. Performance | Type stripping is erasure; zero runtime delta. The recursive `withFileTypes` walk and the `extname` filter/`parentPath ?? path` map are preserved (FR-005) — no extra pass, no new allocation. | PASS |

**Result**: PASS, no violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/007-migrate-files-ts/
├── plan.md               # This file
├── research.md           # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── files-module.md   # Phase 1 output — exported surface contract
└── tasks.md              # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
lint-color/
├── files.js          # DELETE (replaced)
├── files.ts          # NEW (migrated module)
└── index.js          # EDIT: import specifier ./files.js → ./files.ts (sole importer)

# No test files import this module — no test edits.
```

**Structure Decision**: Single-project CLI linter. The change is confined to one module
swapped `.js`→`.ts` plus a single import-specifier edit in `index.js`. No new directories,
no tsconfig edit (`allowImportingTsExtensions` already present), no dependency change.

## Complexity Tracking

No constitution violations — section intentionally empty.
