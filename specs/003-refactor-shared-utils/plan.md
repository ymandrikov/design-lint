# Implementation Plan: Refactor lint-color/shared.js Junk-Drawer Module

**Branch**: `003-refactor-shared-utils` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-refactor-shared-utils/spec.md`

## Summary

`lint-color/shared.js` bundles five unrelated concerns plus four legacy pass-through
re-exports. The plan redistributes each concern to a single-concern home, removes the
re-export shims so importers reach the owning module directly, and deletes the emptied
`shared.js`. The refactor is behavior-frozen: identical linter output, identical public
export surface of `index.js`, no test assertion changed except import paths. Verification
is the existing gate trio — `pnpm typecheck`, `pnpm test`, `pnpm lint:demo` — which must be
byte-identical before and after.

Destination map (rationale in [research.md](./research.md)):

| Concern | Symbols | Destination | Move type |
|---|---|---|---|
| Terminal styling | `isTTY`, `red`, `blue`, `dim`, `bold` | new `lint-color/ansi.js` | extract to new module |
| File discovery | `getAllFiles`, `isStorybookFile` | new `lint-color/files.js` | extract to new module |
| Rule-dispatch gates | `buildDisabledRules`, `lintSourceIfEnabled`, `checkTokenIfEnabled`, `checkValueIfEnabled` | inline into `lint-color/linter.js` | inline into sole consumer |
| Test harness | `runTokenRuleOnSource` | existing `lint-color/helpers.ts` | move to test-support module |
| Legacy re-exports | `buildLineStarts`, `offsetToLine`, `TAILWIND_SPECTRAL_COLORS`, `TAILWIND_COLOR_PREFIXES` | owning `ast.js` / `classify.js` | delete shim, repoint importers |

After redistribution `shared.js` is empty → deleted.

## Technical Context

**Language/Version**: JavaScript + TypeScript, ESM (`"type": "module"`), Node `^26.1.0`

**Primary Dependencies**: `oxc-parser` (AST), `tailwindcss` v4 (`__unstable__loadDesignSystem`), `postcss` + `postcss-value-parser` (CSS values)

**Storage**: N/A (stateless linter over source files)

**Testing**: `vitest run` (`*.test.ts`), `tsc --noEmit` typecheck, `node lint-color/index.js fixtures/demo-app` demo run

**Target Platform**: Node CLI (dev tooling)

**Project Type**: Single project — CLI linter (`lint-color/` module tree + `tests/`)

**Performance Goals**: No regression on the demo fixture; parse-once-per-file preserved (this refactor does not touch the parse pipeline). Per Constitution Principle IV.

**Constraints**: Zero behavior change — identical violations/messages/counts/exit codes; no public-contract change (no version bump). Test edits limited to import paths.

**Scale/Scope**: ~14 symbols across 5 concerns; ~11 importer files (2 production: `index.js`, `linter.js`; ~7 rule tests; plus re-export importers). One module deleted, two created, one existing module (`helpers.ts`) extended.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**I. Code Quality & Simplicity** — ✅ Directly advances it. Splits a multi-concern module into
single-concern homes; deletes indirection (re-export shims) and a whole module (`shared.js`).
YAGNI respected: dispatch gates inline into their sole consumer rather than spawning a module
for one caller; ANSI/file-discovery extract because they are *not* the orchestrator's concern.

**II. Testing Standards (NON-NEGOTIABLE)** — ✅ No behavior change, so existing tests are the
proof. `pnpm test` must stay green with only import-path edits. No new behavior → no new test
required; the refactor's safety net is the unchanged exact-output e2e suite.

**III. User Experience Consistency** — ✅ Output contract untouched. CLI flags, config keys,
rule names, exit codes, suppression syntax all unchanged. `index.js` public exports preserved.

**IV. Performance Requirements** — ✅ Pure code-motion; no change to parse/candidate pipeline,
no added per-file work. Demo-fixture runtime unaffected.

**Gate result: PASS** — no violations, Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/003-refactor-shared-utils/
├── plan.md              # This file
├── research.md          # Phase 0 — destination decisions + rationale
├── data-model.md        # Phase 1 — symbol → home mapping, dependency edges
├── quickstart.md        # Phase 1 — behavior-freeze validation guide
├── contracts/
│   └── module-map.md    # Phase 1 — export-surface contract (before/after)
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
lint-color/
├── index.js             # CLI orchestrator — imports move: shared.js → ansi.js, files.js, classify.js
├── linter.js            # Core linting — absorbs the 4 rule-dispatch gates (inline)
├── ansi.js              # NEW — terminal styling (isTTY, red, blue, dim, bold)
├── files.js             # NEW — file discovery (getAllFiles, isStorybookFile)
├── ast.js               # Unchanged owner of buildLineStarts, offsetToLine (shim removed elsewhere)
├── classify.js          # Unchanged owner of TAILWIND_SPECTRAL_COLORS, TAILWIND_COLOR_PREFIXES
├── helpers.ts           # Test-support — gains runTokenRuleOnSource
├── shared.js            # DELETED after redistribution
└── rules/
    ├── no-spectral-color.ts        # comment referencing checkTokenIfEnabled updated
    └── *.test.ts                   # runTokenRuleOnSource import repointed to helpers.ts

tests/
├── e2e.test.ts          # Unchanged — the behavior-freeze oracle
└── findings.test.ts     # Unchanged
```

**Structure Decision**: Single-project CLI. Utilities relocate within the existing
`lint-color/` tree; no new package or public export surface. Two new single-concern modules
(`ansi.js`, `files.js`), one deleted (`shared.js`), one extended (`helpers.ts`), dispatch
gates absorbed into `linter.js`.

## Complexity Tracking

> Not applicable — Constitution Check passed with no violations.
