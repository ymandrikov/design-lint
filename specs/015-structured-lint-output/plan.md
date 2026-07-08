# Implementation Plan: Structured Lint Output

**Branch**: `015-structured-lint-output` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-structured-lint-output/spec.md`

## Summary

Add a `--format json` mode to the lint-color CLI that emits one deterministic JSON
document (full run record: summary, violations, ignores, warnings, missing dirs) on
stdout; adopt a 0/1/2 exit-code contract; open the human report with a summary table.
Approach: extract reporting from `lint-color/index.ts` into a pure `report.ts`
(`renderHuman` / `renderJson` over a single `RunResult`), thread ERB parse warnings
out of `linter.ts` as return values instead of `console.warn`, and parse the new flag
with `node:util` `parseArgs`.

## Technical Context

**Language/Version**: TypeScript on Node ^26.1.0 (type-stripped, run directly via `node lint-color/index.ts`)

**Primary Dependencies**: none new — `node:util` `parseArgs` (stdlib) for flag parsing; existing tailwindcss/herb/oxc stack untouched

**Storage**: N/A (stdout/stderr only)

**Testing**: vitest — unit tests per module (`report.test.ts`), e2e via `tests/e2e.test.ts` spawning the CLI against `fixtures/demo-app`

**Target Platform**: CLI, macOS/Linux dev machines + CI

**Project Type**: single package (pnpm workspace root, `lint-color/` module)

**Performance Goals**: no lint-path change — reporting is post-scan string building; JSON render of ~500 violations is negligible vs. Tailwind design-system load

**Constraints**: JSON mode stdout carries exactly one JSON document (diagnostics → stderr); output byte-deterministic for identical trees; no ANSI codes in JSON regardless of TTY

**Scale/Scope**: ~500-violation real runs today; 3 files touched (`index.ts`, `linter.ts`, new `report.ts`) + tests + e2e additions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|---|---|
| I. Code Quality & Simplicity | PASS — one new single-concern module (`report.ts`); no abstraction beyond two render functions over one `RunResult` type; `pnpm typecheck` gate applies |
| II. Testing Standards | PASS — `report.test.ts` unit tests (shape, sort determinism, empty run, summary counts); e2e extended to assert exact JSON output and exit codes against `fixtures/demo-app`; deterministic by design (canonical sort) |
| III. UX Consistency | PASS — violation shape file/line/rule-name/message is exactly what III mandates; III explicitly requires human and machine output stay consistent for the same run (FR-009). Exit-code change (missing-dir-clean 1→2) is a public-contract change → version bump + migration note required (Quality Gates) |
| IV. Performance | PASS — no per-file or per-candidate work added; single sort of the violation array post-scan |

**Gate result**: PASS. One flagged obligation: version bump + migration note for the exit-code contract change (tracked as a task, not a violation).

**Post-design re-check (Phase 1)**: PASS — design added no projects, no dependencies, no abstractions beyond `RunResult` + two pure renderers; migration note drafted in `contracts/cli.md`.

## Project Structure

### Documentation (this feature)

```text
specs/015-structured-lint-output/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── cli.md           # CLI flag + exit-code + stream contract
│   └── run-record.schema.json  # JSON output schema
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
lint-color/
├── index.ts             # MODIFIED — parseArgs (--format), build RunResult, pick renderer, exit-code logic
├── linter.ts            # MODIFIED — lintErbSource returns warnings in LintResult (console.warn removed)
├── report.ts            # NEW — RunResult type; renderHuman(run, ansi) / renderJson(run): string
├── report.test.ts       # NEW — unit tests for both renderers
├── ansi.ts              # unchanged (plain/no-op styling already falls out of non-TTY; JSON mode passes identity ansi)
└── rules/               # unchanged

tests/
└── e2e.test.ts          # MODIFIED — JSON-mode run: parse doc, assert shape/counts/sort; exit-code matrix (0/1/2)

package.json             # MODIFIED — version bump; lint:demo:json script
```

**Structure Decision**: Existing flat `lint-color/` module layout; one new sibling
module `report.ts` following the repo's one-module-one-job + adjacent-test convention.

## Complexity Tracking

No constitution violations. Table not required.
