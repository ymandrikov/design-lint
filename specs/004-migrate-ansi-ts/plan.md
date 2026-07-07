# Implementation Plan: Migrate `lint-color/ansi.js` from JavaScript to TypeScript

**Branch**: `004-migrate-ansi-ts` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-migrate-ansi-ts/spec.md`

## Summary

Rename `lint-color/ansi.js` → `lint-color/ansi.ts`, adding types to its one TTY flag and
four string-to-string styling helpers, and update the single importer's specifier
(`lint-color/index.js`) from `./ansi.js` to `./ansi.ts`. No build step, no behavior change:
Node's native type stripping runs the `.ts` source directly, escape sequences and TTY
gating are byte-for-byte preserved. This follows the exact precedent set by the
`no-spectral-color` JS→TS migration (feature 002), minus the classifier-boundary typing —
this module is a self-contained leaf with no domain shapes to derive.

## Technical Context

**Language/Version**: TypeScript (type-stripped by Node ≥ 23.6), Node `^26.1.0` (measured v26.1.0)

**Primary Dependencies**: None. Leaf module; only ambient dependency is `process.stdout.isTTY` (`node:process`).

**Storage**: N/A

**Testing**: `pnpm typecheck` (tsc `--noEmit`), `pnpm lint:demo` output comparison. No dedicated unit suite exists or is added (out of scope per spec).

**Target Platform**: Node CLI (terminal)

**Project Type**: Single project — CLI linter (`lint-color/`)

**Performance Goals**: Unchanged. Type stripping is erasure-only; zero runtime cost delta (Constitution IV).

**Constraints**: No new build/bundle/loader step (SC-004). Zero unjustified `any` (Constitution I). Exact escape sequences and TTY-gating semantics preserved (FR-005, FR-006).

**Scale/Scope**: One 8-line module; one import-site edit. 5 exported members.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Code Quality & Simplicity** — PASS. Migration adds honest types to a single-concern
  module and deletes the untyped source; no abstraction added, no `any` needed (all helpers
  are `(s: string) => string`). Scope held to one module + one importer edit (YAGNI).
- **II. Testing Standards** — PASS (with note). No new *behavior*, so no new failing-test
  requirement is triggered; the module has no existing suite. Preservation is verified by
  `pnpm typecheck` and the exact `pnpm lint:demo` output comparison (the e2e output contract),
  which is the source of truth per Principle II.
- **III. User Experience Consistency** — PASS. Output contract is the escape sequences and
  TTY gating; both are preserved exactly (FR-005–FR-007). No CLI flag, config key, rule name,
  or exit code changes — no public-contract break, no version bump required.
- **IV. Performance Requirements** — PASS. Type stripping is erasure-only; no runtime,
  parsing, or memory change.

**Result**: PASS. No violations; Complexity Tracking not required.

*Post-Phase 1 re-check*: PASS — design (below) introduces no abstraction, no dependency,
no `any`, and no change to the runtime module graph beyond the extension rename.

## Project Structure

### Documentation (this feature)

```text
specs/004-migrate-ansi-ts/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── ansi.md          # Public surface of the ansi module
├── checklists/
│   └── requirements.md  # From /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
lint-color/
├── ansi.ts              # MIGRATED (was ansi.js) — TTY flag + red/blue/dim/bold helpers
├── index.js             # EDITED — import specifier "./ansi.js" → "./ansi.ts"
├── linter.js            # unchanged (does not import ansi module directly)
└── rules/               # unchanged
```

**Structure Decision**: Single-project CLI layout under `lint-color/`. The migration
touches exactly two files: the renamed module `lint-color/ansi.ts` and its sole importer
`lint-color/index.js`. No other directory is affected.

## Complexity Tracking

> No Constitution Check violations. Section intentionally empty.
