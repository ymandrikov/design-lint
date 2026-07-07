# Tasks: Refactor and migrate the file-discovery layer (`files.js`) → TypeScript

**Feature**: `specs/007-migrate-files-ts` | **Branch**: `ym/explore`
**Input**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/files-module.md](./contracts/files-module.md), [quickstart.md](./quickstart.md)

**Tests**: No new test tasks. This is a behavior-preserving language migration and the module
has no unit suite today; `pnpm lint:demo` (which drives `getAllFiles`/`isStorybookFile`
through the CLI) and `pnpm typecheck` are the behavior contract and MUST hold unchanged
(spec: SC-003/SC-004).

**Baseline to preserve**: `pnpm typecheck` = 0 errors; `pnpm lint:demo` = **23 violations,
1 suppressed**; `pnpm test` = all green.

---

## Phase 1: Setup

- [X] T001 Capture the green baseline before any edit: run `pnpm typecheck` (expect 0 errors), `node lint-color/index.js fixtures/demo-app | tail -3` (expect `23 violations found.` + `(1 line suppressed with color-lint-ignore)`), and `pnpm test` (all green). Record the demo counts for the SC-003 comparison.

## Phase 2: Foundational

_No foundational tasks. The migration is confined to one module; its creation is the first user-story task and blocks nothing else beforehand._

---

## Phase 3: User Story 1 — File-discovery layer type-checked at its own contract (Priority: P1) 🎯 MVP

**Goal**: `lint-color/files.ts` exists with both exports and the internal `Dirent` handling
typed; `pnpm typecheck` covers its body with zero errors and zero unjustified `any`.

**Independent Test**: `test -f lint-color/files.ts`; `pnpm typecheck` → 0 errors; no implicit
`any` on params/returns; any explicit `any` carries an inline justification.

- [X] T002 [US1] Create `lint-color/files.ts` as a full typed rewrite of `lint-color/files.js`, preserving the leading comment, the `node:fs`/`node:path` imports, and the runtime logic (no control-flow change). Type the signatures per [contracts/files-module.md](./contracts/files-module.md): `getAllFiles(dir: string, ...exts: string[]): string[]` and `isStorybookFile(filePath: string): boolean`. Entries infer as `Dirent<string>` from `readdirSync`, so `e.isFile()`, `extname(e.name)`, and `e.parentPath` resolve with no cast and no explicit annotation. **Finding**: the JS `e.parentPath ?? e.path` fails typecheck — the deprecated `Dirent.path` alias is gone from `@types/node ^26.1.0` (`TS2339`); since `parentPath` is always populated the fallback was dead, so read `e.parentPath` alone (output-identical) with a one-line `why` comment (research.md D3). Do not introduce `any`. Keep `lint-color/files.js` in place for now (deleted in US2).
- [X] T003 [US1] Run `pnpm typecheck` and resolve any errors originating in `lint-color/files.ts` until it reports 0 errors (SC-002). Do not weaken types to silence errors; fix the shapes.

**Checkpoint**: `files.ts` typechecks clean and standalone (old `files.js` still present; importer unchanged).

---

## Phase 4: User Story 2 — Linter still discovers every file exactly as before (Priority: P1)

**Goal**: The sole importer resolves to `files.ts`, the old `files.js` is gone, and the
linter runs end-to-end with the identical demo violation set.

**Independent Test**: `grep -rn 'files\.js' lint-color` → no matches; `pnpm lint:demo` → 23
violations, 1 suppressed, identical to baseline.

- [X] T004 [US2] Update the import specifier `./files.js` → `./files.ts` in `lint-color/index.js` (the sole importer, line 13).
- [X] T005 [US2] Delete `lint-color/files.js` (replaced by `files.ts`, SC-001). Then run `grep -rn 'files\.js' lint-color` and confirm no reference to the deleted module remains (FR-003).
- [X] T006 [US2] Run `node lint-color/index.js fixtures/demo-app | tail -3` and confirm **23 violations, 1 suppressed** — byte-for-byte identical to the T001 baseline (SC-003). Any delta is a regression to fix before proceeding.

**Checkpoint**: Linter loads the TypeScript module and produces identical output; no `files.js` remains.

---

## Phase 5: User Story 3 — Recursive walk and Storybook exclusion preserved (Priority: P2)

**Goal**: The recursive walk, the `extname` extension filter, the `parentPath` join, and the
three Storybook exclusion conditions are confirmed to produce identical output.

**Independent Test**: `pnpm test` all green; `pnpm lint:demo` scans the same file set (identical violations).

- [X] T007 [US3] Review `git diff lint-color/files.js lint-color/files.ts` and confirm the change is annotations-plus-erasure **plus the one behavior-preserving line** (`parentPath ?? path` → `parentPath`, dead-fallback removal per T002/research D3): the `readdirSync(..., { recursive: true, withFileTypes: true })` walk, the `isFile()` + `extSet.has(extname(name))` filter, and the three `isStorybookFile` conditions (`/stories/`, `.stories.tsx`, `.stories.ts`) are identical in logic (FR-005, FR-006). The dropped fallback is verified output-identical by T006's unchanged demo run.
- [X] T008 [US3] Run `pnpm test` and confirm every suite is green (nothing imports this module, so the suite must be unaffected — a failure here signals an unrelated break to investigate).

**Checkpoint**: All three user stories independently verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T009 Confirm no new build/bundle/loader step was introduced (SC-004): `package.json` unchanged; `tsconfig.json` unchanged (`allowImportingTsExtensions` already present — no edit needed). Node runs `.ts` natively.
- [X] T010 Confirm SC-005: `grep -n ':\s*any\|as any' lint-color/files.ts` — expect no matches (or each inline-justified); zero unjustified `any`.
- [X] T011 Confirm SC-001: `ls lint-color/files.*` shows `files.ts` only — no `files.js`.
- [X] T012 Final gate: re-run `pnpm typecheck && pnpm test && pnpm lint:demo` together; all green, 23 violations / 1 suppressed. Feature complete.

---

## Dependencies & Execution Order

- **Setup (T001)** → first; captures the comparison baseline.
- **US1 (T002–T003)** → depends on T001. Same-file (`files.ts`), so sequential (no [P]).
- **US2 (T004–T006)** → depends on US1 (the `.ts` module must exist and typecheck before the import points to it and the `.js` is deleted). Sequential: edit specifier → delete `.js` → verify demo.
- **US3 (T007–T008)** → depends on US2 (runtime module must load). Diff review + full suite.
- **Polish (T009–T012)** → last.

## Parallel Opportunities

- None meaningful. The change touches only two files (`files.ts`, `index.js`) along a single
  dependency chain, so tasks run sequentially. (Contrast the classify migration, which had
  eight independent import sites to edit in parallel.)

## Implementation Strategy

- **MVP = User Story 1**: a typed `files.ts` that `pnpm typecheck` covers with zero errors is
  the core value (types are the primary contract). US2 wires it in; US3 confirms behavior.
- **Incremental delivery**: US1 (module typed, standalone) → US2 (loaded + old deleted, demo
  identical) → US3 (walk/exclusion parity confirmed, suite green). Each checkpoint is
  independently verifiable.

## Implementation Notes (actual outcome)

- **All 12 tasks complete.** Final gate green: `pnpm typecheck` 0 errors · `pnpm test` 393
  passed (20 files) · `pnpm lint:demo` 23 violations, 1 suppressed — identical to baseline.
- **Files**: `lint-color/files.ts` created (replaces `files.js`, deleted); one runtime import
  specifier in `lint-color/index.js` switched `./files.js` → `./files.ts`. No test edits (no
  test imports this module). No tsconfig/package.json change.
- **One behavior-preserving logic change** (surfaced by the migration, not planned): the JS
  `join(e.parentPath ?? e.path, e.name)` became `join(e.parentPath, e.name)`. The deprecated
  `Dirent.path` alias was removed from `@types/node ^26.1.0`, so `?? e.path` no longer
  type-checks (`TS2339`); `parentPath` is always populated (Node ≥ 20) so the fallback was
  dead. Verified output-identical by the unchanged demo run. A one-line `why` comment records
  the removal. Spec FR-005, research D3, data-model, and the contract were updated to match.
- **Types**: `getAllFiles(dir: string, ...exts: string[]): string[]`,
  `isStorybookFile(filePath: string): boolean`; entries infer as `Dirent<string>`. **Zero
  `any`.**
