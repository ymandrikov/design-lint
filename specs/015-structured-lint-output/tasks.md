# Tasks: Structured Lint Output

**Input**: Design documents from `/specs/015-structured-lint-output/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED — constitution II is non-negotiable: new behavior ships with a failing test it turns green; e2e asserts exact output.

**Organization**: Grouped by user story. US1 (JSON output) is the MVP slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on incomplete tasks)
- **[Story]**: US1 (machine-readable results), US2 (exit codes), US3 (human summary)

## Path Conventions

Single package at repo root; linter module in `lint-color/`, e2e in `tests/`.

---

## Phase 1: Setup

**Purpose**: Confirm clean baseline — no scaffolding or dependencies needed (stdlib `parseArgs` only).

- [X] T001 Verify baseline gates green before any change: `pnpm typecheck && pnpm test && pnpm lint:demo` at repo root

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure-linter warnings + `RunResult`/renderer seam that every story renders through. Behavior-preserving refactor — human output byte-identical after this phase.

**⚠️ CRITICAL**: No user story work until this phase completes.

- [X] T002 Widen `LintResult` with `warnings: string[]` in `lint-color/linter.ts`: `lintErbSource` returns parse notes instead of `console.warn` (remove linter.ts:243 side effect); all other lint methods return `warnings: []` (research D8)
- [X] T003 Update ERB linter tests in `lint-color/linter.lintErb.test.ts`: assert parse notes now returned in `LintResult.warnings` (and no console.warn) for a malformed template; adjust any other `LintResult` shape assertions in `lint-color/linter.test.ts` / `lint-color/linter.lintCss.test.ts`
- [X] T004 Create `lint-color/report.ts`: `RunResult`/`RunViolation`/`RunIgnore` types per data-model.md; `renderHuman(run, ansi)` extracted verbatim from `lint-color/index.ts:281-322` (clean message, rule-grouped detail, suppression summary — no behavior change yet)
- [X] T005 Refactor `lint-color/index.ts`: `accumulate()` also collects warnings; build one `RunResult` (violations with rule *names* via the existing `ruleModules` id→name map, ignores, warnings, `missingSourceDirs` from `resolveExistingSourceDirs`, `ruleLabels` from colors.json descriptions); print via `renderHuman`; warnings echo to stderr as before. Verify `pnpm test` and `pnpm lint:demo` output unchanged

**Checkpoint**: Reporting flows through `RunResult`; human output identical to pre-refactor.

---

## Phase 3: User Story 1 — Machine-readable run results (Priority: P1) 🎯 MVP

**Goal**: `--format json` emits one deterministic full-run-record JSON document on stdout; diagnostics on stderr only.

**Independent Test**: `node lint-color/index.ts fixtures/demo-app --format json` → stdout parses as one JSON doc matching `contracts/run-record.schema.json`; two runs byte-identical (quickstart §1–2).

### Tests for User Story 1 (write first, must fail)

- [X] T006 [P] [US1] Unit tests for `renderJson` in `lint-color/report.test.ts`: top-level keys exactly `summary, violations, ignores, warnings, missingSourceDirs`; violation fields exactly `file, line, rule, message` with kebab-case rule names; canonical sort file→line→rule→message regardless of input order; empty-run doc (zero counts, empty arrays); `summary` counts equal array lengths; output contains no ANSI escape sequences
- [X] T007 [P] [US1] e2e JSON-mode tests in `tests/e2e.test.ts`: spawn CLI with `--format json` against `fixtures/demo-app` — stdout is exactly one parseable JSON doc; violation counts match the human run's totals; rule names match colors.json keys; two consecutive runs produce byte-identical stdout

### Implementation for User Story 1

- [X] T008 [US1] Implement `renderJson(run)` in `lint-color/report.ts`: canonical sort per research D7, `JSON.stringify(doc, null, 2)` + trailing newline, `summary` derived from array lengths (contracts/run-record.schema.json)
- [X] T009 [US1] Wire flag in `lint-color/index.ts`: `node:util` `parseArgs` (`allowPositionals: true`, `--format` default `"human"`); unrecognized value or unknown flag → stderr message naming accepted values (FR-010); JSON mode passes identity ansi (`s => s`) into `createLinter` and the report so messages carry no escape codes on a TTY (research D10); JSON mode prints `renderJson(run)` to stdout and mirrors warnings + missing-dir notices to stderr (research D5)
- [X] T010 [US1] Turn T006+T007 green: `pnpm test`; validate quickstart §1, §2, §5

**Checkpoint**: US1 fully functional — machine consumers parse runs with zero prose scraping.

---

## Phase 4: User Story 2 — Run outcome distinguishable by exit code (Priority: P2)

**Goal**: 0 = clean, 1 = violations, 2 = run error; automation routes gate-fail vs infra-fail on code alone.

**Independent Test**: Exit-code matrix per quickstart §3 — clean temp target 0, demo fixture 1, missing configured dir 2, bad `--format` 2.

### Tests for User Story 2 (write first, must fail)

- [X] T011 [P] [US2] e2e exit-code matrix in `tests/e2e.test.ts`: clean temp target (valid colors.json, violation-free source) → 0; `fixtures/demo-app` → 1; temp target with nonexistent configured `sourceDirectories` entry but otherwise clean → 2; malformed `sourceDirectories` (existing `tempTargetWithSourceDirs` helper) → 2; `--format yaml` → 2 with stderr naming accepted values. Update any existing assertions that expect exit 1 for config/dir errors

### Implementation for User Story 2

- [X] T012 [US2] Exit-code logic in `lint-color/index.ts`: run errors (config validation failure, no scannable dirs, `hadMissingDir` — including the clean-scan case at index.ts:296 — bad `--format`) exit 2; violations exit 1; clean exits 0 (contracts/cli.md)
- [X] T013 [US2] Public-contract change per constitution quality gates: bump `version` in `package.json` and add `CHANGELOG.md` entry with migration note (missing-dir-but-clean 1→2; `exit != 0` scripts unaffected) — wording drafted in `contracts/cli.md`

**Checkpoint**: US1 + US2 independently verifiable; exit codes stable and documented.

---

## Phase 5: User Story 3 — Human report opens with a summary (Priority: P3)

**Goal**: Violations-present human report starts with total count, affected-file count, per-rule counts (descending).

**Independent Test**: `pnpm lint:demo` first lines show `Color lint: N violations in M files` + per-rule count table matching the detail listing (quickstart §4).

### Tests for User Story 3 (write first, must fail)

- [X] T014 [P] [US3] Unit tests for summary header in `lint-color/report.test.ts`: multi-rule `RunResult` → header line with total + distinct-file count, one line per triggered rule with designer-facing label from `ruleLabels` sorted by descending count; counts agree with detail listing; clean run → existing `✓` message and no table

### Implementation for User Story 3

- [X] T015 [US3] Add summary header to `renderHuman` in `lint-color/report.ts` per contracts/cli.md shape (header, blank line, right-aligned per-rule counts, then existing detail listing)
- [X] T016 [US3] Extend e2e in `tests/e2e.test.ts`: demo run stdout contains the summary header and per-rule count lines; confirm existing `toContain` assertions still pass; `pnpm test` green

**Checkpoint**: All three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T017 [P] Add `"lint:demo:json": "node lint-color/index.ts fixtures/demo-app --format json"` script to `package.json`
- [X] T018 Full validation sweep: run every quickstart.md scenario (§1–§6); gates `pnpm typecheck`, `pnpm test`, `pnpm lint:demo`, `pnpm lint:demo:json | jq .summary`; review human + JSON output of the same run agree on every count (FR-009/SC-005)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: none
- **Foundational (P2)**: after T001 — BLOCKS all stories. Internal order: T002 → T003; T004 → T005 (T005 needs both T002 and T004)
- **US1 (P3)**: after Phase 2. T006 ∥ T007 → T008 → T009 → T010
- **US2 (P4)**: after Phase 2; T009's flag-validation path feeds T012's exit-2 case — run after US1 (or accept T012 touching `index.ts` concurrently is a conflict; sequential recommended). T011 → T012 → T013
- **US3 (P5)**: after Phase 2; only touches `report.ts`/tests — independent of US1/US2 aside from shared files. T014 → T015 → T016
- **Polish (P6)**: after desired stories complete

### User Story Dependencies

- **US1**: Foundational only
- **US2**: Foundational; shares `lint-color/index.ts` with US1 — sequential edit recommended, independently testable
- **US3**: Foundational; shares `lint-color/report.ts`/`report.test.ts` with US1 — independently testable

### Parallel Opportunities

- T006 ∥ T007 (different files)
- T011 can be authored while US1 implementation is in progress (test-only file)
- T014 ∥ anything in US2 (different files)
- T017 ∥ T016

## Parallel Example: User Story 1

```bash
# After Phase 2 checkpoint, author both failing test suites concurrently:
Task: "Unit tests for renderJson in lint-color/report.test.ts"          # T006
Task: "e2e JSON-mode tests in tests/e2e.test.ts"                        # T007
# Then implement sequentially (same files): T008 → T009 → T010
```

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 → Phase 2 (refactor, output unchanged)
2. Phase 3: US1 — `--format json` end-to-end
3. STOP, validate quickstart §1/§2/§5; MVP shippable

### Incremental Delivery

1. US1 → machine output (MVP)
2. US2 → exit codes + version bump + migration note
3. US3 → human summary
4. Polish → convenience script + full sweep

Single-developer feature; stories share `index.ts`/`report.ts`, so sequential P1→P2→P3 is the natural order. Commit per task or logical group; branch off `main` (constitution workflow).

## Notes

- Every task turning a failing test green satisfies constitution II; T005 is the one pure refactor and is pinned by the existing e2e exact-output assertions instead.
- e2e determinism (T007) doubles as the constitution II determinism requirement for the new output path.
