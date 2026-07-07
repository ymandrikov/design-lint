---
description: "Task list for migrating lint-color/rules/** from JS to TS"
---

# Tasks: Migrate the color-rule modules (`lint-color/rules/**`) JS → TS

**Input**: Design documents from `/specs/010-migrate-rules-ts/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rule-module.md, quickstart.md

**Tests**: No new test tasks — this is a behavior-preserving migration. Every rule already
has an exact-output `*.test.ts`; those suites (unchanged) are the parity oracle. Adding tests
is explicitly out of scope (constitution II: new tests are owed only for new behavior).

**Organization**: The three user stories are quality dimensions over the same nine files, so
they overlap by nature. Mapping: **US1** (typed contract) = the nine per-rule migration tasks;
**US2** (registry loads every rule) = the import-site edits; **US3** (behavior preserved) = the
parity verification gate. A rule is not "done" until all three hold, verified in Phase 5.

## Path Conventions

Single-project CLI linter. Rules live at `lint-color/rules/<name>.ts`; the registry is
`lint-color/linter.ts` and `lint-color/index.ts`. Reused runtime types (`ColorParts`, `Tokens`,
`ColorVerdict`) come from `lint-color/classify.ts`; `ctx`/`Ansi` are local per rule. The
test-scoped `lint-color/helpers.ts` is not imported by the rules and is unchanged.

---

## Phase 1: Setup (Baseline anchor)

**Purpose**: Record the exact pre-migration output so parity can be proven.

- [X] T001 Captured the green baseline: `pnpm typecheck` → 0 errors; `pnpm test` → 20 files / 393 tests passing; `pnpm lint:demo` → 23 violations, 1 suppressed, exit 1. These are the parity contract for Phase 5.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Confirm the shared contracts the migration types against already exist.

**No code tasks.** The runtime types the rules reuse (`ColorParts`, `Tokens`, `ColorVerdict`)
are already exported from `lint-color/classify.ts`; the linter factory (`lint-color/linter.ts`)
already declares the dispatch `ctx` shapes and matches rule methods bivariantly. No new
abstraction, tsconfig, or dependency is introduced (`helpers.ts` stays untouched). Proceed
directly to US1.

---

## Phase 3: User Story 1 — Every color rule is type-checked at its own contract (Priority: P1) 🎯 MVP

**Goal**: Rewrite each of the nine JS rule modules as TypeScript, typing every entrypoint and
internal helper — `parts`/`tokens` reuse `classify.ts` types (`ColorParts`/`Tokens`), `ctx`/`Ansi`
are narrow local types per rule (mirroring `no-spectral-color.ts`/`linter.ts`).

**Independent Test**: Each module lives at a `.ts` path; `pnpm typecheck` covers its body with
zero errors; no implicit `any`, every explicit `any` carries an inline justification.

All nine are independent files → parallelizable. `no-component-color-override` (T010) updates
its own `findRawColor` import specifier to `./no-raw-css-color.ts` as part of its migration; the
`findRawColor` signature is preserved so order relative to `no-raw-css-color` (T003) is free.

- [X] T002 [P] [US1] Migrate `lint-color/rules/no-style-color.js` → `.ts` (id 1): typed `lintSource(source, filePath, ctx): void` with local `Ansi`/`ReportFn`/`Ctx`, JSX-walk locals via oxc `Node` narrowing; deleted the `.js`. `id`/`name` and all reported lines/messages preserved.
- [X] T003 [P] [US1] Migrate `lint-color/rules/no-raw-css-color.js` → `.ts` (id 2): typed `checkToken`/`checkValue → string | null` and `findRawColor(value: string): string | null`; the `postcss-value-parser` node walk is typed by its bundled `.d.ts` and `isColor` infers under `allowJs` — **no `any` needed**; deleted the `.js`.
- [X] T004 [P] [US1] Migrate `lint-color/rules/no-opacity-modifier.js` → `.ts` (id 3): typed `checkToken` (`parts: ColorParts`, `ctx.tokens: Tokens`), `classifyColorPart` call; deleted the `.js`.
- [X] T005 [P] [US1] Migrate `lint-color/rules/token-constraints.js` → `.ts` (id 5): typed `checkToken`, the `matchPattern(value: string, pattern: string): boolean` helper, and a local `PatternMap` for `ruleConfig.allowed`/`.denied`; deleted the `.js`.
- [X] T006 [P] [US1] Migrate `lint-color/rules/no-var-color.js` → `.ts` (id 6): typed `checkToken`, `classifyParts` call; deleted the `.js`.
- [X] T007 [P] [US1] Migrate `lint-color/rules/no-dark-variant.js` → `.ts` (id 9): typed `checkToken`; deleted the `.js`.
- [X] T008 [P] [US1] Migrate `lint-color/rules/no-useless-hover.js` → `.ts` (id 10): typed `lintSource`, the `Set<string>` tables (`INTERACTIVE_TAGS`, `TABLE_ROW_TAGS`, `INTERACTION_PROPS`, `INTERACTIVE_ROLES`) and `attrStringValue(attr: JSXAttribute)` / `elementIsInteractive(opening: JSXOpeningElement, tagName, extraInteractiveTags)` (oxc types); deleted the `.js`.
- [X] T009 [P] [US1] Migrate `lint-color/rules/no-undefined-token.js` → `.ts` (id 12): typed `checkToken` (local `tokens.isValidTailwindCandidate` shape); deleted the `.js`.
- [X] T010 [P] [US1] Migrate `lint-color/rules/no-component-color-override.js` → `.ts` (id 11): typed `lintSource` and `isColorToken(tok, tokens: OverrideTokens)`, `classifyColorPart`/`composeColorParts` calls, and updated the `findRawColor` import specifier `"./no-raw-css-color.js"` → `"./no-raw-css-color.ts"`; deleted the `.js`.

**Checkpoint**: ✅ All nine rules exist as `.ts`; `pnpm typecheck` → 0 errors.

---

## Phase 4: User Story 2 — The linter still loads and runs every rule (Priority: P1)

**Goal**: The rule registry resolves each migrated rule by its `.ts` specifier; no specifier
points at a deleted `.js`.

**Independent Test**: `grep 'rules/.*\.js"'` over `linter.ts` and `index.ts` returns nothing;
`node lint-color/index.ts` loads and runs; `pnpm lint:demo` produces the baseline output.

Different files → parallelizable. Depends on Phase 3 (the `.ts` files must exist).

- [X] T011 [P] [US2] In `lint-color/linter.ts`, flipped the nine migrated rule-import specifiers `"./rules/<name>.js"` → `".ts"` (spectral already `.ts`); binding names unchanged.
- [X] T012 [P] [US2] In `lint-color/index.ts`, flipped the same nine rule-import specifiers `"./rules/<name>.js"` → `".ts"`; binding names unchanged.

**Checkpoint**: ✅ `grep 'rules/.*\.js"'` over both files → no matches.

---

## Phase 5: User Story 3 — Each rule's detection behavior is preserved exactly (Priority: P2)

**Goal**: Prove zero behavior drift across the whole migration via the existing suites and the
demo fixture — the authoritative parity gate.

**Independent Test**: Every existing test passes with zero assertion edits; demo-app output is
byte-for-byte identical to the T001 baseline.

- [X] T013 [US3] `pnpm typecheck` → **0 errors**, now covering all nine migrated rule bodies.
- [X] T014 [US3] `pnpm test` → **20 files / 393 tests passing**, zero edits to any `*.test.ts` (incl. `linter.test.ts`, `linter.lintCss.test.ts`, `no-raw-css-color.checkValue.test.ts`, `tests/e2e.test.ts`).
- [X] T015 [US3] `pnpm lint:demo` → **23 violations, 1 suppressed, exit 1** (zero net delta from the T001 baseline).

**Checkpoint**: ✅ All three gates green against the recorded baseline → migration behavior-verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency and hygiene; no behavior change.

- [X] T016 [P] Structural sweep: ✅ `ls lint-color/rules/*.js` → nothing (no JS source remains); `grep ': any| as any' lint-color/rules/*.ts` (non-test) → **no matches** (zero `any` introduced).
- [X] T017 [P] **Skipped (intentional).** The rule tests import the module-under-test via `await import("./<name>.js")` with a typed cast — and the already-migrated precedent `no-spectral-color.test.ts` keeps exactly that `.js` dynamic-import specifier against its `.ts` module. Flipping the eight sibling tests would diverge from that precedent for no behavior gain and would touch the parity oracle; left untouched (the runner resolves `.js`→`.ts`, suite green).

---

## Dependencies & Execution Order

- **Phase 1 (T001)** → first: records the parity baseline.
- **Phase 2** → no tasks (shared contracts already exist).
- **Phase 3 (US1, T002–T010)** → all nine parallel `[P]`; the only soft link is T010→T003 via `findRawColor`, satisfied because the signature is preserved (order-free).
- **Phase 4 (US2, T011–T012)** → after Phase 3 (the `.ts` files must exist); T011 ∥ T012 (different files).
- **Phase 5 (US3, T013–T015)** → after Phases 3–4 (the whole set must resolve). Sequential (each is a full-repo gate).
- **Phase 6 (T016–T017)** → after Phase 5; both `[P]`.

## Parallel Execution Examples

- **Phase 3**: launch T002–T010 together — nine independent file migrations.
- **Phase 4**: T011 and T012 together — two independent registry files.
- **Phase 6**: T016 and T017 together.

## Implementation Strategy

- **MVP = US1 (Phase 3)**: the nine rules typed and building. This is the substance of the
  migration; US2 makes the registry specifiers explicit and US3 proves no drift.
- **Incremental delivery**: each rule (T002–T010) is an independent increment — a single rule
  can be migrated, typechecked, and its own `pnpm test <rule>` run in isolation before moving on.
- **Definition of done**: T013–T015 green against the T001 baseline, `lint-color/rules/` free of
  `.js`, registry and cross-rule imports resolving by `.ts`.

## Task Summary

- **Total tasks**: 17
- **US1 (migrate rules)**: T002–T010 (9)
- **US2 (registry imports)**: T011–T012 (2)
- **US3 (parity gate)**: T013–T015 (3)
- **Setup**: T001 (1) · **Polish**: T016–T017 (2)
- **Parallel opportunities**: 9-way in Phase 3, 2-way in Phases 4 and 6.
