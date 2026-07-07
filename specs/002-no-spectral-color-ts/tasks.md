---
description: "Task list — migrate no-spectral-color rule JS → TS"
---

# Tasks: Migrate `no-spectral-color` rule from JavaScript to TypeScript

**Input**: Design documents from `/specs/002-no-spectral-color-ts/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/check-token.md, quickstart.md

**Tests**: No new test tasks. This is a behavior-preserving language migration; the existing
`lint-color/rules/no-spectral-color.test.ts` is the behavior contract and MUST pass unchanged
(spec Assumptions; Constitution II — no new behavior, so no new test is owed).

**Organization**: Tasks are grouped by the spec's user stories for traceability. NOTE: unlike a
typical feature, these stories are **not independently shippable** — all three are satisfied by
one atomic edit to a single module plus two import-specifier changes. They are sequenced slices
of the same change, not parallel deliverables. See Dependencies.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 (maps to spec.md)
- Paths are repo-relative.

---

## Phase 1: Setup

**Purpose**: Preconditions and a baseline to diff behavior against.

- [X] T001 Confirm runtime supports native `.ts`: `node --version` reports v26.1.0 (research R1). Abort if `< 23.6`.
- [X] T002 [P] Capture baseline demo output for the parity diff: `pnpm lint:demo > /tmp/spectral-before.txt 2>&1 || true` (quickstart step 0).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure before story work.

None. There is no shared infrastructure to build — the entire change is one rule module plus
its two import sites. Core work begins directly in Phase 3 (US1).

**Checkpoint**: Baseline captured — migration can begin.

---

## Phase 3: User Story 1 - The rule is type-checked at its own contract (Priority: P1) 🎯 MVP

**Goal**: The rule is authored in TypeScript with a compiler-enforced contract and no `any`; `pnpm typecheck` covers its body.

**Independent Test**: Rule lives at a `.ts` path, `pnpm typecheck` is green, and the exported `id`/`name`/`checkToken` are unchanged.

### Implementation for User Story 1

- [X] T003 [US1] Create `lint-color/rules/no-spectral-color.ts` — verbatim logic port of the current `.js` (classifier-delegated `spectral` check via `classifyParts`; name+shade from `findSpectralMatch(parts.colorPart, tokens.spectralSet)`; `findReplacement` range/single-shade parsing; hint composition; message string), with types per data-model.md: `type Parts = NonNullable<ReturnType<typeof composeColorParts>>` (import `composeColorParts` type from `../classify.js`), local `Ctx`/`ClassifierTokens`/`Ansi`/`RuleConfig`/`ReplacementMap` interfaces, `checkToken(...): string | null`. Keep exports `id = 4`, `name = "no-spectral-color"`. No `any` (or inline-justified). Preserve the file's header comments.
- [X] T004 [US1] Delete the old `lint-color/rules/no-spectral-color.js`.
- [X] T005 [US1] Run `pnpm typecheck` → zero errors. If tsc errors on a `.ts`-extension import, add `"allowImportingTsExtensions": true` to `tsconfig.json` `compilerOptions` and re-run (research R3); otherwise leave `tsconfig.json` untouched (YAGNI).

**Checkpoint**: Rule is TypeScript and type-clean. Runtime wiring happens in US2.

---

## Phase 4: User Story 2 - The linter still loads and runs the rule (Priority: P1)

**Goal**: The linter imports and runs the migrated `.ts` module unchanged in behavior, with no build/loader step added.

**Independent Test**: `pnpm lint:demo` runs to completion (no module-resolution error) and the rule fires.

### Implementation for User Story 2

- [X] T006 [P] [US2] In `lint-color/index.js`, change the import specifier `./rules/no-spectral-color.js` → `./rules/no-spectral-color.ts` (line ~26).
- [X] T007 [P] [US2] In `lint-color/linter.js`, change the import specifier `./rules/no-spectral-color.js` → `./rules/no-spectral-color.ts` (line ~26).
- [X] T008 [US2] Run `pnpm lint:demo`; confirm it completes with no `ERR_MODULE_NOT_FOUND` and spectral violations are still reported. Confirm no new dependency, build script, or loader flag was added to `package.json` (SC-005).

**Checkpoint**: Linter loads and runs the TS rule end-to-end.

---

## Phase 5: User Story 3 - Behavior and message wording are preserved exactly (Priority: P2)

**Goal**: Reported violations, messages, coloring, and counts are byte-for-byte identical to pre-migration.

**Independent Test**: Existing test suite passes unmodified and the demo diff is empty.

### Implementation for User Story 3

- [X] T009 [US3] Run `pnpm test -- no-spectral-color`; confirm every case in `lint-color/rules/no-spectral-color.test.ts` passes with **zero edits** to that file (SC-003).
- [X] T010 [US3] Diff demo output against the baseline: `pnpm lint:demo > /tmp/spectral-after.txt 2>&1 || true; diff /tmp/spectral-before.txt /tmp/spectral-after.txt` → empty diff (SC-004).

**Checkpoint**: Behavior parity proven.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T011 [P] Confirm no unjustified `any`: `grep -n "any" lint-color/rules/no-spectral-color.ts` → none, or each carries an inline rationale (SC-006).
- [X] T012 Run the full quality gate: `pnpm typecheck && pnpm test` → both green, no skipped / `.only` (Constitution II).
- [X] T013 Walk `quickstart.md` end-to-end and confirm every "Expect" holds; confirm `no-spectral-color.js` is gone and `no-spectral-color.ts` exists (SC-001).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; T002 can run any time before T010.
- **Foundational (Phase 2)**: empty.
- **US1 (Phase 3)**: after Setup. T003 → T004 → T005 (sequential; same module).
- **US2 (Phase 4)**: after T003 (the `.ts` module must exist). T006 ∥ T007, then T008.
- **US3 (Phase 5)**: after US2 (linter must load the module). T009 ∥ T010.
- **Polish (Phase 6)**: after US1–US3.

### Story independence — IMPORTANT

These stories are **not** independently deliverable. T003 (the rewrite) is the single point all
stories flow through; US2 makes it load, US3 verifies parity. Do not attempt to ship US2 or US3
without US1. This is inherent to a one-file language migration.

### Parallel Opportunities

- T002 [P] runs alongside T001.
- T006 [P] and T007 [P] edit different files → parallel.
- T011 [P] independent of T012/T013 ordering.
- Everything else is sequential (single module).

---

## Parallel Example: User Story 2

```bash
# The two import-site edits touch different files — do them together:
Task: "Update import specifier in lint-color/index.js (T006)"
Task: "Update import specifier in lint-color/linter.js (T007)"
```

---

## Implementation Strategy

### MVP scope

The MVP is the whole feature — it is too small to slice. Practically: T001–T002 (setup) →
T003–T005 (US1: the TS rewrite, the MVP core) → T006–T008 (US2: wire imports so it runs) →
T009–T010 (US3: prove parity) → T011–T013 (polish/gate).

### Recommended commit boundary

Commit T003–T010 as one logical change (the migration is atomic — a half-applied rename leaves
the linter unable to load the rule). Run the Phase 6 gate before committing.
