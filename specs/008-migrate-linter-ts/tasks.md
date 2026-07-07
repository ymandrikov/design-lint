# Tasks: Refactor and migrate the core linting engine (`linter.js`) → TypeScript

**Feature**: `specs/008-migrate-linter-ts` | **Branch**: `ym/explore`
**Input**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/linter-module.md](./contracts/linter-module.md), [quickstart.md](./quickstart.md)

**Tests**: No new test tasks. This is a behavior-preserving language migration and the module
is already covered by two Vitest suites (`linter.test.ts`, `linter.lintCss.test.ts`), which
are the behavior contract and MUST stay green with no assertion edits (only their import
specifier changes). `pnpm lint:demo` and `pnpm typecheck` are the additional gates
(spec: SC-003/SC-004/SC-005).

**Baseline to preserve**: `pnpm typecheck` = 0 errors; `pnpm lint:demo` = **23 violations,
1 suppressed**; `pnpm test` = all green.

---

## Phase 1: Setup

- [X] T001 Capture the green baseline before any edit: run `pnpm typecheck` (expect 0 errors), `node lint-color/index.js fixtures/demo-app | tail -3` (expect `23 violations found.` + `(1 line suppressed with color-lint-ignore)`), and `pnpm test` (record the passed-suite/test counts). These are the SC-002/SC-003/SC-004 comparison oracles.

## Phase 2: Foundational

_No foundational tasks. The migration is confined to one module; its creation is the first user-story task and blocks nothing else beforehand._

---

## Phase 3: User Story 1 — Core engine type-checked at its own contract (Priority: P1) 🎯 MVP

**Goal**: `lint-color/linter.ts` exists with the factory, its five `lint*Source` methods, the
four dispatch helpers, and the violation records typed; `pnpm typecheck` covers its body with
zero errors and zero unjustified `any`.

**Independent Test**: `test -f lint-color/linter.ts`; `pnpm typecheck` → 0 errors; no implicit
`any` on params/returns; any explicit `any` carries an inline justification.

- [X] T002 [US1] Create `lint-color/linter.ts` as a full typed rewrite of `lint-color/linter.js`, preserving the leading comment, the `postcss` import, the ten `import * as ruleX` rule namespaces (unchanged specifiers — FR-008), the `ast.ts`/`classify.ts` imports, and the runtime logic (no control-flow change). Define the engine-local types per [data-model.md](./data-model.md) and [contracts/linter-module.md](./contracts/linter-module.md): `Violation = { line: number; message: string; ruleId: number }`, the `{ violations, ignores }` result, the `tokens`/`config`/`ansi` shapes, and the dispatch-helper rule-module types. Derive `ColorParts` from `./classify.ts` (research D4) — do NOT import types from `helpers.ts`. Type the factory `createLinter(config, tokens, ansi)` and the five methods, plus `buildDisabledRules`, `lintSourceIfEnabled`, `checkTokenIfEnabled`, `checkValueIfEnabled`, `checkTailwindToken`, `checkTailwindClasses`. Keep `lint-color/linter.js` in place for now (deleted in US2). Do not introduce unjustified `any`.
- [X] T003 [US1] Run `pnpm typecheck` and resolve any errors originating in `lint-color/linter.ts` until it reports 0 errors (SC-002). Do not weaken types to silence errors; fix the shapes. Where `strictFunctionTypes` variance trips on the typed `no-spectral-color.ts` rule vs the `.js` rules, widen the ctx member types (e.g. `Record<string, unknown>` tokens/ruleConfig, matching the proven `helpers.ts` shape) rather than reaching for `any` (research D4). Any unavoidable `any` at the `.js`-namespace boundary carries a one-line `why` comment.

**Checkpoint**: `linter.ts` typechecks clean and standalone (old `linter.js` still present; importers unchanged).

---

## Phase 4: User Story 2 — Linter and test suite still run exactly as before (Priority: P1)

**Goal**: All three importers resolve to `linter.ts`, the old `linter.js` is gone, and both
the linter (demo) and the full Vitest suite run end-to-end with identical results.

**Independent Test**: `grep -rn 'linter\.js' lint-color` → no matches; `pnpm test` → all green
including the two engine suites; `pnpm lint:demo` → 23 violations, 1 suppressed, identical to
baseline.

- [X] T004 [US2] Update the import specifier `./linter.js` → `./linter.ts` in all three importers: `lint-color/index.js` (line 30), `lint-color/linter.test.ts` (line 4), and `lint-color/linter.lintCss.test.ts` (line 4). No other edit to these files — the test assertions are untouched (SC-004).
- [X] T005 [US2] Delete `lint-color/linter.js` (replaced by `linter.ts`, SC-001). Then run `grep -rn 'linter\.js' lint-color` and confirm no reference to the deleted module remains (FR-003). (The string in `no-spectral-color.ts`'s comment — "Built by checkTokenIfEnabled in linter.js" — is a stale doc reference, not an import; update it to `linter.ts` for accuracy if present.)
- [X] T006 [US2] Run `pnpm test` and confirm every suite is green, including `linter.test.ts` and `linter.lintCss.test.ts` now resolving the `.ts` module — same counts as the T001 baseline (SC-004). Then run `node lint-color/index.js fixtures/demo-app | tail -3` and confirm **23 violations, 1 suppressed** — byte-for-byte identical to the T001 baseline (SC-003). Any delta is a regression to fix before proceeding.

**Checkpoint**: Runtime and both suites load the TypeScript engine and produce identical output; no `linter.js` remains.

---

## Phase 5: User Story 3 — Rule dispatch and the violation pipeline preserved (Priority: P2)

**Goal**: The disabled-rules set, the three dispatch guards, the compose-once per-token
pipeline (with its two short-circuits), the five `lint*Source` methods, and the PostCSS CSS
walk are confirmed to produce identical output.

**Independent Test**: `pnpm test` all green (the two suites assert per-rule gating + CSS path);
`pnpm lint:demo` reports the identical violation set.

- [X] T007 [US3] Review `git diff --no-index lint-color/linter.js lint-color/linter.ts` (pre-delete, or against the committed JS) and confirm the change is annotations-plus-erasure only: the `buildDisabledRules` `enabled === false` set, the `lintSourceIfEnabled`/`checkTokenIfEnabled`/`checkValueIfEnabled` guards, the `checkTailwindToken` compose-once + `parts === null`/`!parts.base` short-circuits + rule order, the five method bodies, and the `lintCssSource` PostCSS walk (try/catch empty return, `color-lint-ignore` suppression + count, decl scan, `@apply` scan) are identical in logic (FR-005, FR-006). No behavior line changed.
- [X] T008 [US3] Confirm the two engine suites still assert the preserved behavior: `pnpm test lint-color/linter.test.ts lint-color/linter.lintCss.test.ts` → green (per-rule enable/disable across all ten rules, bracket/quote split integrity, CSS path). A failure signals a dispatch or pipeline regression to fix.

**Checkpoint**: All three user stories independently verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T009 Confirm no new build/bundle/loader step was introduced (SC-005): `package.json` unchanged; `tsconfig.json` unchanged (`allowJs`/`checkJs`/`allowImportingTsExtensions` already present — no edit needed). Node runs `.ts` natively.
- [X] T010 Confirm SC-006: `grep -n ':\s*any\|as any' lint-color/linter.ts` — expect no matches (or each inline-justified); zero unjustified `any`.
- [X] T011 Confirm SC-001: `ls lint-color/linter.*` shows `linter.ts`, `linter.test.ts`, `linter.lintCss.test.ts` — no `linter.js`.
- [X] T012 Final gate: re-run `pnpm typecheck && pnpm test && pnpm lint:demo` together; all green, 23 violations / 1 suppressed. Feature complete.

---

## Dependencies & Execution Order

- **Setup (T001)** → first; captures the comparison baseline.
- **US1 (T002–T003)** → depends on T001. Same-file (`linter.ts`), so sequential (no [P]).
- **US2 (T004–T006)** → depends on US1 (the `.ts` module must exist and typecheck before the imports point to it and the `.js` is deleted). Sequential: edit three specifiers → delete `.js` → verify suite + demo.
- **US3 (T007–T008)** → depends on US2 (runtime module must load). Diff review + targeted suites.
- **Polish (T009–T012)** → last.

## Parallel Opportunities

- T004's three specifier edits touch three distinct files and could be done in parallel, but
  they are a single trivial find-replace each along one dependency step, so they run together
  as one task. Otherwise the change is a single dependency chain (`linter.ts` → importers →
  verify), so tasks run sequentially. (Contrast the classify migration, which had eight
  independent import sites.)

## Implementation Strategy

- **MVP = User Story 1**: a typed `linter.ts` that `pnpm typecheck` covers with zero errors is
  the core value (types are the primary contract). US2 wires it into the runtime and both
  suites; US3 confirms dispatch/pipeline/CSS behavior.
- **Incremental delivery**: US1 (engine typed, standalone) → US2 (loaded + old deleted, suite +
  demo identical) → US3 (dispatch/pipeline/CSS parity confirmed). Each checkpoint is
  independently verifiable.

## Implementation Notes (actual outcome)

- **All 12 tasks complete.** Final gate green: `pnpm typecheck` 0 errors · `pnpm test`
  **393 passed (20 files)** · `pnpm lint:demo` **23 violations, 1 suppressed** — identical to
  the T001 baseline.
- **Files**: `lint-color/linter.ts` created (replaces `linter.js`, deleted); three import
  specifiers switched `./linter.js` → `./linter.ts` (`index.js`, `linter.test.ts`,
  `linter.lintCss.test.ts`); one stale doc reference in `no-spectral-color.ts`
  ("Built by checkTokenIfEnabled in linter.js" → `linter.ts`). No tsconfig/package.json change.
- **Types**: `createLinter(config: LinterConfig, tokens: Tokens, ansi: Ansi)`; `Violation =
  { line: number; message: string; ruleId: number }`; `LintResult = { violations: Violation[];
  ignores: number[] }`. `ColorParts` imported from `./classify.ts`; all other engine types
  defined locally — nothing imported from the test-scoped `helpers.ts` (research D4). **Zero
  `any`.**
- **Variance resolution (refinement of the T003 hint)**: the one typed rule
  (`no-spectral-color.ts`) declares its own private `ruleConfig` shape, which clashed
  contravariantly with a unified dispatch `ruleConfig` type. Rather than widen to
  `Record<string, unknown>` (still fails — `unknown` isn't assignable to the rule's concrete
  `replacement` type) or reach for `any`, the promised dispatch ctx types
  (`LintSourceCtx`/`CheckTokenCtx`) **omit `ruleConfig`**; it is still passed at runtime via a
  non-literal local (so it rides along without tripping excess-property checks). This makes the
  typed spectral rule and the nine permissive `.js` rules share one dispatch type with **no
  cast and no `any`**.
- **Two behavior-preserving type-only adjustments** (no runtime logic change): (1)
  `lintTailwindSource(source, filePath?)` — `filePath` made optional to match the existing
  one-arg call sites in `linter.test.ts` / `findings.test.ts` (the JS relied on
  `parseSource`'s `filePath` default); (2) two `line!` non-null assertions in `lintCssSource`
  (PostCSS always populates a parsed node's source position; the JS pushed `line` unguarded, so
  the assertion preserves that exact behavior). Both are erased at runtime — verified
  output-identical by the unchanged demo run and green suite.
