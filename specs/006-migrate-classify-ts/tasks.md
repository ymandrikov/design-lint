# Tasks: Refactor and migrate the color-classification layer (`classify.js`) → TypeScript

**Feature**: `specs/006-migrate-classify-ts` | **Branch**: `ym/explore`
**Input**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/classify-module.md](./contracts/classify-module.md), [quickstart.md](./quickstart.md)

**Tests**: No new test tasks. This is a behavior-preserving language migration; the existing
suites (`classify.test.ts`, `linter.test.ts`, `linter.lintCss.test.ts`, and the rule tests
`no-spectral-color`, `no-var-color`, `no-raw-css-color`, `no-opacity-modifier`,
`token-constraints`) and `pnpm lint:demo` are the behavior contract and MUST pass unchanged
(spec: SC-003/SC-004).

**Baseline to preserve**: `pnpm typecheck` = 0 errors; `pnpm lint:demo` = **23 violations,
1 suppressed**; `pnpm test` = all green (`classify.test.ts` = 115 cases).

---

## Phase 1: Setup

- [X] T001 Capture the green baseline before any edit: run `pnpm typecheck` (expect 0 errors), `node lint-color/index.js fixtures/demo-app | tail -3` (expect `23 violations found.` + `(1 line suppressed with color-lint-ignore)`), and `pnpm test` (all green). Record the demo counts for the SC-004 comparison.

## Phase 2: Foundational

_No foundational tasks. The migration is confined to one module; its creation is the first user-story task and blocks nothing else beforehand._

---

## Phase 3: User Story 1 — Classification layer type-checked at its own contract (Priority: P1) 🎯 MVP

**Goal**: `lint-color/classify.ts` exists with every export, internal helper, and result shape
typed; `pnpm typecheck` covers its body with zero errors and zero unjustified `any`.

**Independent Test**: `test -f lint-color/classify.ts`; `pnpm typecheck` → 0 errors; no implicit
`any` on params/returns; any explicit `any` carries an inline justification.

- [X] T002 [US1] Create `lint-color/classify.ts` as a full typed rewrite of `lint-color/classify.js`, preserving every line comment, regex, `.` string check, and the exact runtime logic (no control-flow change). Keep the four `import { … } from "./vendor/*.js"` runtime imports unchanged. Keep `lint-color/classify.js` in place for now (deleted in US2).
- [X] T003 [US1] In `lint-color/classify.ts`, define the module's own named types per [data-model.md](./data-model.md): `ColorVerdict = "semantic" | "spectral" | "static" | "raw" | "var" | null`, `Tokens = { semanticSet?: Set<string>; spectralSet?: Set<string> }`, `SplitToken = { variants: string[]; base: string; modifier: string | null }`, `SpectralMatch = { name: string; shade: string }`, `ArbitraryProperty = { property: string; value: string }`, and `ColorParts` (the `SplitToken` fields plus `colorPrefix`, `colorPart`, `arbitraryProperty`, `arbitraryValue`, each `string | null`). Type the four exported constants (`TAILWIND_SPECTRAL_COLORS`/`TAILWIND_STATIC_COLORS`/`CSS_COLOR_PROPERTIES: Set<string>`, `TAILWIND_COLOR_PREFIXES: string[]`).
- [X] T004 [US1] Type every function signature in `lint-color/classify.ts` per [contracts/classify-module.md](./contracts/classify-module.md): exported `splitColorToken`, `findSpectralMatch`, `classifyColorPart`, `parseArbitraryProperty`, `classifyParts`, `findColorPrefix`, `composeColorParts`; and internal helpers `isColorProperty`, `isTwV3Important`, `isTwV4Important`, `isArbitraryOrVarShorthand`, `isNonColorTypehint`, `hasSecondModifier`, `isMalformedArbitraryProperty`, `classifyArbitraryColor`, `classifyVarShorthand`, `extractTypehint`, `classifyVarReference`, `classifyColorValue`, `isDiscardedCandidate`, `isValidModifier`, `isValidArbitraryGroup`, `isArbitraryDiscarded`. Do not introduce `any`; every value here is a concrete `string`/`Set<string>`/named type (research.md D4).
- [X] T005 [US1] Run `pnpm typecheck` and resolve any errors originating in `lint-color/classify.ts` until it reports 0 errors (SC-002). Do not weaken types to silence errors; fix the shapes.

**Checkpoint**: `classify.ts` typechecks clean and standalone (old `classify.js` still present; importers unchanged).

---

## Phase 4: User Story 2 — Linter still loads and classifies every candidate (Priority: P1)

**Goal**: Every importer resolves to `classify.ts`, the old `classify.js` is gone, and the
linter runs end-to-end with the identical demo violation set.

**Independent Test**: `grep -rn 'classify\.js' lint-color` → no matches; `pnpm lint:demo` → 23
violations, 1 suppressed, identical to baseline.

- [X] T006 [P] [US2] Update import specifier `./classify.js` → `./classify.ts` in `lint-color/index.js`.
- [X] T007 [P] [US2] Update import specifier `./classify.js` → `./classify.ts` in `lint-color/linter.js`.
- [X] T008 [P] [US2] Update import specifier `./classify.js` → `./classify.ts` in `lint-color/helpers.ts`.
- [X] T009 [P] [US2] Update import specifier `../classify.js` → `../classify.ts` in `lint-color/rules/no-var-color.js`.
- [X] T010 [P] [US2] Update import specifier `../classify.js` → `../classify.ts` in `lint-color/rules/no-component-color-override.js`.
- [X] T011 [P] [US2] Update import specifier `../classify.js` → `../classify.ts` in `lint-color/rules/no-opacity-modifier.js`.
- [X] T012 [P] [US2] Update import specifier `../classify.js` → `../classify.ts` in `lint-color/rules/no-raw-css-color.js`.
- [X] T013 [P] [US2] Update import specifier `../classify.js` → `../classify.ts` in `lint-color/rules/no-spectral-color.ts`.
- [X] T014 [US2] Delete `lint-color/classify.js` (replaced by `classify.ts`, SC-001). Then run `grep -rn 'classify\.js' lint-color` and confirm only test files (updated in US3) may remain; no runtime `.js` reference remains (FR-003).
- [X] T015 [US2] Run `node lint-color/index.js fixtures/demo-app | tail -3` and confirm **23 violations, 1 suppressed** — byte-for-byte identical to the T001 baseline (SC-004). Any delta is a regression to fix before proceeding.

**Checkpoint**: Linter loads the TypeScript module and produces identical output; no runtime `.js` classify module remains.

---

## Phase 5: User Story 3 — Tailwind candidate parsing and verdicts preserved (Priority: P2)

**Goal**: The token-split, verdict-order, arbitrary/var, and candidate-discard behaviors are
confirmed unchanged by the existing test suites, and test specifiers no longer reference the
deleted `.js`.

**Independent Test**: `pnpm test` all green with zero assertion/logic edits.

- [X] T016 [P] [US3] Update the classify import specifier `./classify.js` → `./classify.ts` in `lint-color/classify.test.ts` (and `linter.test.ts`, `linter.lintCss.test.ts`). Change only the specifier string — no assertion, no logic.
- [X] T017 [P] [US3] Update the classify import specifier `../classify.js` → `../classify.ts` in `lint-color/rules/no-var-color.test.ts`, `no-spectral-color.test.ts`, `no-raw-css-color.test.ts`, `no-opacity-modifier.test.ts`, and `token-constraints.test.ts`. Change only the specifier string — no assertion, no logic.
- [X] T018 [US3] Run `pnpm test` and confirm every suite is green (`classify.test.ts` = 115 cases). Confirm `git diff -- '*.test.ts'` shows only import-specifier lines changed — zero assertion edits (SC-003).
- [X] T019 [US3] Verify the User Story 3 spot-checks in [quickstart.md](./quickstart.md) / spec are covered green by existing tests: `EDGE_TOKENS` split parity, `(--red-500-rgb)` not misread as spectral, recursive `var()` fallback → `"raw"` vs clean `var(--x)` → `"var"`, and malformed-candidate discard (`bg-[#fff`, `bg-[#fff]x`, `bg-red/50/50`). Rely on existing tests; if any behavior is not already asserted, note it (do not add scope).

**Checkpoint**: All three user stories independently verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 Confirm no new build/bundle/loader step was introduced (SC-005): `package.json` unchanged; `tsconfig.json` unchanged (`allowImportingTsExtensions` already present from the ast migration — no edit needed this time). Node runs `.ts` natively.
- [X] T021 Confirm SC-006: `grep -n 'any' lint-color/classify.ts` — expect no matches (or each inline-justified); zero unjustified `any`.
- [X] T022 Confirm SC-001: `ls lint-color/classify.*` shows `classify.ts` and `classify.test.ts` only — no `classify.js`.
- [X] T023 Final gate: re-run `pnpm typecheck && pnpm test && pnpm lint:demo` together; all green, 23 violations / 1 suppressed. Feature complete.

---

## Dependencies & Execution Order

- **Setup (T001)** → first; captures the comparison baseline.
- **US1 (T002–T005)** → depends on T001. All same-file (`classify.ts`), so sequential (no [P]).
- **US2 (T006–T015)** → depends on US1 (the `.ts` module must exist and typecheck before imports point to it and the `.js` is deleted). T006–T013 are **parallel** (eight distinct files). T014 (delete + grep) and T015 (demo) after them.
- **US3 (T016–T019)** → depends on US2 (runtime module must load). T016–T017 parallel (distinct test files); T018–T019 verify. Independently testable via `pnpm test`.
- **Polish (T020–T023)** → last.

## Parallel Opportunities

- **US2 import edits**: T006–T013 — eight import-specifier edits in eight different files, no
  shared state; run together (all `classify.js`→`classify.ts`).
- **US3 test-specifier edits**: T016–T017 — eight test files, no shared state; run together.

## Implementation Strategy

- **MVP = User Story 1**: a typed `classify.ts` that `pnpm typecheck` covers with zero errors is
  the core value (types are the primary contract). US2 wires it in; US3 confirms behavior.
- **Incremental delivery**: US1 (module typed, standalone) → US2 (loaded + old deleted, demo
  identical) → US3 (full suite green, specifiers cleaned). Each checkpoint is independently
  verifiable.

## Implementation Notes (actual outcome)

- **All 23 tasks complete.** Final gate green: `pnpm typecheck` 0 errors · `pnpm test` 393
  passed (20 files) · `pnpm lint:demo` 23 violations, 1 suppressed — identical to baseline.
- **Files**: `lint-color/classify.ts` created (replaces `classify.js`, deleted); 8 runtime
  import specifiers switched to `./classify.ts` / `../classify.ts`; 7 test files switched their
  specifier (specifier-only, 1 line each — `git diff -- '*.test.ts'` = 7 insertions/7 deletions,
  zero assertion edits).
- **No tsconfig change** (as planned): `allowImportingTsExtensions` was already present from the
  ast migration (005), so `helpers.ts` importing `./classify.ts` type-checks with no edit.
- **T017 scope note**: `no-opacity-modifier.test.ts` imports the *rule*, not `classify` directly,
  so it needed no specifier edit — only 7 of the listed test files reference `classify`.
- **Types**: `ColorVerdict` union plus named `Tokens`/`SplitToken`/`SpectralMatch`/
  `ArbitraryProperty`/`ColorParts`; **zero `any`** (the one `any` grep hit is the word in a prose
  comment, not a type). Vendored `./vendor/*` helpers unchanged. No control-flow, regex, or
  `.type`-string change — erasure-plus-annotations only (SC-006).
