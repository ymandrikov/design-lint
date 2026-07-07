# Implementation Plan: Refactor and migrate the AST layer (`ast.js`) from JavaScript to TypeScript

**Branch**: `ym/explore` (feature dir `005-migrate-ast-ts`) | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-migrate-ast-ts/spec.md`

## Summary

Rewrite `lint-color/ast.js` as `lint-color/ast.ts`, typing the AST boundary the whole
linter depends on: the parsed-AST value (`ParsedAst`), the module-level parse cache, and
every exported helper (`buildLineStarts`, `offsetToLine`, `parseSource`, `walk`, `jsxName`,
`ignoredLines`, `classNameStatics`, `classNameStaticsDeep`, `styleObjectProps`). AST-node
types come from `oxc-parser`, which re-exports `@oxc-project/types` (`export * from
"@oxc-project/types"`); its interfaces are ESTree-compatible, so the discriminants the code
already narrows on (`"Literal"`, `"Property"`, `"TemplateLiteral"`, `"JSXExpressionContainer"`,
`"TSAsExpression"`, …) match the existing runtime `.type` checks **unchanged** — the
migration types the module without rewriting a single `.type` string. Update the five import
specifiers (`./ast.js` / `../ast.js` → `.ts`) in `linter.js`, `helpers.ts`, and the three
rule modules. Node v26.1.0 runs `.ts` sources directly via native type stripping (already
proven by the shipped `no-spectral-color.ts` and `ansi.ts`), so no build/bundler/loader step
is added. Behavior — one parse per file with LRU-1 caching, language-by-extension, best-effort
recovery, line-scoped suppression, shallow/deep className extraction, AST-driven style reading —
is preserved. Baseline to hold: `pnpm typecheck` clean, demo-app **23 violations, 1 suppressed**.

## Technical Context

**Language/Version**: TypeScript source, run on Node v26.1.0 (native `.ts` type stripping; `type: module`, ESM); `tsconfig` `module`/`moduleResolution` `nodenext`, `strict`, `noEmit`.

**Primary Dependencies**: none new. AST-node and parse-result types come from `oxc-parser@0.138.0` (re-exports `@oxc-project/types@0.138.0`), already installed and used at runtime via `parseSync`.

**Storage**: N/A

**Testing**: Vitest (`pnpm test`) — `linter.test.ts`, `linter.lintCss.test.ts`, `classify.test.ts`, and the rule tests that walk this AST are the behavior contract. Type gate: `pnpm typecheck` (`tsc --noEmit`). End-to-end: `pnpm lint:demo`.

**Target Platform**: Node CLI (`node lint-color/index.js`).

**Project Type**: Single project — CLI linter. No frontend/backend split.

**Performance Goals**: No change. Type stripping is erasure-only; the single-parse-per-file LRU-1 cache (constitution IV) is preserved exactly, so runtime cost is identical.

**Constraints**: No build/bundle/loader step (SC-005). No `any` without inline justification (constitution I); the reflective `walk` boundary is the one place `unknown`/justified-`any` may be needed. Public export surface (names + signatures) unchanged (FR-002).

**Scale/Scope**: One module (~207 lines) + five one-line import-specifier edits. Sibling rules and shared modules stay JavaScript (FR-012).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Verdict |
|-----------|------------|---------|
| I. Code Quality & Simplicity | Types the single most depended-upon boundary module — directly serves "types are the primary contract". Single-concern preserved; no new abstraction; behavior-preserving refactor only. `any` avoided; the reflective `walk` uses `unknown` + narrowing, or an inline-justified `any`. | PASS |
| II. Testing Standards | Behavior-preserving migration — no new behavior, so no new test owed. Existing suites must stay green unchanged (SC-003) and `pnpm lint:demo` must be identical: 23 violations, 1 suppressed (SC-004). | PASS |
| III. UX Consistency | No output change: same violations, messages, suppression counts, exit codes (FR-011). No public-contract change (rule names/flags/config untouched) → no version bump owed. | PASS |
| IV. Performance | Type stripping is erasure; zero runtime delta. Single-parse LRU-1 cache and short-circuits preserved (FR-005) — no re-parse, no new allocation. | PASS |

**Result**: PASS, no violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/005-migrate-ast-ts/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── ast-module.md    # Phase 1 output — exported surface contract
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
lint-color/
├── ast.js               # DELETE (replaced)
├── ast.ts               # NEW (migrated module)
├── linter.js            # EDIT: import specifier ./ast.js → ./ast.ts
├── helpers.ts           # EDIT: import specifier ./ast.js → ./ast.ts
└── rules/
    ├── no-component-color-override.js  # EDIT: ../ast.js → ../ast.ts
    ├── no-useless-hover.js             # EDIT: ../ast.js → ../ast.ts
    └── no-style-color.js               # EDIT: ../ast.js → ../ast.ts

tsconfig.json            # EDIT: add allowImportingTsExtensions (typecheck-only; see note)
```

**Structure Decision**: Single-project CLI linter. The change is confined to one module
swapped `.js`→`.ts`, five import-specifier edits, and one typecheck-only tsconfig flag.
No new directories.

> **Post-implementation correction**: this plan originally predicted "no tsconfig change,"
> reasoning from the shipped `.ts` rules. That held only because those rules are imported
> solely from *untyped* `.js` files. `helpers.ts` is the first *type-checked* `.ts` file to
> statically import a `.ts` module by explicit extension, which `tsc` rejects without
> `allowImportingTsExtensions: true`. The flag was added — it is compiler-check-only and does
> not affect running the linter (Node strips types natively), so SC-005 still holds.

## Complexity Tracking

No constitution violations — section intentionally empty.
