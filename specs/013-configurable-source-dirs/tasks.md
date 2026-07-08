---
description: "Task list for Configurable Source Directories"
---

# Tasks: Configurable Source Directories

**Input**: Design documents from `specs/013-configurable-source-dirs/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/source-dirs.md, quickstart.md

**Tests**: REQUIRED — Constitution II (Testing Standards, NON-NEGOTIABLE) mandates a failing test for
every new behavior and exact-output e2e over fixtures. Test tasks are written FIRST and must fail
before implementation.

**Organization**: Grouped by user story. US1 (P1) is the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2
- Exact file paths included.

## Path Conventions

Single project. Linter source in `lint-color/`, fixtures in `fixtures/`, cross-cutting tests in `tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Config-seam typing both stories build on.

- [X] T001 Extend the `Config` type in `lint-color/index.ts` with an optional
  `sourceDirectories?: string[]` field (JSON.parse-seam typing only, no behavior yet), so the raw
  value is threaded to the validator as `unknown`.

**Checkpoint**: config field is typed; nothing scans differently yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure validator + existence resolver both stories depend on.

**⚠️ CRITICAL**: Blocks US1 and US2.

### Tests for Foundational (write first, must FAIL) ⚠️

- [X] T002 [P] Unit tests in `lint-color/files.test.ts` for `validateSourceDirs(raw)`: omitted/`null`
  → `["src"]`; `["app"]` and `["app","lib"]` pass through; `[]` throws (empty); `"app"` throws
  (non-array); `["app", 3]` throws (non-string); `["/etc"]` throws (absolute); `["../x"]` and
  `["a/../.."]` throw (escapes root) — each error message names the problem (data-model D6, FR-006/008).
- [X] T003 [P] Unit tests in `lint-color/files.test.ts` for `resolveExistingSourceDirs(dirs, root)`
  using real repo paths: an existing dir (e.g. `lint-color`) lands in `existing`, a missing dir (e.g.
  `nope-xyz`) lands in `missing`; result partitions correctly (FR-007).

### Implementation for Foundational

- [X] T004 Implement `validateSourceDirs(raw: unknown): string[]` in `lint-color/files.ts` following the
  data-model validation order (default → array check → non-empty → string entries → reject absolute →
  reject `..`-escape), throwing a plain `Error` with a user-facing message on each rejection. Turns T002 green.
- [X] T005 Implement `resolveExistingSourceDirs(dirs: string[], root: string): { existing: string[]; missing: string[] }`
  in `lint-color/files.ts` — `join(root, d)` each, `statSync().isDirectory()` partition (catch ENOENT →
  missing). Turns T003 green.

**Checkpoint**: source-dir config can be validated and resolved to existing/missing sets from TS; foundation ready.

---

## Phase 3: User Story 1 - Lint a project whose source lives outside `src/` (Priority: P1) 🎯 MVP

**Goal**: A target can declare its source directory (e.g. Rails `app/`); the default stays `src`;
misconfiguration fails loud with a non-zero exit.

**Independent Test**: Lint `fixtures/rails-app` (sources under `app/`, no `src/`,
`sourceDirectories:["app"]`) — the `app/` violation is reported root-relative; a config naming a
missing dir / empty list / absolute / `..` / wrong type errors and exits non-zero.

### Tests for User Story 1 (write first, must FAIL) ⚠️

- [X] T006 [P] [US1] Scaffold `fixtures/rails-app/`: `design-system/lint/colors.json` (mirror the demo
  rules + `colorTokenFiles`, add `sourceDirectories:["app"]`), `app/` with a color-token CSS entry and a
  `.html.erb` (or `.tsx`) carrying one spectral violation, and **no `src/` directory**.
- [X] T007 [P] [US1] E2E in `tests/e2e.test.ts`: running the CLI over `fixtures/rails-app` reports the
  `app/` violation with a root-relative path and exits 1 (SC-001). Assert `src/` is not required.
- [X] T008 [P] [US1] E2E misconfiguration cases in `tests/e2e.test.ts`: a config naming a nonexistent
  directory prints a message naming it and exits non-zero while an existing sibling dir still lints; an
  empty list, an absolute path, a `..` path, a non-array value, and a non-string entry each print an
  actionable message and exit non-zero — never a clean pass, never a crash (SC-004, FR-006/007/008).

### Implementation for User Story 1

- [X] T009 [US1] Wire `lint-color/index.ts`: replace the hardcoded `SRC` with
  `validateSourceDirs(config.sourceDirectories)` inside a try/catch (on throw → `console.error` +
  `process.exit(1)`); `resolveExistingSourceDirs(validated, ROOT)`; if `existing` is empty →
  `console.error` naming the missing dir(s) + `process.exit(1)`; else print each missing dir and set a
  `hadMissingDir` flag. Iterate the three discovery passes (`.css`, `.tsx/.ts`, `.erb`) over every
  `existing` dir. Fold `hadMissingDir` into the final exit code so a missing dir exits non-zero even
  with zero violations (FR-002/003/004/007, C4).

**Checkpoint**: MVP — a non-`src/` target lints end-to-end and misconfiguration fails loud; independently testable.

---

## Phase 4: User Story 2 - Lint multiple source directories in one run (Priority: P2)

**Goal**: Multiple configured directories are scanned in one run; a file reachable through overlapping
or nested dirs is linted exactly once.

**Independent Test**: Configure two directories including a nested pair, seed a violation in each, run
once — both reported with correct attribution, no duplication.

**Note**: US2 edits the same `index.ts` discovery introduced by US1 — sequential after US1.

### Tests for User Story 2 (write first, must FAIL) ⚠️

- [X] T010 [P] [US2] Scaffold `fixtures/multi-src-app/`: `sourceDirectories` listing two directories
  including a nested pair (e.g. `["app","app/components"]`), a color-token CSS entry, and one violation
  in each directory (the nested one placed so a non-deduped run would double-count it).
- [X] T011 [P] [US2] E2E in `tests/e2e.test.ts`: running the CLI over `fixtures/multi-src-app` reports
  the violation from each directory, each attributed to its file, in one run, with an exact total that
  proves the nested/overlapping file is counted once (SC-003, FR-009).

### Implementation for User Story 2

- [X] T012 [US2] In `lint-color/index.ts`, deduplicate discovered files by resolved absolute path across
  each discovery pass (a `Set` seeded per pass) before dispatch, so a file reachable through overlapping
  or nested configured dirs is linted exactly once (FR-009, C3). Turns T011's exact total green.

**Checkpoint**: US1 + US2 both work; multi-root scanning is consolidated and duplicate-free.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T013 [P] Add an ADR under `docs/adr/0002-configurable-source-dirs.md` recording the
  `sourceDirectories` config key, the replace-not-augment default, and the fail-loud + within-root
  sandbox decisions (cite `specs/013-configurable-source-dirs/research.md`).
- [X] T014 [P] Update `CONTEXT.md` with a source-directory-configuration term (the set of root-relative
  dirs the linter walks; default `src`), keeping output/config vocabulary consistent (Constitution III).
- [X] T015 Run quickstart validation: `pnpm typecheck`, `pnpm test`,
  `node lint-color/index.ts fixtures/rails-app`, `node lint-color/index.ts fixtures/multi-src-app`,
  `pnpm lint:demo` — all gates green, demo output byte-identical (SC-002).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: no dependencies.
- **Foundational (P2)**: depends on Setup. Blocks US1 + US2.
- **US1 (P3)**: depends on Foundational. The MVP.
- **US2 (P4)**: depends on US1 (extends US1's `index.ts` discovery with dedup).
- **Polish (P5)**: depends on US1 (+US2 for full scope).

### Within Each User Story

- Tests written first and FAIL before implementation (Constitution II).
- `files.ts` validator/resolver (Foundational) before `index.ts` wiring (US1) before dedup (US2).

### Parallel Opportunities

- Foundational tests T002/T003 [P] (same new file `files.test.ts` — coordinate or land in one edit).
- US1 tests T006–T008 [P] (T007/T008 share `tests/e2e.test.ts` — coordinate).
- US2 tests T010/T011 [P] (T011 shares `tests/e2e.test.ts`).
- Polish T013/T014 [P] (different files).
- US1 and US2 implementation are NOT parallel — both edit `index.ts`.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Setup → 2. Foundational → 3. US1 → **STOP & VALIDATE** (Rails `app/` target lints, misconfig fails
   loud, demo unchanged) → demo.

### Incremental Delivery

1. Setup + Foundational → validator + resolver ready.
2. US1 → configurable single/replace source dir + fail-loud (MVP) → validate.
3. US2 → multi-dir + nested dedup → validate.
4. Polish → ADR, CONTEXT, full quickstart gate.

---

## Notes

- [P] = different files, no dependency. Same-file tasks are sequential.
- Every new behavior lands with a failing-first test (Constitution II); no `.only`/skip.
- No new dependency. `colorTokenFiles` / `componentsDirectory` stay ROOT-relative — out of scope.
- Commit after each task or logical group; branch `013-configurable-source-dirs`.
