---
description: "Task list for refactor of lint-color/shared.js"
---

# Tasks: Refactor lint-color/shared.js Junk-Drawer Module

**Input**: Design documents from `/specs/003-refactor-shared-utils/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/module-map.md, quickstart.md

**Tests**: No new tests requested — this is a behavior-freeze refactor. The **existing**
`vitest` suite + `lint:demo` are the safety oracle (Constitution II). Tasks edit test files'
*import paths only*; no assertion is added or changed.

**Organization**: Grouped by user story. Note this is a single coherent refactor of one module —
stories share a few files (notably `index.js`), so cross-story file order matters and is called
out in Dependencies.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different file, no dependency on an incomplete task → parallelizable
- **[Story]**: US1 / US2 / US3 (Polish/Setup have no story label)

## Path Conventions

Single-project CLI linter. Source under `lint-color/`, e2e under `tests/`. Paths are absolute
from repo root `/Users/ym/work/repos/design-lint/`, shown repo-relative below.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Capture the behavior-freeze baseline — the oracle every later check diffs against.

- [X] T001 Capture baseline: run `pnpm typecheck` and `pnpm test` (record pass count), then `node lint-color/index.js fixtures/demo-app > /tmp/demo-before.txt 2>&1` and record its exit code (per quickstart.md Step 1). Working tree must be clean at the pre-refactor commit.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None required. No shared schema/infra to build — the new modules are created within
US1. This phase is intentionally empty; proceed to Phase 3 after baseline capture.

**Checkpoint**: Baseline recorded → refactor can begin.

---

## Phase 3: User Story 1 - Navigate to a utility by its concern (Priority: P1) 🎯 MVP

**Goal**: Each of the five concerns in `shared.js` lives in a single-concern home; `shared.js`
is left holding only the legacy re-export shims (removed in US3).

**Independent Test**: Search for any one concern (terminal styling, file discovery, dispatch,
test harness) and confirm it resolves to a single-concern module with no unrelated exports.

### Implementation for User Story 1

- [X] T002 [P] [US1] Create `lint-color/ansi.js` — move `isTTY`, `red`, `blue`, `dim`, `bold` verbatim from `lint-color/shared.js` (single-concern: terminal styling only; no fs, no dispatch).
- [X] T003 [P] [US1] Create `lint-color/files.js` — move `getAllFiles`, `isStorybookFile` verbatim from `lint-color/shared.js`, keeping their `node:fs` / `node:path` imports (single-concern: file discovery only).
- [X] T004 [P] [US1] Move `runTokenRuleOnSource` from `lint-color/shared.js` into `lint-color/helpers.ts`, carrying its imports (`composeColorParts` from `./classify.js`; `parseSource, walk, jsxName, classNameStatics, ignoredLines, offsetToLine` from `./ast.js`).
- [X] T005 [US1] Inline the four dispatch gates (`buildDisabledRules`, `lintSourceIfEnabled`, `checkTokenIfEnabled`, `checkValueIfEnabled`) into `lint-color/linter.js` as module-local functions and remove the `./shared.js` import block (per research.md Decision 3). Keep a gate exported from `linter.js` only if a grep shows a test imports it directly.
- [X] T006 [P] [US1] Update the stale comment in `lint-color/rules/no-spectral-color.ts` (line ~31, "Built by checkTokenIfEnabled in shared.js.") to drop the `shared.js` reference now that the gate lives in `linter.js`.
- [X] T007 [US1] Repoint `lint-color/index.js` imports moved by US1: `bold, dim, red` (and `isTTY` if imported) → `./ansi.js`; `getAllFiles, isStorybookFile` → `./files.js`. Leave `TAILWIND_*` alone for now (US3 handles it). Do not change `index.js`'s own exports.
- [X] T008 [P] [US1] Repoint `runTokenRuleOnSource` import from `../shared.js` → `../helpers.js` in the 7 rule tests: `no-opacity-modifier.test.ts`, `no-raw-css-color.test.ts`, `no-undefined-token.test.ts`, `no-var-color.test.ts`, `no-dark-variant.test.ts`, `no-spectral-color.test.ts`, `token-constraints.test.ts` (all under `lint-color/rules/`).
- [X] T009 [P] [US1] Repoint `bold` import from `../shared.js` → `../ansi.js` in `lint-color/rules/no-style-color.test.ts` (confirm origin path by grep first). **No-op: grep showed the file never imports `bold` from `shared.js` — `bold` appears only as the string literal `fontWeight: "bold"`.**

**Checkpoint**: Run `pnpm typecheck` + `pnpm test` — green. `shared.js` now contains only the four re-export lines. Junk-drawer concerns relocated → MVP value delivered.

---

## Phase 4: User Story 3 - No pass-through indirection remains (Priority: P2)

**Goal**: Delete the legacy re-export shims; every previously re-exported symbol is imported from
its owning module. `shared.js` is emptied and deleted.

**Independent Test**: Grep for imports of `TAILWIND_*` / `offsetToLine` / `buildLineStarts` and
confirm each resolves to `classify.js` / `ast.js`; confirm `shared.js` no longer exists.

> Sequenced after US1 because `index.js` is edited by both stories (its `TAILWIND_*` import is
> the last `shared.js` reference in that file).

### Implementation for User Story 3

- [X] T010 [US3] Repoint every importer of `TAILWIND_SPECTRAL_COLORS` / `TAILWIND_COLOR_PREFIXES` from `shared.js` → `classify.js`: `lint-color/index.js`, `lint-color/linter.test.ts`, `lint-color/linter.lintCss.test.ts`, and any `lint-color/rules/*.test.ts` that import them (grep `shared.js` to enumerate exact origins first).
- [X] T011 [P] [US3] Repoint any importer of `offsetToLine` / `buildLineStarts` from `shared.js` → `ast.js` (grep to confirm which files, if any, use the `shared.js` path rather than `ast.js` directly). **No-op: grep found no importer reaching `offsetToLine`/`buildLineStarts` through `shared.js`; `linter.js` already imports `offsetToLine` directly from `ast.js`.**
- [X] T012 [US3] Delete `lint-color/shared.js` (now exporting nothing). Confirm with `rg -n "shared\.js" lint-color tests` returning zero matches (INV-1 / C-2).

**Checkpoint**: `shared.js` gone, zero references, zero shim comments.

---

## Phase 5: User Story 2 - Linter behavior is unchanged (Priority: P1)

**Goal**: Prove the refactor changed no observable behavior. This is the non-negotiable safety
gate; labeled P1 for importance though it verifies after the code moves land.

**Independent Test**: Diff demo output against the T001 baseline (0 differences, same exit code)
and confirm the full suite + typecheck are green with no assertion edits.

### Verification for User Story 2

- [X] T013 [US2] Run `pnpm typecheck` → zero errors (SC-003, FR-007).
- [X] T014 [US2] Run `pnpm test` → same pass count as T001 baseline; confirm via diff/review that no test's assertion body changed, only import lines (FR-008, INV-3).
- [X] T015 [US2] Run `node lint-color/index.js fixtures/demo-app > /tmp/demo-after.txt 2>&1`, then `diff /tmp/demo-before.txt /tmp/demo-after.txt` → empty, identical exit code (SC-002, FR-002).

**Checkpoint**: Behavior freeze proven.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final guardrail checks and single-concern confirmation.

- [X] T016 [P] Run quickstart.md Step 4–5 guards: `rg -n "re-exported here|so existing importers keep working" lint-color` → none (SC-004); `rg -n "readdirSync|extname" lint-color/ansi.js` → none; `rg -n "\\x1b\\[" lint-color/files.js` → none (SC-005 single-concern spot-checks).
- [X] T017 Final full validation: re-run `pnpm typecheck && pnpm test && pnpm lint:demo` all green, then commit the refactor as one logical change.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: no deps — must run first to record the oracle.
- **Foundational (Phase 2)**: empty.
- **US1 (Phase 3)**: after T001. Delivers MVP (junk drawer removed).
- **US3 (Phase 4)**: after US1 — shares `index.js` with US1 (T010 removes the last `shared.js` ref there); `shared.js` can only be deleted once US1 has emptied its own-exports.
- **US2 (Phase 5)**: verification — full pass runs after US3; a partial `pnpm test` also runs at the US1 checkpoint.
- **Polish (Phase 6)**: after US2 passes.

### Within/Across Stories

- T002, T003, T004, T006, T008, T009 are `[P]` — distinct files, no mutual deps.
- T005 and T007 both edit single files (`linter.js`, `index.js`) — not `[P]` with tasks touching the same file.
- T007 (US1 `index.js`) must land before T010 (US3 `index.js`) — same file, sequential.
- T008/T009 depend on T004/T002 respectively (import target must exist first).
- T012 (delete `shared.js`) is last code task — depends on T005, T007, T010, T011 clearing all references.

### Parallel Opportunities

- Module creation + independent repoints: T002, T003, T004 together; then T006, T008, T009 together.
- T011 parallel with T010 only if they touch disjoint files (grep to confirm).

---

## Parallel Example: User Story 1

```bash
# Create the new homes + move the test harness in parallel (distinct files):
Task: "T002 Create lint-color/ansi.js (terminal styling)"
Task: "T003 Create lint-color/files.js (file discovery)"
Task: "T004 Move runTokenRuleOnSource into lint-color/helpers.ts"

# Then repoint importers in parallel (distinct files, targets now exist):
Task: "T006 Fix stale comment in rules/no-spectral-color.ts"
Task: "T008 Repoint runTokenRuleOnSource in 7 rule tests → ../helpers.js"
Task: "T009 Repoint bold in rules/no-style-color.test.ts → ../ansi.js"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. T001 baseline.
2. Phase 3 (US1): create `ansi.js` / `files.js`, inline gates, move harness, repoint US1 importers.
3. **STOP & VALIDATE**: `pnpm typecheck && pnpm test` green → junk drawer gone. Demoable MVP.

### Incremental Delivery

1. US1 → junk drawer removed (MVP).
2. US3 → shims deleted, `shared.js` gone.
3. US2 → behavior freeze proven (diff vs baseline).
4. Polish → guard greps + final commit.

---

## Notes

- `[P]` = different files, no incomplete-task dependency.
- This refactor is one coherent change; "independent testability" here means each story's grep/
  run check can be evaluated on its own, not that stories deploy separately.
- Behavior-freeze is sacred: if any diff appears at T015, treat it as a regression and revert the
  offending move — do not adjust a test to match new output.
- Commit once at T017 as a single reviewable refactor (Development Workflow: commit when asked).
