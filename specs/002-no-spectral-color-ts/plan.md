# Implementation Plan: Migrate `no-spectral-color` rule from JavaScript to TypeScript

**Branch**: `ym/explore` (feature dir `002-no-spectral-color-ts`) | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-no-spectral-color-ts/spec.md`

## Summary

Rewrite `lint-color/rules/no-spectral-color.js` as `no-spectral-color.ts`, expressing the
rule's contract (`id`, `name`, `checkToken`), its `ctx` fields (`tokens`, `ansi`,
`ruleConfig`), the `parts` shape, and the replacement-map structure as compiler-enforced
types — with no `any` (or an inline-justified one). Update the two static import specifiers
in `lint-color/index.js` and `lint-color/linter.js` from `.js` to `.ts`. Node v26.1.0 runs
`.ts` sources directly via native type stripping — verified by probe — so no build, bundler,
or loader step is added. Behavior, messages, coloring, and the demo-app violation set are
preserved byte-for-byte; the existing `no-spectral-color.test.ts` suite passes unchanged.

## Technical Context

**Language/Version**: TypeScript 6.0.3 source, run on Node v26.1.0 (native `.ts` type stripping; `type: module`, ESM)

**Primary Dependencies**: none new. Consumes existing `lint-color/classify.js` (`classifyParts`, `findSpectralMatch`, `composeColorParts`) and `lint-color/shared.js` (`ansi`); those stay JavaScript.

**Storage**: N/A

**Testing**: Vitest 4.1.9 (`pnpm test`); existing `lint-color/rules/no-spectral-color.test.ts` is the behavior contract. Type gate: `pnpm typecheck` (`tsc --noEmit`). End-to-end: `pnpm lint:demo`.

**Target Platform**: Node CLI (`node lint-color/index.js`)

**Project Type**: Single project — CLI linter. No frontend/backend split.

**Performance Goals**: No change. Type stripping is erasure-only; runtime cost identical to the JS module. Linear-in-candidates (constitution IV) is unaffected.

**Constraints**: No build/bundle/loader step may be introduced (SC-005). No `any` without inline justification (constitution I). Public rule surface (`id`, `name`, `checkToken` signature) unchanged (FR-002).

**Scale/Scope**: One rule module (~49 lines) + two one-line import-specifier edits. Sibling rules and shared modules stay JavaScript (FR-009).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Verdict |
|-----------|------------|---------|
| I. Code Quality & Simplicity | Migration makes the rule's contract explicit in the primary type system — directly serves "types are the primary contract". Single-concern preserved; no new abstraction; no `any` planned. | PASS |
| II. Testing Standards | Behavior-preserving migration — no new behavior, so no new test is owed. The existing `.test.ts` suite must stay green unchanged (SC-003), and `pnpm lint:demo` output must be identical (SC-004). | PASS |
| III. UX Consistency | Message text, coloring (`ansi`), rule name, id, and exit behavior are unchanged (FR-007). No public-contract change → no version bump owed. | PASS |
| IV. Performance | Type stripping is erasure; zero runtime delta. No re-parse, no new allocation. | PASS |

**Result**: PASS, no violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/002-no-spectral-color-ts/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── check-token.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
lint-color/
├── index.js             # EDIT: import specifier ./rules/no-spectral-color.js → .ts
├── linter.js            # EDIT: import specifier ./rules/no-spectral-color.js → .ts
├── classify.js          # unchanged (consumed; stays JS, JSDoc-typed)
├── shared.js            # unchanged (ansi, ctx builder; stays JS)
└── rules/
    ├── no-spectral-color.js       # DELETE (replaced)
    ├── no-spectral-color.ts       # NEW (migrated module)
    └── no-spectral-color.test.ts  # unchanged (behavior contract)

tsconfig.json            # EDIT only if typecheck requires allowImportingTsExtensions (see research)
```

**Structure Decision**: Single-project CLI linter. The change is confined to `lint-color/rules/` (one module swapped `.js`→`.ts`) plus two import-specifier edits in `lint-color/`. No new directories.

## Complexity Tracking

No constitution violations — section intentionally empty.
