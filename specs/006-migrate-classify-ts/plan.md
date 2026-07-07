# Implementation Plan: Refactor and migrate the color-classification layer (`classify.js`) from JavaScript to TypeScript

**Branch**: `ym/explore` (feature dir `006-migrate-classify-ts`) | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-migrate-classify-ts/spec.md`

## Summary

Rewrite `lint-color/classify.js` as `lint-color/classify.ts`, typing the color-classification
decision surface every color rule depends on: the verdict union (`ColorVerdict =
"semantic" | "spectral" | "static" | "raw" | "var" | null`), the token-set inputs
(`Tokens`), the token-split result (`SplitToken`), the composed color parts (`ColorParts`),
the spectral match (`SpectralMatch`), the arbitrary-property record, and every exported and
internal helper. The vendored parse-parity helpers (`./vendor/segment`, `is-valid-arbitrary`,
`decode-arbitrary-value`, `is-color`) are called unchanged; the migration types how this
module calls them at its own boundary. No `.type` strings, regexes, or control flow change —
this is erasure-plus-annotations, a behavior-preserving migration.

Update the eight runtime import specifiers (`./classify.js` / `../classify.js` → `.ts`) in
`index.js`, `linter.js`, `helpers.ts`, four rule modules, and the already-`.ts`
`no-spectral-color.ts`. Test files resolve `.js`→`.ts` via the runner (proven by shipped
`no-spectral-color.test.ts`); their specifiers are updated to `.ts` for consistency with no
assertion change. Node v26.1.0 runs `.ts` sources directly via native type stripping (already
proven by shipped `ast.ts`, `ansi.ts`, `no-spectral-color.ts`), so no build/bundler/loader
step is added. `tsconfig` already carries `allowImportingTsExtensions` (added in the ast
migration), so no tsconfig edit is needed. Baseline to hold: `pnpm typecheck` clean, demo-app
**23 violations, 1 suppressed**.

## Technical Context

**Language/Version**: TypeScript source, run on Node v26.1.0 (native `.ts` type stripping; `type: module`, ESM); `tsconfig` `module`/`moduleResolution` `nodenext`, `strict`, `noEmit`, `allowImportingTsExtensions` already set.

**Primary Dependencies**: none new. The module depends only on its own `./vendor/*` parity helpers (already in-repo) and standard library; no parser/AST types are read here (unlike the ast layer).

**Storage**: N/A

**Testing**: Vitest (`pnpm test`) — `classify.test.ts` (115 cases over the `EDGE_TOKENS` corpus and the classify family), `linter.test.ts`, `linter.lintCss.test.ts`, and the rule tests (`no-spectral-color`, `no-var-color`, `no-raw-css-color`, `no-opacity-modifier`, `token-constraints`) are the behavior contract. Type gate: `pnpm typecheck` (`tsc --noEmit`). End-to-end: `pnpm lint:demo`.

**Target Platform**: Node CLI (`node lint-color/index.js`).

**Project Type**: Single project — CLI linter. No frontend/backend split.

**Performance Goals**: No change. Type stripping is erasure-only; the classification hot path (per-candidate splitting, prefix scan, verdict resolution) is preserved exactly, so runtime cost is identical.

**Constraints**: No build/bundle/loader step (SC-005). No `any` without inline justification (constitution I). Public export surface (names + signatures) unchanged (FR-002). Verdict order and Tailwind parse-parity preserved (FR-005–FR-010).

**Scale/Scope**: One module (~279 lines) + eight runtime import-specifier edits and the test-file specifier edits. Sibling rules, the linter factory, and the vendored helpers stay as-is (FR-012).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Verdict |
|-----------|------------|---------|
| I. Code Quality & Simplicity | Types a core shared decision surface — directly serves "types are the primary contract". Single-concern preserved; no new abstraction; behavior-preserving refactor only. The verdict becomes a named union; token-set/parts/match shapes become named types. No `any` expected — this module reads plain strings/sets, not the reflective AST. | PASS |
| II. Testing Standards | Behavior-preserving migration — no new behavior, so no new test owed. Existing suites must stay green unchanged (SC-003) and `pnpm lint:demo` must be identical: 23 violations, 1 suppressed (SC-004). | PASS |
| III. UX Consistency | No output change: same violations, messages, suppression counts, exit codes (FR-011). No public-contract change (rule names/flags/config untouched) → no version bump owed. | PASS |
| IV. Performance | Type stripping is erasure; zero runtime delta. Per-candidate classification path and short-circuits preserved (FR-005–FR-010) — no extra pass, no new allocation. | PASS |

**Result**: PASS, no violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/006-migrate-classify-ts/
├── plan.md                  # This file
├── research.md              # Phase 0 output
├── data-model.md            # Phase 1 output
├── quickstart.md            # Phase 1 output
├── contracts/
│   └── classify-module.md   # Phase 1 output — exported surface contract
└── tasks.md                 # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
lint-color/
├── classify.js          # DELETE (replaced)
├── classify.ts          # NEW (migrated module)
├── index.js             # EDIT: import specifier ./classify.js → ./classify.ts
├── linter.js            # EDIT: import specifier ./classify.js → ./classify.ts
├── helpers.ts           # EDIT: import specifier ./classify.js → ./classify.ts
└── rules/
    ├── no-var-color.js                # EDIT: ../classify.js → ../classify.ts
    ├── no-component-color-override.js # EDIT: ../classify.js → ../classify.ts
    ├── no-opacity-modifier.js         # EDIT: ../classify.js → ../classify.ts
    ├── no-raw-css-color.js            # EDIT: ../classify.js → ../classify.ts
    └── no-spectral-color.ts           # EDIT: ../classify.js → ../classify.ts

# Test files (specifier → .ts, no assertion change):
lint-color/classify.test.ts, lint-color/linter.test.ts,
lint-color/linter.lintCss.test.ts,
lint-color/rules/{no-var-color,no-spectral-color,no-raw-css-color,no-opacity-modifier,token-constraints}.test.ts
```

**Structure Decision**: Single-project CLI linter. The change is confined to one module
swapped `.js`→`.ts` plus import-specifier edits. No new directories, no tsconfig edit
(`allowImportingTsExtensions` already present), no dependency change.

## Complexity Tracking

No constitution violations — section intentionally empty.
