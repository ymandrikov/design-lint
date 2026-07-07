---
description: "Task list for migrating lint-color/vendor/** from JS to TS"
---

# Tasks: Migrate the vendored Tailwind parsing primitives (`lint-color/vendor/**`) JS → TS

**Input**: Design documents from `/specs/011-migrate-vendor-ts/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/vendor-primitive.md, quickstart.md

**Tests**: No new test tasks — this is a behavior-preserving migration. Each primitive already
has an exact-output `*.test.ts`; those suites (unchanged) are the parity oracle. Adding tests is
explicitly out of scope (constitution II: new tests are owed only for new behavior).

**Organization**: The three user stories are quality dimensions over the same four files, so
they overlap by nature. Mapping: **US1** (typed contract) = the four per-primitive migration
tasks; **US2** (consumers still import) = the import-site edits; **US3** (behavior preserved) =
the parity verification gate. A primitive is not "done" until all three hold, verified in Phase 5.

## Path Conventions

Single-project CLI linter. Primitives live at `lint-color/vendor/<name>.ts`; consumers are
`lint-color/classify.ts` (imports all four) and `lint-color/rules/no-raw-css-color.ts` (imports
`isColor`). `decode-arbitrary-value` reuses `postcss-value-parser`'s bundled `Node` type; the
other three are plain string functions. No sibling module logic, tsconfig, or dependency changes.

---

## Phase 1: Setup (Baseline anchor)

**Purpose**: Record the exact pre-migration output so parity can be proven.

- [X] T001 Captured the green baseline: `pnpm typecheck` → 0 errors; `pnpm test` → 20 files / 393 tests passing; `pnpm lint:demo` → 23 violations, 1 suppressed, exit 1. These are the parity contract for Phase 5.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Confirm the contracts the migration types against already exist.

**No code tasks.** `postcss-value-parser` (already installed, already imported by
`decode-arbitrary-value`) ships a bundled `.d.ts` exporting the `Node` union the node walk types
against — so no new dependency, no local node type, and no tsconfig edit are introduced. The
other three primitives are self-contained string functions. Proceed directly to US1.

---

## Phase 3: User Story 1 — The vendored primitives are type-checked at their own contract (Priority: P1) 🎯 MVP

**Goal**: Rewrite each of the four JS primitives as TypeScript, typing every export and internal
helper; restore the annotations the vendoring step dropped, moving each file back toward its
upstream TypeScript shape.

**Independent Test**: Each module lives at a `.ts` path; `pnpm typecheck` covers its body with
zero errors; no implicit `any`, every explicit `any` (none expected) carries an inline justification.

All four are independent files with no cross-vendor imports → fully parallelizable. Each task
also updates the file's vendoring header so the "converted to plain JS (type annotations
dropped)" note no longer misdescribes a `.ts` file, while preserving the upstream
source/commit/ADR-0002 citation (FR-009, constitution I).

- [X] T002 [P] [US1] Migrate `lint-color/vendor/is-color.js` → `.ts`: type `isColor(value: string): boolean` and `isNamedColor(value: string): boolean`; `NAMED_COLORS: Set<string>`, `IS_COLOR_FN: RegExp`, `HASH` const unchanged; update header wording; delete the `.js`.
- [X] T003 [P] [US1] Migrate `lint-color/vendor/segment.js` → `.ts`: type `segment(input: string, separator: string): string[]`; the module-level `closingBracketStack: Uint8Array` and char-code consts unchanged; update header wording; delete the `.js`.
- [X] T004 [P] [US1] Migrate `lint-color/vendor/is-valid-arbitrary.js` → `.ts`: type `isValidArbitrary(input: string): boolean`; the module-level `closingBracketStack: Uint8Array` and char-code consts unchanged; update header wording; delete the `.js`.
- [X] T005 [P] [US1] Migrate `lint-color/vendor/decode-arbitrary-value.js` → `.ts`: import `{ type Node }` from `postcss-value-parser`; type `decodeArbitraryValue(input: string): string`, `convertUnderscoresToWhitespace(input: string, skipUnderscoreToSpace?: boolean): string`, and `recursivelyDecodeArbitraryValues(nodes: Node[]): void` against the parser's `Node` union — **no `any`**; the `url()`/`var()`/`theme()` exceptions and math-operator-pass omission unchanged; update header wording (preserve the divergence note); delete the `.js`.

**Checkpoint**: All four primitives exist as `.ts`; `pnpm typecheck` → 0 errors.

---

## Phase 4: User Story 2 — The classifier and CSS-color rule still import the primitives (Priority: P1)

**Goal**: Every consumer resolves each migrated primitive by its `.ts` specifier; no specifier
points at a deleted `.js`.

**Independent Test**: `grep 'vendor/.*\.js"'` over `classify.ts` and `no-raw-css-color.ts`
returns nothing; `node lint-color/index.ts` loads and runs; `pnpm lint:demo` produces the baseline output.

Different files → parallelizable. Depends on Phase 3 (the `.ts` files must exist).

- [X] T006 [P] [US2] In `lint-color/classify.ts`, flip the four vendor-import specifiers `"./vendor/segment.js"`, `"./vendor/is-valid-arbitrary.js"`, `"./vendor/decode-arbitrary-value.js"`, `"./vendor/is-color.js"` → `".ts"`; binding names unchanged.
- [X] T007 [P] [US2] In `lint-color/rules/no-raw-css-color.ts`, flip the `isColor` import specifier `"../vendor/is-color.js"` → `".ts"`; binding name unchanged.

**Checkpoint**: `grep 'vendor/.*\.js"'` over both files → no matches.

---

## Phase 5: User Story 3 — Each primitive's parsing behavior is preserved exactly (Priority: P2)

**Goal**: Prove zero behavior drift across the whole migration via the existing suites and the
demo fixture — the authoritative parity gate.

**Independent Test**: Every existing test passes with zero assertion edits; demo-app output is
byte-for-byte identical to the T001 baseline.

- [X] T008 [US3] `pnpm typecheck` → **0 errors**, now covering all four migrated primitive bodies.
- [X] T009 [US3] `pnpm test` → **20 files / 393 tests passing**, zero edits to any `*.test.ts` (incl. the four vendor suites, which exercise the primitives directly, and `classify`'s tests, which exercise them transitively).
- [X] T010 [US3] `pnpm lint:demo` → **23 violations, 1 suppressed, exit 1** (zero net delta from the T001 baseline).

**Checkpoint**: All three gates green against the recorded baseline → migration behavior-verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency and hygiene; no behavior change.

- [X] T011 [P] Structural sweep: `ls lint-color/vendor/*.js` → nothing (no JS source remains); `grep ': any| as any' lint-color/vendor/*.ts` (non-test) → no matches (zero `any` introduced); each migrated file still cites `ADR 0002` and its upstream source/commit, and no file still says "plain JS"; `git diff --stat package.json` → empty (no new dependency).
- [X] T012 [P] Flip the four vendor test specifiers `"./<name>.js"` → `".ts"` in `is-color.test.ts`, `segment.test.ts`, `is-valid-arbitrary.test.ts`, `decode-arbitrary-value.test.ts` for consistency (mechanical import-line only; zero assertion edits). The runner resolves `.js`→`.ts` either way, so this is cosmetic; re-run `pnpm test` to confirm still 393/20.

---

## Dependencies & Execution Order

- **Phase 1 (T001)** → first: records the parity baseline.
- **Phase 2** → no tasks (parser types already available; no new dependency).
- **Phase 3 (US1, T002–T005)** → all four parallel `[P]`; no cross-vendor imports, so order-free.
- **Phase 4 (US2, T006–T007)** → after Phase 3 (the `.ts` files must exist); T006 ∥ T007 (different files).
- **Phase 5 (US3, T008–T010)** → after Phases 3–4 (the whole set must resolve). Sequential (each is a full-repo gate).
- **Phase 6 (T011–T012)** → after Phase 5; both `[P]`.

## Parallel Execution Examples

- **Phase 3**: launch T002–T005 together — four independent file migrations.
- **Phase 4**: T006 and T007 together — two independent consumer files.
- **Phase 6**: T011 and T012 together.

## Implementation Strategy

- **MVP = US1 (Phase 3)**: the four primitives typed and building. This is the substance of the
  migration; US2 makes the consumer specifiers explicit and US3 proves no drift.
- **Incremental delivery**: each primitive (T002–T005) is an independent increment — a single
  primitive can be migrated, typechecked, and its own `pnpm exec vitest run <name>.test.ts` run
  in isolation before moving on.
- **Definition of done**: T008–T010 green against the T001 baseline, `lint-color/vendor/` free of
  `.js`, consumer imports resolving by `.ts`, headers corrected, no new dependency.

## Task Summary

- **Total tasks**: 12
- **US1 (migrate primitives)**: T002–T005 (4)
- **US2 (consumer imports)**: T006–T007 (2)
- **US3 (parity gate)**: T008–T010 (3)
- **Setup**: T001 (1) · **Polish**: T011–T012 (2)
- **Parallel opportunities**: 4-way in Phase 3, 2-way in Phases 4 and 6.
