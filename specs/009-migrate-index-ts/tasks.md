# Tasks: Refactor and migrate the CLI entrypoint (`index.js`) → TypeScript

**Feature**: `specs/009-migrate-index-ts` | **Branch**: `ym/explore`
**Input**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/cli-entrypoint.md](./contracts/cli-entrypoint.md), [quickstart.md](./quickstart.md)

**Tests**: No new test tasks. This is a behavior-preserving language migration of the top-level
wiring, which has no dedicated unit suite (it IS the entrypoint). Behavior is verified
end-to-end by `pnpm lint:demo` (exact violation set + suppression summary + exit code) and by
`pnpm typecheck`; the full `pnpm test` suite (exercising the driven siblings) MUST stay green
(spec: SC-003/SC-004/SC-005).

**Baseline to preserve**: `pnpm typecheck` = 0 errors; `pnpm lint:demo` = **23 violations,
1 suppressed** (exit 1 on the direct invocation); `pnpm test` = all green.

**What makes this migration different**: `index.js` is the *invoked* entrypoint, not an imported
module — nothing in-repo imports it. So the one external edit is the `package.json` `lint:demo`
script path (`index.js` → `index.ts`), NOT import-specifier edits. This is the terminal
migration: after it, every non-`rules/` module in `lint-color/` is TypeScript.

---

## Phase 1: Setup

- [X] T001 Capture the green baseline before any edit: run `pnpm typecheck` (expect 0 errors), `node lint-color/index.js fixtures/demo-app | tail -3` (expect `23 violations found.` + `(1 line suppressed with color-lint-ignore)`) and note the exit code is 1, and `pnpm test` (record the passed-suite/test counts). These are the SC-002/SC-003/SC-004 comparison oracles.

## Phase 2: Foundational

_No foundational tasks. The migration is confined to one module plus one script-path edit; the module's creation is the first user-story task and blocks nothing beforehand._

---

## Phase 3: User Story 1 — CLI entrypoint type-checked at its own contract (Priority: P1) 🎯 MVP

**Goal**: `lint-color/index.ts` exists as a full typed rewrite — config parse, `tokens` bundle,
`accumulate` records, loader callbacks, and report-formatting locals typed; `pnpm typecheck`
covers its body with zero errors and zero unjustified `any`.

**Independent Test**: `test -f lint-color/index.ts`; `pnpm typecheck` → 0 errors; no implicit
`any` on params/returns; any explicit `any` carries an inline justification.

- [X] T002 [US1] Create `lint-color/index.ts` as a full typed rewrite of `lint-color/index.js`, preserving the shebang (`#!/usr/bin/env node`), the leading comment block, all imports (the node builtins; the sibling `.ts` imports `./ansi.ts`, `./files.ts`, `./classify.ts`, `./linter.ts` unchanged; the ten `import * as ruleX from "./rules/*"` namespaces with unchanged specifiers — FR-008; `__unstable__loadDesignSystem` from `tailwindcss`), and ALL runtime logic with no control-flow change. Add types per [data-model.md](./data-model.md) and [contracts/cli-entrypoint.md](./contracts/cli-entrypoint.md): a declared config shape at the `JSON.parse` boundary (`colorTokenFiles: string[]`, `rules: Record<string, { description?: string }>`, `no-component-color-override.componentsDirectory?`), typed `buildIsValidTailwindCandidate` (`loadStylesheet`/`loadModule` string params, returned `(tok: string) => boolean`), `kebabToPascal(s: string): string`, `loadUiComponents(): Set<string>`, the `tokens` bundle shaped to satisfy `createLinter`'s declared `tokens` param with NO cast (research D5), and `accumulate(result, filePath: string)` typed against the linter's `{ violations, ignores }` result. Keep `lint-color/index.js` in place for now (deleted in US2). Do not introduce unjustified `any`.
- [X] T003 [US1] Run `pnpm typecheck` and resolve any errors originating in `lint-color/index.ts` until it reports 0 errors (SC-002). Do not weaken types to silence errors; fix the shapes. The two expected `any`/permissive seams: (a) the ten `.js` rule namespaces in the `ruleLabel` reducer — read `r.id`/`r.name` via a local view type `{ id: number; name: string }` or one inline-justified annotation (research D3); (b) the Tailwind `ds` handle from `__unstable__loadDesignSystem` — type the callbacks we own, accept the package's type for `ds` (research D4). Any unavoidable `any` carries a one-line `why` comment (SC-006). If (and only if) tsc errors on a genuinely missing config option, prefer fixing the code shape over editing `tsconfig.json` (which already has `allowJs`/`checkJs:false`/`allowImportingTsExtensions`).

**Checkpoint**: `index.ts` typechecks clean and standalone (old `index.js` still present; `lint:demo` still points at `.js`).

---

## Phase 4: User Story 2 — The linter still runs and reports exactly as before (Priority: P1)

**Goal**: The `package.json` `lint:demo` script points at `index.ts`, the old `index.js` is
gone, and the linter runs end-to-end (via `pnpm lint:demo` and direct `node lint-color/index.ts`)
with identical output and exit codes.

**Independent Test**: `grep -rn 'index\.js' package.json` → no matches; `pnpm lint:demo` → 23
violations, 1 suppressed, identical to baseline; `node lint-color/index.ts fixtures/demo-app`
exits 1.

- [X] T004 [US2] Update the `package.json` `lint:demo` script: `node lint-color/index.js fixtures/demo-app` → `node lint-color/index.ts fixtures/demo-app` (FR-003). This is the ONLY external edit — no in-repo module imports the entrypoint, so there are no import-specifier changes anywhere else.
- [X] T005 [US2] Delete `lint-color/index.js` (replaced by `index.ts`, SC-001). Then run `grep -rn 'lint-color/index\.js' package.json` and `grep -rln 'from ["'\'']\.\/index' lint-color` and confirm no reference to the deleted module remains (FR-003). (Prose mentions of `index.js` in `specs/00*/` are historical and out of scope.)
- [X] T006 [US2] Run `pnpm lint:demo | tail -3` and confirm **23 violations, 1 suppressed** — byte-for-byte identical to the T001 baseline (SC-003) — then `node lint-color/index.ts fixtures/demo-app > /dev/null 2>&1; echo $?` and confirm exit **1** (FR-002). Then run `pnpm test` and confirm every suite is green with the same counts as the T001 baseline (SC-004). Any delta is a regression to fix before proceeding.

**Checkpoint**: Runtime loads the TypeScript entrypoint and produces identical output + exit codes; no `index.js` remains.

---

## Phase 5: User Story 3 — Orchestration and report formatting preserved (Priority: P2)

**Goal**: The target-root resolution, the design-system loader with its resolver fallbacks, the
semantic-token derivation, `kebabToPascal`, the two-pass file walk, the `Map.groupBy` grouping,
the rule-label lookup, and the suppression summary (`>10` hint) are confirmed identical.

**Independent Test**: `pnpm lint:demo` reports the identical violation set + suppression line;
`node lint-color/index.ts` (no arg) resolves the same default root behavior as before.

- [X] T007 [US3] Review `git diff --no-index lint-color/index.js lint-color/index.ts` (pre-delete, or against the committed JS) and confirm the change is annotations-plus-erasure only: the `process.argv[2] ? resolve(...) : join(__dirname, "../..")` root resolution, the `buildIsValidTailwindCandidate` body (`__unstable__loadDesignSystem` call, the `loadStylesheet`/`loadModule` local-then-package `try/catch` fallbacks, the returned `candidatesToCss([tok]).some(...)` predicate, the `.catch(() => null)` guard), the `derivedSemanticTokens` `--color-*` matchAll, `kebabToPascal`, `loadUiComponents`, the CSS pass then the TS/TSX pass over `getAllFiles(...).filter(!isStorybookFile)`, `accumulate`, the `Map.groupBy` + ascending-id sort + `ruleLabel` lookup, and the `ignoresSummary`/`ignoreHint` (`> 10`) formatting are identical in logic (FR-005, FR-006, FR-007). No behavior line changed.
- [X] T008 [US3] Confirm observable orchestration parity: `pnpm lint:demo | tail -3` matches the baseline (rule grouping, labels, counts, suppression line), and the full `pnpm test` suite — which exercises the siblings this entrypoint drives — is green. A failure signals an orchestration regression to fix.

**Checkpoint**: All three user stories independently verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T009 Confirm no new build/bundle/loader step was introduced (SC-005): `tsconfig.json` unchanged (`allowJs`/`checkJs`/`allowImportingTsExtensions` already present — no edit needed); the only `package.json` change is the `lint:demo` script path. Node runs `.ts` natively.
- [X] T010 Confirm SC-006: `grep -n ':\s*any\|as any' lint-color/index.ts` — expect no matches, or each inline-justified; zero unjustified `any`.
- [X] T011 Confirm SC-001: `ls lint-color/index.*` shows `index.ts` and no `index.js`; and `ls lint-color/*.js` shows no non-`rules/` JS remains in the orchestration layer (terminal migration).
- [X] T012 Final gate: re-run `pnpm typecheck && pnpm test && pnpm lint:demo` together; all green, 23 violations / 1 suppressed. Feature complete.

---

## Dependencies & Execution Order

- **Setup (T001)** → first; captures the comparison baseline.
- **US1 (T002–T003)** → depends on T001. Same-file (`index.ts`), so sequential (no [P]).
- **US2 (T004–T006)** → depends on US1 (the `.ts` entrypoint must exist and typecheck before the script points at it and the `.js` is deleted). Sequential: edit script → delete `.js` → verify demo + exit + suite.
- **US3 (T007–T008)** → depends on US2 (runtime entrypoint must load). Diff review + demo/suite parity.
- **Polish (T009–T012)** → last.

## Parallel Opportunities

- None material. The change is a single dependency chain (`index.ts` → `lint:demo` path →
  delete `.js` → verify), touching one source file plus one `package.json` line. Contrast the
  classify migration (eight independent import sites) — here there is exactly one external edit.

## Implementation Strategy

- **MVP = User Story 1**: a typed `index.ts` that `pnpm typecheck` covers with zero errors is the
  core value (types are the primary contract; the entrypoint's `tokens` bundle now satisfies
  `createLinter` natively). US2 wires it into the runtime via the `lint:demo` path and deletes the
  JS; US3 confirms orchestration/report parity.
- **Incremental delivery**: US1 (entrypoint typed, standalone) → US2 (invoked path switched + old
  deleted, demo + exit + suite identical) → US3 (orchestration/formatting parity confirmed). Each
  checkpoint is independently verifiable.

## Implementation Notes (actual outcome)

- **All 12 tasks complete.** Final gate green: `pnpm typecheck` 0 errors · `pnpm test`
  **393 passed (20 files)** · `pnpm lint:demo` **23 violations, 1 suppressed** (exit 1) —
  identical to the T001 baseline. Terminal migration: no non-`rules/` `.js` remains in
  `lint-color/`.
- **Files**: `lint-color/index.ts` created (replaces `index.js`, deleted). `package.json`
  `lint:demo` script switched `node lint-color/index.js` → `node lint-color/index.ts`.
- **Second invocation site found & fixed (not in the plan)**: `tests/e2e.test.ts` spawns the
  CLI by path (`spawnSync("node", [".../lint-color/index.js"], …)`). It is not an *import*, so
  the plan's "only external edit is lint:demo" was incomplete — it is a run-contract reference
  per FR-003 and was updated to `index.ts`. Bonus: the e2e suite is an additional parity oracle
  (asserts exit 1 + real output) and stays green. Three stale doc comments naming `index.js`
  (`linter.ts`, `ast.ts`, `rules/no-undefined-token.js`) were corrected to `index.ts` for
  accuracy (doc-only, like the 008 precedent).
- **Types**: config given a declared `Config` shape at the `JSON.parse` boundary; the `tokens`
  bundle satisfies `createLinter`'s `Tokens` param with **no cast** (research D5); `accumulate`
  typed against a local `LintResult` mirroring `linter.ts`; the ten rule namespaces read through
  a local `RuleModule = { id: number; name: string }` view (research D3). One honest local
  extraction: the inline rule-module array became a typed `ruleModules` const before the same
  `.map` — behavior-identical.
- **Tailwind seam (research D4)**: `tailwindcss` ships types (`dist/lib.d.mts`), so
  `__unstable__loadDesignSystem` and `ds` are genuinely typed — `index.ts` is the first
  typechecked file to import the package. Tailwind's `CompileOptions` requires a `path` field
  (and `module: Plugin | Config`) on the resolver returns that the JS loaders never supplied and
  that were dead for the single `candidatesToCss` call. To preserve the exact runtime returns
  (adding `path` could alter candidate resolution and break the parity oracle), the two callbacks
  are cast to the package's expected type at this `__unstable__` seam: `loadStylesheet` with a
  single `as`, `loadModule` with `as unknown as` (its `module: any` return isn't comparable
  otherwise). Both are inline-justified by the comment above `LoadOpts`. **Zero `any`** in the
  file (`grep ':\s*any\|as any'` → none); no tsconfig change.
