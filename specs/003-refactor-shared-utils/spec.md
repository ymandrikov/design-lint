# Feature Specification: Refactor lint-color/shared.js Junk-Drawer Module

**Feature Branch**: `003-refactor-shared-utils`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "I want to refactor lint-color/shared.js"

## Overview

`lint-color/shared.js` is a low-cohesion catch-all module. It currently bundles five
unrelated concerns behind one filename:

1. **Terminal styling** — `isTTY`, `red`, `blue`, `dim`, `bold` (consumed only by the CLI entry `index.js`).
2. **Rule-dispatch gates** — `buildDisabledRules`, `lintSourceIfEnabled`, `checkTokenIfEnabled`, `checkValueIfEnabled` (consumed only by `linter.js`).
3. **File discovery** — `getAllFiles`, `isStorybookFile` (consumed only by the CLI entry `index.js`).
4. **Test-only pipeline harness** — `runTokenRuleOnSource` (consumed only by rule `*.test.ts` files).
5. **Legacy pass-through re-exports** — `buildLineStarts`, `offsetToLine` (owned by `ast.js`) and `TAILWIND_SPECTRAL_COLORS`, `TAILWIND_COLOR_PREFIXES` (owned by `classify.js`), re-exported solely so old importers keep resolving.

This shape conflicts with the project's constitution: single-concern modules (Principle I),
prefer deleting indirection over preserving it, and keep the source navigable by the next
agent. The refactor regroups these utilities into single-concern homes and removes the
pass-through indirection — with **zero change** to linter behavior or output.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigate to a utility by its concern (Priority: P1)

A developer or agent needs terminal styling, file discovery, rule-dispatch, or the test
harness. They locate it by concern — the import path names what the utility *does* — instead
of discovering it inside a generic `shared.js` grab-bag.

**Why this priority**: The core value of the refactor. A junk-drawer module is the single
biggest navigability cost here; fixing it delivers the improvement on its own.

**Independent Test**: Search the codebase for any one concern (e.g. terminal color helpers)
and confirm it resolves to a single-concern module whose name/location matches that concern,
with no unrelated exports beside it.

**Acceptance Scenarios**:

1. **Given** the refactored code, **When** a reader opens the module that exports the terminal styling helpers, **Then** it contains only terminal-styling concerns and nothing about file discovery, rule dispatch, or the test harness.
2. **Given** the refactored code, **When** a reader opens the module that exports the rule-dispatch gates, **Then** it contains only rule-dispatch concerns.
3. **Given** the refactored code, **When** a reader looks for `runTokenRuleOnSource`, **Then** it lives in a location that marks it as test-support, not production runtime code.

### User Story 2 - Linter behavior is unchanged (Priority: P1)

A user runs the linter over the demo fixture and any real source before and after the
refactor. Output — violations, messages, counts, exit codes — is byte-for-byte identical.

**Why this priority**: A refactor that alters behavior is a regression, not a refactor. This
is the non-negotiable safety property (Constitution Principle II).

**Independent Test**: Run `pnpm test`, `pnpm typecheck`, and `pnpm lint:demo` before and
after; all pass and the demo output is identical.

**Acceptance Scenarios**:

1. **Given** the demo fixture, **When** the linter runs after the refactor, **Then** it emits exactly the same violations, messages, counts, and exit code as before.
2. **Given** the test suite, **When** it runs after the refactor, **Then** every test passes with no test's expectations modified to accommodate a behavior change.
3. **Given** the type checker, **When** it runs after the refactor, **Then** it reports zero errors.

### User Story 3 - No pass-through indirection remains (Priority: P2)

A reader following an import for `offsetToLine` or `TAILWIND_SPECTRAL_COLORS` arrives at the
module that actually owns the symbol (`ast.js`, `classify.js`), not at a re-export hop that
exists only for backward compatibility.

**Why this priority**: Removes a documented layer of indirection. Valuable for clarity but
secondary to eliminating the junk drawer itself; can be delivered independently.

**Independent Test**: Grep for imports of the previously re-exported symbols and confirm each
importer references the owning module directly, with no intermediate re-export file standing
in between.

**Acceptance Scenarios**:

1. **Given** the refactored code, **When** a symbol owned by `ast.js` or `classify.js` is imported anywhere, **Then** the import path is the owning module, not a shim.
2. **Given** the refactored code, **When** the codebase is searched for pass-through re-export comments (e.g. "re-exported here so existing importers keep working"), **Then** none remain.

### Edge Cases

- **A utility has exactly one consumer** (true for most exports here). The destination module MUST still be single-concern; co-locating a one-consumer helper with its sole caller is acceptable only when that caller's module remains single-concern.
- **A utility is test-only** (`runTokenRuleOnSource`). It MUST NOT sit in a module that production runtime code imports, so test-support code and shipped code stay separable.
- **An import path is referenced in more than one file** (e.g. `runTokenRuleOnSource` across seven rule tests). Every referencing file MUST be updated in the same change so no dangling import to the old path survives.
- **`shared.js` becomes empty after redistribution.** The now-empty module MUST be deleted rather than left as a stub, per "prefer deleting code."

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The five concerns currently in `shared.js` MUST each be relocated to a module whose scope is that single concern; no destination module may bundle two of these concerns together.
- **FR-002**: The refactor MUST NOT change any linter output — violations, messages, counts, exit codes, or suppression behavior — for any input.
- **FR-003**: Every importer of a moved symbol (production and test files) MUST be updated to import from the new location in the same change; no import may reference a removed or emptied path.
- **FR-004**: The legacy pass-through re-exports MUST be removed, and each importer of `buildLineStarts`, `offsetToLine`, `TAILWIND_SPECTRAL_COLORS`, and `TAILWIND_COLOR_PREFIXES` MUST import from the owning module (`ast.js` / `classify.js`) directly.
- **FR-005**: The test-only harness `runTokenRuleOnSource` MUST reside in a location distinct from shipped runtime modules, so test-support code is not importable as production code.
- **FR-006**: If `shared.js` holds no remaining exports after redistribution, it MUST be deleted; no empty or stub module may remain.
- **FR-007**: All quality gates MUST pass unchanged after the refactor: `pnpm typecheck` (zero errors), `pnpm test` (all green, no skipped/`.only`), and `pnpm lint:demo` (identical reviewed output).
- **FR-008**: No test's assertions may be weakened or rewritten to accommodate a behavior change; test edits are limited to updating import paths.
- **FR-009**: The change is internal-only and MUST NOT alter any public contract (CLI flags, config keys, rule names, exit codes, suppression syntax); therefore it requires no version bump or migration note.

### Key Entities

- **shared.js (current)**: The catch-all module under refactor. Holds five unrelated concerns plus four legacy re-exports.
- **Terminal styling helpers**: `isTTY`, `red`, `blue`, `dim`, `bold` — ANSI wrappers gated on TTY. Sole consumer: CLI entry `index.js`.
- **Rule-dispatch gates**: `buildDisabledRules`, `lintSourceIfEnabled`, `checkTokenIfEnabled`, `checkValueIfEnabled` — thin "run this rule if enabled" adapters. Sole consumer: `linter.js`.
- **File discovery helpers**: `getAllFiles`, `isStorybookFile` — filesystem walking / classification. Sole consumer: CLI entry `index.js`.
- **Test harness**: `runTokenRuleOnSource` — mirrors the production token-rule pipeline for unit tests. Consumers: rule `*.test.ts` files only.
- **Owning modules**: `ast.js` (owns `buildLineStarts`, `offsetToLine`) and `classify.js` (owns `TAILWIND_SPECTRAL_COLORS`, `TAILWIND_COLOR_PREFIXES`) — the true homes the re-exports currently shadow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: No single module in `lint-color/` bundles more than one of the five concerns that `shared.js` currently mixes.
- **SC-002**: Linter output over the demo fixture and the full test suite is identical before and after the change — 0 differences in violations, messages, counts, or exit codes.
- **SC-003**: `pnpm typecheck`, `pnpm test`, and `pnpm lint:demo` all pass after the change, with no test expectation altered for behavior.
- **SC-004**: 0 pass-through re-export shims remain; every previously re-exported symbol is imported from its owning module.
- **SC-005**: A reader can locate any of the five former-`shared.js` utilities from its import path alone, without opening a generically named module — verifiable by inspection of the new import paths.
- **SC-006**: 0 imports in the repository reference a removed or emptied path after the change.

## Assumptions

- **Full retirement over facade**: The intended end state is that `shared.js` no longer exists as a catch-all — its contents are redistributed and importers updated — rather than keeping `shared.js` as a thin facade. This best satisfies the constitution's "prefer deleting indirection" guidance. (Revisit in `/speckit-plan` if a facade is preferred for a staged migration.)
- **Behavior freeze**: This is a pure refactor. No new linter capability, rule, message, or config is added; the only observable change is internal module layout and import paths.
- **Single-context project**: Utilities are relocated within the existing `lint-color/` module tree; no new package or public export surface is introduced.
- **Test files count as importers**: Updating import paths in `*.test.ts` files is in scope and is not considered a behavior change.
- **Destination naming is a planning detail**: Exact new filenames/locations for each concern are decided in `/speckit-plan`; this spec fixes the outcome (single-concern homes, no indirection), not the file names.
