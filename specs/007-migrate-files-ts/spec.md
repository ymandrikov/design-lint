# Feature Specification: Refactor and migrate the file-discovery layer (`files.js`) from JavaScript to TypeScript

**Feature Branch**: `ym/explore`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Refactor lint-color/files.js and migrate from JS to TS."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The file-discovery layer is type-checked at its own contract (Priority: P1)

A rule author opens the file-discovery layer and finds it written in TypeScript. The
recursive walk `getAllFiles(dir, ...exts)` declares that it takes a directory string and a
rest list of extension strings and returns a `string[]` of absolute-joined file paths; the
Storybook predicate `isStorybookFile(filePath)` declares a `string` in and a `boolean` out.
The directory-entry values the walk filters and maps (`Dirent` records, including the
`parentPath`/`path` fields it reads) carry compiler-enforced types. `pnpm typecheck` now
covers the body of this module — the layer that turns a source root into the list of files
the linter reads — not just its one caller.

**Why this priority**: This is the whole point of the change. File discovery is the entry
gate of every lint run: it decides which files the linter even opens, and the CLI
entrypoint depends on it before any rule runs. The constitution names TypeScript types "the
primary contract," and this is a boundary module still authored in untyped JavaScript.
Making the walk's inputs and its `string[]` output explicit — and typing the `Dirent`
handling with its `parentPath ?? path` fallback — is the value delivered; everything else is
preservation.

**Independent Test**: Confirm the module now lives at a `.ts` path, `pnpm typecheck` passes
with zero errors, and both exported functions plus the internal `Dirent` handling carry
types (no implicit `any` on parameters or returns; any explicit `any` carries an inline
justification).

**Acceptance Scenarios**:

1. **Given** the migrated file-discovery module, **When** `pnpm typecheck` runs, **Then** it reports zero errors and the module's own parameters and return values are typed.
2. **Given** each exported member (`getAllFiles`, `isStorybookFile`), **When** inspected after migration, **Then** its name and call signature are unchanged.

---

### User Story 2 - The linter still discovers every file exactly as before (Priority: P1)

An app developer runs the linter (`pnpm lint:demo` / `node lint-color/index.js`) exactly as
before. The one importer (`lint-color/index.js`) resolves to the migrated module, and the
linter walks the same source tree, discovers the same `.css`, `.ts`, and `.tsx` files,
applies the same Storybook exclusion, and produces the same violations — same files scanned,
same classes flagged, same messages, same counts — as it did when the module was JavaScript.

**Why this priority**: A discovery module the runtime can no longer import breaks the entire
lint run before a single rule fires. The module is consumed by a static import in the CLI
entrypoint; that import site and the runtime's ability to load the TypeScript module are
part of the contract, not an afterthought. Per the repo convention (e.g. `ansi.ts` imported
as `"./ansi.ts"`), the runtime entrypoint imports migrated modules by their `.ts` specifier.

**Independent Test**: Run `pnpm lint:demo` over the demo-app fixture before and after the
migration and confirm the full violation set — files scanned, classes, messages, and counts
across all rules — is byte-for-byte identical.

**Acceptance Scenarios**:

1. **Given** the sole importer `lint-color/index.js`, **When** it imports the migrated module, **Then** the import resolves and both exported functions are usable with the same signatures.
2. **Given** the demo-app fixture, **When** the linter runs after migration, **Then** the complete set of violations (files, classes, messages, counts) across all rules is identical to the pre-migration run.
3. **Given** the CLI entrypoint `node lint-color/index.js`, **When** it loads the migrated module with no build or bundle step, **Then** it resolves and runs exactly as before.

---

### User Story 3 - Recursive walk and Storybook exclusion are preserved exactly (Priority: P2)

A design-system maintainer sees no change in which files the linter reads because the
discovery layer's observable behavior is unchanged: the recursive `readdirSync` walk with
`withFileTypes`, the extension filter built from the rest-arg set (matched via `extname`,
so a caller passing `".ts"` still matches and passing none matches nothing), the
`parentPath ?? path` join that yields each file's full path, and the Storybook predicate's
three exclusion conditions (a `/stories/` path segment, a `.stories.tsx` suffix, a
`.stories.ts` suffix).

**Why this priority**: Preserving observable behavior is the contract of a language
migration. It is P2 only because Stories 1 and 2 already assert typing and loading; this
story pins the specific walk and exclusion cases the module encodes.

**Acceptance Scenarios**:

1. **Given** a source root with nested subdirectories, **When** `getAllFiles(dir, ".ts", ".tsx")` runs, **Then** it returns every nested file whose extension is in the set, each as a `parentPath`-joined full path, identical to today's result.
2. **Given** a `Dirent` under Node `^26.1.0` (where `parentPath` is always populated), **When** its path is joined, **Then** `join(parentPath, name)` yields the same full path the JS produced. (The JS `?? path` branch was never reached — `parentPath` is never nullish — so dropping it is output-identical; see the edge case below.)
3. **Given** paths `src/stories/Button.tsx`, `src/Button.stories.tsx`, `src/Button.stories.ts`, and a plain `src/Button.tsx`, **When** each is passed to `isStorybookFile`, **Then** the first three return `true` and the last returns `false`, unchanged.

---

### Edge Cases

- **Runtime module loading**: the project runs `.ts` sources directly via Node native type stripping (engine `^26.1.0`) with no build step; the migration must keep the module importable without introducing a compile/bundle stage. The runtime entrypoint (`index.js`) imports the module by its `.ts` specifier per the repo convention, so its `"./files.js"` specifier must be updated to resolve the renamed module.
- **`Dirent` `parentPath` and the removed `path` alias**: the JS walk read `e.parentPath ?? e.path`. Under `@types/node ^26.1.0` the deprecated `Dirent.path` alias has been **removed from the type** (it does not exist on `Dirent<string>`), so the `?? e.path` fallback cannot type-check. Because `parentPath` is always populated on Node ≥ 20, that fallback was dead code — never reached at runtime — so the migration reads `e.parentPath` alone. Verified output-identical by the unchanged demo-app violation set. This is the one non-erasure line the migration changes, and it is a behavior-preserving simplification, not a behavior change.
- **No dedicated unit test today**: this module currently has no `files.test.ts`; its behavior is exercised end-to-end by `pnpm lint:demo` through the CLI entrypoint. Behavior parity is therefore verified by the unchanged demo-app violation set (and `pnpm typecheck`), not by a module-level unit suite. Adding a focused unit test is permitted but not required, and must not change observable discovery behavior.
- **Behavior-preserving refactor only**: any structural cleanup done alongside the migration (renaming a local, re-sectioning, a comment tidy) must not change any observable output; it is bounded by the same before/after demo-app parity as the migration itself.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The file-discovery layer MUST be authored in TypeScript, replacing the existing JavaScript module, at a `.ts` path.
- **FR-002**: The migrated module MUST preserve its public surface exactly — the exported functions `getAllFiles` and `isStorybookFile`, each with its current name and call signature — so the CLI entrypoint keeps working unchanged.
- **FR-003**: Every import site that references the module (currently only `lint-color/index.js`) MUST continue to resolve to the migrated module after the extension change, with no other loader or build configuration required to run the linter.
- **FR-004**: The module's parameters, local values, and return values MUST carry types — `getAllFiles(dir: string, ...exts: string[]): string[]`, `isStorybookFile(filePath: string): boolean`, and the `Dirent` records the walk filters and maps. Any explicit `any` MUST carry an inline justification. `pnpm typecheck` MUST pass with zero errors.
- **FR-005**: The recursive walk (`getAllFiles`) MUST produce the same list (including order) for every input as today: a `readdirSync(dir, { recursive: true, withFileTypes: true })` walk, filtering to files whose `extname` is in the rest-arg extension set, and mapping each to its `parentPath`-joined full path. The JS `?? path` fallback is dropped (the deprecated `Dirent.path` alias is gone from `@types/node ^26.1.0` and, since `parentPath` is always populated, was never reached) — this is a behavior-preserving simplification with byte-identical output, not a behavior change.
- **FR-006**: The Storybook predicate (`isStorybookFile`) MUST be preserved exactly: it returns `true` when the path contains a `/stories/` segment, ends with `.stories.tsx`, or ends with `.stories.ts`, and `false` otherwise.
- **FR-007**: The demo-app violation set (`pnpm lint:demo`) MUST be unchanged (zero net delta) after the migration.
- **FR-008**: The change MUST be scoped to this one module (plus the minimal import-site edit in FR-003). Migrating sibling modules or altering discovery logic is out of scope. Any refactoring is behavior-preserving.

### Key Entities *(include if feature involves data)*

- **Discovered file list**: the `string[]` `getAllFiles` returns — the full set of source paths the linter will read, each an `extname`-matched, `parentPath`-joined absolute-ish path. Its runtime values (and order) must be identical before and after.
- **Directory entry (`Dirent`)**: the `withFileTypes` record the walk filters (`isFile()`) and maps (`extname(name)`, `parentPath`); its type is `Dirent<string>` from `@types/node ^26.1.0`, inferred from `readdirSync` with no cast and no `any`. The deprecated `path` alias no longer exists on this type, so the migration reads `parentPath` alone.
- **Extension set**: the `Set<string>` built from the rest-arg extensions, matched against each entry's `extname` — a caller passing no extensions matches nothing, exactly as today.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The file-discovery layer source is a TypeScript module; zero JavaScript source remains for this module.
- **SC-002**: `pnpm typecheck` passes with zero errors, with the module's own body now within type coverage.
- **SC-003**: The demo-app fixture (`pnpm lint:demo`) produces an identical set of violations — files scanned, classes, messages, and counts across all rules — before and after the change (zero net delta).
- **SC-004**: The linter runs end-to-end via its normal entrypoint (`node lint-color/index.js`) with no new build, bundling, or loader step introduced by the change.
- **SC-005**: The migrated module introduces zero unjustified `any`; every `any` (if any) carries an inline rationale.

## Assumptions

- The project runs TypeScript source directly (Node engine `^26.1.0` native type stripping, `tsconfig` `noEmit`); the migrated `.ts` module can be imported and executed without adding a compile or bundle step, and the runtime importer references it by its `.ts` specifier per the repo's established convention (`ansi.ts`, `no-spectral-color.ts`).
- This module has no dedicated unit test today; its behavior is verified end-to-end by the unchanged demo-app violation set and by `pnpm typecheck`. Adding a focused unit test is optional and out of the migration's required scope.
- The sole importer (`lint-color/index.js`) remains JavaScript and is out of scope beyond its one import-specifier edit; the migration must keep its runtime call working via unchanged export signatures.
- This is a language migration with behavior-preserving refactoring, not a behavior change: no new discovery behavior, no new configuration surface, and no change to which files are scanned or excluded.
- The module's existing design — the recursive `withFileTypes` walk, the `extname` extension filter, the `parentPath ?? path` join, and the three Storybook exclusion conditions — is retained as-is; this change types and tidies it, it does not redesign it.
