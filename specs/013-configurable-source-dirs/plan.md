# Implementation Plan: Configurable Source Directories

**Branch**: `013-configurable-source-dirs` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-configurable-source-dirs/spec.md`

## Summary

Make the directories the linter walks configurable per target. Today `index.ts`
hardcodes `SRC = join(ROOT, "src")` and calls `getAllFiles(SRC, …)` three times
(CSS, TS/TSX, ERB). We add an optional `sourceDirectories: string[]` key to the
per-target lint config (`design-system/lint/colors.json`), defaulting to `["src"]`
for byte-identical back-compat. When set, the list fully replaces the `src` default.
The change is confined to config parsing + file discovery: a small, pure validator
lives in `files.ts`, `index.ts` resolves and existence-checks the dirs once, then the
three discovery passes iterate the resolved dirs and deduplicate files by absolute
path. No rule logic, no `lint*Source` method, and no output shape changes.

## Technical Context

**Language/Version**: TypeScript 6 on Node ^26.1.0, ESM (`"type":"module"`), run via `node lint-color/*.ts`.

**Primary Dependencies**: none new. Uses `node:fs` (`readdirSync`, `statSync`) and `node:path` (`join`, `isAbsolute`, `normalize`) already in play.

**Storage**: N/A (stateless CLI over source files).

**Testing**: vitest. New pure unit tests for the validator (`lint-color/files.test.ts`); new e2e fixtures for a Rails-style `app/` target, a multi-dir/nested target, and misconfiguration cases (`tests/e2e.test.ts`).

**Target Platform**: Node CLI (dev machines + CI).

**Project Type**: Single-project CLI linter (`lint-color/`).

**Performance Goals**: File discovery stays linear in files walked; dedup is an O(files) `Set` on absolute paths. No new per-file cost on the lint path.

**Constraints**: Zero regression when the key is absent — demo run byte-identical (SC-002). Misconfiguration never yields a silent clean pass (fail-loud, non-zero exit).

**Scale/Scope**: Config parsing + file discovery only. `colorTokenFiles` and `componentsDirectory` are explicitly out of scope (stay ROOT-relative, untouched).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Code Quality & Simplicity** — PASS. One new single-concern helper
  (`validateSourceDirs`) plus a thin existence-partition; both testable pure-ish
  functions in `files.ts`. No abstraction beyond a second caller's need. `pnpm
  typecheck` must stay green; the new config field is typed at the JSON.parse seam.
- **II. Testing Standards (NON-NEGOTIABLE)** — PASS by plan. Validator gets a unit
  suite covering every accept/reject branch (default, empty, non-array, non-string,
  absolute, `..`-escape). e2e fixtures assert exact output + exit codes for the Rails
  `app/` case (SC-001), multi-dir/nested dedup (SC-003), and each misconfiguration
  (SC-004). Demo non-regression pins SC-002. No `.only`/skip.
- **III. User Experience Consistency** — PASS. Violations keep the identical
  `{file (root-relative), line, rule, message}` shape and exit codes. New config key
  `sourceDirectories` is additive/optional with a `["src"]` default — backward
  compatible, no breaking change. Error messages name the offending directory/value
  in plain language; misconfig is surfaced and counted, never silent.
- **IV. Performance Requirements** — PASS. Discovery remains linear; dedup is a single
  `Set`. Parsing/candidate compilation unchanged and still once-per-file.

**No violations → Complexity Tracking left empty.**

## Project Structure

### Documentation (this feature)

```text
specs/013-configurable-source-dirs/
├── plan.md              # This file
├── spec.md              # Feature spec
├── research.md          # Phase 0 — decisions (from grilling)
├── data-model.md        # Phase 1 — config + discovery shapes
├── contracts/
│   └── source-dirs.md   # Phase 1 — config contract + discovery/exit behavior
├── quickstart.md        # Phase 1 — runnable validation
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
lint-color/
├── files.ts                    # EDIT — add validateSourceDirs() + resolveExistingSourceDirs()
├── files.test.ts               # NEW  — pure unit tests for the validator
├── index.ts                    # EDIT — parse/validate/resolve dirs once; iterate + dedup discovery; fold missing-dir into exit code
├── linter.ts / ast*.ts / rules/*   # (unchanged) inner pipeline + extractors reused verbatim

fixtures/
├── rails-app/                  # NEW — app/ layout, no src/, sourceDirectories:["app"], one ERB violation
├── multi-src-app/              # NEW — two dirs (incl. a nested pair) proving dedup (SC-003)
└── (misconfig cases exercised inline in e2e via bad configs / temp targets)

tests/
└── e2e.test.ts                 # EDIT — Rails app run, multi-dir dedup, missing/empty/absolute error + exit-code assertions
```

**Structure Decision**: Single project. The feature is a config + discovery concern,
so it lives at the CLI seam (`index.ts`) with the reusable, testable path logic
factored into `files.ts` (where `getAllFiles` already lives). The validator is pure
(no fs) so it unit-tests without fixtures; existence resolution is a thin fs partition
covered by e2e fixtures. Rule modules, `ast*.ts`, and every `lint*Source` method are
untouched.

## Key Design Decisions (from research / grilling)

1. **Config home**: a new optional `sourceDirectories: string[]` key in
   `design-system/lint/colors.json`. No CLI flag — source roots are a committed
   per-target property, not a per-invocation one.
2. **Default & replace**: absent ⇒ `["src"]` (byte-identical back-compat). Present ⇒
   the list fully replaces the default; `src` is not implicitly added.
3. **Validation (fail-loud, pure)**: reject a present-but-empty list, a non-array
   value, a non-string entry, an absolute path, or a path containing `..` — each with
   a message naming the problem. Configured dirs must resolve within the target root.
4. **Missing directory**: surface a message naming it; scan the dirs that do exist;
   exit non-zero regardless (a configured path could not be honored). If none exist,
   error and exit non-zero without scanning — never a clean pass.
5. **Dedup**: a lintable file reachable through more than one configured dir (overlap
   or nesting) is scanned once — dedup by resolved absolute path across each discovery
   pass.
6. **Scope guard**: only the walked roots become configurable. `colorTokenFiles`
   (token derivation + CSS exemption) and `componentsDirectory` (protected components)
   stay ROOT-relative and independent.

## Complexity Tracking

*No constitution violations — not applicable.*
