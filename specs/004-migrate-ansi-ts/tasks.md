---
description: "Task list — migrate ansi module JS → TS"
---

# Tasks: Migrate `lint-color/ansi.js` from JavaScript to TypeScript

**Input**: Design documents from `/specs/004-migrate-ansi-ts/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ansi.md, quickstart.md

**Tests**: No test tasks. The module has no dedicated suite and this is a behavior-preserving
language migration (spec Assumptions; Constitution II — no new behavior, so no new test is owed).
Preservation is proven by `pnpm typecheck` and the exact `pnpm lint:demo` output diff.

**Organization**: Tasks are grouped by the spec's user stories for traceability. NOTE: as with
any one-file language migration, these stories are **not independently shippable** — all three
are satisfied by one atomic rename+retype of a single module plus one import-specifier change.
They are sequenced slices of the same change. See Dependencies.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 (maps to spec.md)
- Paths are repo-relative.

---

## Phase 1: Setup

**Purpose**: Preconditions and a baseline to diff behavior against.

- [X] T001 Confirm runtime supports native `.ts`: `node --version` reports v26.1.0 (research R1). Abort if `< 23.6`.
- [X] T002 [P] Capture baseline demo output for the parity diff: `pnpm lint:demo > /tmp/ansi-before.txt 2>&1 || true` (quickstart step 0).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure before story work.

None. There is no shared infrastructure to build — the entire change is one leaf module plus
its single import site. Core work begins directly in Phase 3 (US1).

**Checkpoint**: Baseline captured — migration can begin.

---

## Phase 3: User Story 1 - The module is type-checked at its own contract (Priority: P1) 🎯 MVP

**Goal**: The module is authored in TypeScript with typed exports and no `any`; `pnpm typecheck` covers its body.

**Independent Test**: Module lives at a `.ts` path, `pnpm typecheck` is green, and the exported `isTTY`/`red`/`blue`/`dim`/`bold` are unchanged.

### Implementation for User Story 1

- [X] T003 [US1] Create `lint-color/ansi.ts` — verbatim logic port of the current `.js`: keep the `// Terminal styling — ANSI escapes, gated on TTY.` header, `export const isTTY = process.stdout.isTTY;` (leave its type as `boolean | undefined` — do NOT coerce with `Boolean()`, per research R4 / data-model), and the four helpers `red`/`blue`/`dim`/`bold` each typed `(s: string) => string` with unchanged escape sequences (SGR 31/34/2/1). No `any`.
- [X] T004 [US1] Delete the old `lint-color/ansi.js`.
- [X] T005 [US1] Run `pnpm typecheck` → zero errors. If tsc errors on a `.ts`-extension import from `index.js`, add `"allowImportingTsExtensions": true` to `tsconfig.json` `compilerOptions` and re-run (research R3); otherwise leave `tsconfig.json` untouched (YAGNI).

**Checkpoint**: Module is TypeScript and type-clean. Runtime wiring happens in US2.

---

## Phase 4: User Story 2 - The linter still loads and colorizes its output identically (Priority: P1)

**Goal**: The linter imports and runs the migrated `.ts` module unchanged in behavior, with no build/loader step added.

**Independent Test**: `pnpm lint:demo` runs to completion (no module-resolution error) and output is produced.

### Implementation for User Story 2

- [X] T006 [US2] In `lint-color/index.js` (line 12), change the import specifier `"./ansi.js"` → `"./ansi.ts"` (the only in-repo importer; `linter.js` receives `ansi` as a parameter and does not import the module — research R2).
- [X] T007 [US2] Run `pnpm lint:demo`; confirm it completes with no `ERR_MODULE_NOT_FOUND` and output is still produced. Confirm no new dependency, build script, or loader flag was added to `package.json` (SC-004).

**Checkpoint**: Linter loads and runs the TS module end-to-end.

---

## Phase 5: User Story 3 - TTY gating and escape codes are preserved exactly (Priority: P2)

**Goal**: Plain output when non-TTY and identical escape sequences when TTY; byte-for-byte parity with pre-migration.

**Independent Test**: The demo diff is empty (non-TTY passthrough path) and the colored terminal run still shows red/blue/dim.

### Implementation for User Story 3

- [X] T008 [US3] Diff demo output against the baseline (non-TTY passthrough path): `pnpm lint:demo > /tmp/ansi-after.txt 2>&1 || true; diff /tmp/ansi-before.txt /tmp/ansi-after.txt` → empty diff (SC-003).
- [X] T009 [US3] Verify the TTY-colored path by eye: run `node lint-color/index.js fixtures/demo-app` directly in an interactive terminal and confirm violations still render with red/blue/dim coloring (quickstart step 0 note; `lint:demo` pipes to a file so it exercises only the non-TTY branch).

**Checkpoint**: Behavior parity proven for both TTY and non-TTY paths.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T010 [P] Confirm the full public surface is intact: `grep -n "export const" lint-color/ansi.ts` lists exactly `isTTY`, `red`, `blue`, `dim`, `bold` — including `blue` and `isTTY`, which have no in-repo consumer but stay exported (SC-006; spec Edge Case).
- [X] T011 [P] Confirm no unjustified `any`: `grep -n "any" lint-color/ansi.ts` → none, or each carries an inline rationale (SC-005).
- [X] T012 Run the full quality gate: `pnpm typecheck && pnpm test` → both green, no skipped / `.only` (Constitution II).
- [X] T013 Walk `quickstart.md` end-to-end and confirm every "Expected" holds; confirm `ansi.js` is gone and `ansi.ts` exists (SC-001).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; T002 can run any time before T008.
- **Foundational (Phase 2)**: empty.
- **US1 (Phase 3)**: after Setup. T003 → T004 → T005 (sequential; same module).
- **US2 (Phase 4)**: after T003 (the `.ts` module must exist). T006 → T007.
- **US3 (Phase 5)**: after US2 (linter must load the module). T008 → T009.
- **Polish (Phase 6)**: after US1–US3.

### Story independence — IMPORTANT

These stories are **not** independently deliverable. T003 (the rename+retype) is the single point
all stories flow through; US2 makes it load, US3 verifies parity. Do not ship US2 or US3 without
US1. This is inherent to a one-file language migration.

### Parallel Opportunities

- T002 [P] runs alongside T001.
- T010 [P] and T011 [P] are independent read-only checks → parallel.
- Everything else is sequential (single module, single importer).

---

## Parallel Example: Phase 6 checks

```bash
# The two surface/any audits are independent read-only greps — run together:
Task: "Confirm public surface is intact in lint-color/ansi.ts (T010)"
Task: "Confirm no unjustified any in lint-color/ansi.ts (T011)"
```

---

## Implementation Strategy

### MVP scope

The MVP is the whole feature — too small to slice. Practically: T001–T002 (setup) →
T003–T005 (US1: the TS rewrite, the MVP core) → T006–T007 (US2: wire the import so it runs) →
T008–T009 (US3: prove parity) → T010–T013 (polish/gate).

### Recommended commit boundary

Commit T003–T009 as one logical change (the migration is atomic — a half-applied rename leaves
the linter unable to load the module). Run the Phase 6 gate before committing.
