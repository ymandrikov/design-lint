# Feature Specification: Migrate `lint-color/ansi.js` from JavaScript to TypeScript

**Feature Branch**: `ym/explore`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Migrate lint-color/ansi.js from JS to TS"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The terminal-styling module is type-checked at its own contract (Priority: P1)

A maintainer opens `ansi` and finds it written in TypeScript. The TTY guard and each
styling helper (`red`, `blue`, `dim`, `bold`) declare that they take a string and return
a string, and the TTY flag declares its boolean shape. `pnpm typecheck` now covers the
module's own body, not just the call sites that consume it.

**Why this priority**: This is the whole point of the migration. The constitution names
TypeScript types as "the primary contract," and this is one of the remaining source
modules in `lint-color/` still authored in untyped JavaScript. Making its contract
explicit is the value delivered; everything else is preservation.

**Independent Test**: Confirm the module now lives at a `.ts` path, `pnpm typecheck`
passes with zero errors, and every exported member carries a type (no implicit `any` on
any helper's parameter or return).

**Acceptance Scenarios**:

1. **Given** the migrated module, **When** `pnpm typecheck` runs, **Then** it reports zero errors and each styling helper's parameter and return value is typed as a string.
2. **Given** the module's exported public surface (`isTTY`, `red`, `blue`, `dim`, `bold`), **When** inspected after migration, **Then** the exported names, arities, and call signatures are unchanged.

---

### User Story 2 - The linter still loads and colorizes its output identically (Priority: P1)

An app developer runs the linter (`node lint-color/index.js` / `pnpm lint:demo`) exactly
as before. The entrypoint imports the migrated module, and the linter's terminal output —
which classes are colored red, which hints are colored blue, which text is dimmed or bold
— is byte-for-byte identical to the pre-migration output for the same input.

**Why this priority**: A module the runtime can no longer import is a regression regardless
of how clean its types are. The module is consumed by a static import in `index.js`; that
import site and the runtime's ability to load a TypeScript module are part of the
migration's contract, not an afterthought.

**Independent Test**: Run `pnpm lint:demo` over the demo-app fixture before and after the
migration, in the same terminal (TTY) context, and confirm the emitted output — including
every ANSI escape sequence — is identical.

**Acceptance Scenarios**:

1. **Given** the linter entrypoint, **When** it imports the migrated module, **Then** the import resolves and every symbol the entrypoint uses (`bold`, `dim`, `red`) is available with an unchanged signature.
2. **Given** the demo-app fixture linted in a TTY, **When** the linter runs after migration, **Then** the produced output including all ANSI escape sequences is identical to the pre-migration run.

---

### User Story 3 - TTY gating behavior is preserved exactly (Priority: P2)

A user piping the linter's output to a file or another process (no TTY) still gets plain,
un-escaped text, while the same run in an interactive terminal still gets colored text.
The decision to emit escape codes is gated on the same TTY signal as before, and the exact
escape sequences (`\x1b[31m…\x1b[0m` for red, and so on) are unchanged.

**Why this priority**: Preserving observable behavior is the contract of a language
migration. It is P2 only because Stories 1 and 2 already assert typing and loading; this
story pins the remaining on/off boundary and the literal escape codes.

**Independent Test**: Invoke each helper with the TTY signal on and off and confirm that
"on" yields the exact wrapping escape sequence and "off" yields the input string verbatim,
unchanged from the JavaScript module.

**Acceptance Scenarios**:

1. **Given** a non-TTY context, **When** any styling helper is called, **Then** it returns its input string unchanged, with no escape sequences added.
2. **Given** a TTY context, **When** each styling helper is called, **Then** it wraps the input in the same escape sequence the JavaScript module produced (red `31`, blue `34`, dim `2`, bold `1`).

---

### Edge Cases

- **Runtime module loading**: the project runs `.ts` sources directly with no build step; the migration must keep the module importable without introducing a compile/bundle stage. The one import specifier that references the module by its old `.js` extension must be updated to resolve the new `.ts` file.
- **TTY signal captured at module load**: the current module reads the TTY flag once at load time into an exported constant. The migration must preserve when the signal is read and the fact that it is exported, so any consumer reading it observes the same value at the same time.
- **Full public surface, not just what is imported today**: the current single importer uses only `red`, `dim`, and `bold`; `blue` and `isTTY` are exported but not imported there. The migration must preserve the complete export set, not narrow it to current usage.
- **No new `any`**: if a value cannot be typed precisely, an `any` requires an inline justification (per constitution); silent `any` is not acceptable. For this module, all helpers are string-to-string and require no `any`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `ansi` module MUST be authored in TypeScript, replacing the existing JavaScript module, at a `.ts` path; no JavaScript source for this module remains.
- **FR-002**: The migrated module MUST preserve its public surface exactly — the exported `isTTY` flag and the `red`, `blue`, `dim`, and `bold` string-to-string helpers — with unchanged names and call signatures, so every consumer keeps working unchanged.
- **FR-003**: The import site that references the module (currently `lint-color/index.js`) MUST continue to resolve to the migrated module after the extension change, with no other loader or build configuration required to run the linter.
- **FR-004**: Each helper's parameter and return value MUST be typed, and the `isTTY` export MUST carry its boolean shape; any `any` MUST carry an inline justification. `pnpm typecheck` MUST pass with zero errors.
- **FR-005**: The TTY gating MUST be preserved: each helper returns its input unchanged when the TTY signal is off and wraps it in the same literal escape sequence when the signal is on, reading the TTY signal at the same point (module load) as before.
- **FR-006**: The exact escape sequences MUST NOT change — red `\x1b[31m…\x1b[0m`, blue `\x1b[34m…\x1b[0m`, dim `\x1b[2m…\x1b[0m`, bold `\x1b[1m…\x1b[0m`.
- **FR-007**: The demo-app terminal output (`pnpm lint:demo`) MUST be unchanged (zero net delta) for the same input and TTY context after the migration.
- **FR-008**: The migration MUST be scoped to this one module (plus the minimal import-site edit in FR-003). Migrating sibling modules or consolidating the duplicated inline `blue`/TTY logic elsewhere in the codebase is out of scope.

### Key Entities *(include if feature involves data)*

- **Styling helper**: a string-to-string function (`red`, `blue`, `dim`, `bold`) that conditionally wraps its input in an ANSI escape sequence. Its call signature and escape output must be identical before and after migration.
- **TTY flag (`isTTY`)**: the exported boolean, read once at module load, that gates whether the helpers emit escape codes. Its name, type, export, and read timing must be preserved.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The `ansi` module source is a TypeScript module; zero JavaScript source remains for this module.
- **SC-002**: `pnpm typecheck` passes with zero errors, with the module's own body now within type coverage.
- **SC-003**: The demo-app fixture (`pnpm lint:demo`) produces identical terminal output — every character and escape sequence — before and after the migration in the same TTY context (zero net delta).
- **SC-004**: The linter runs end-to-end via its normal entrypoint with no new build, bundling, or loader step introduced by the migration.
- **SC-005**: The migrated module introduces zero unjustified `any`; every `any` (if any) carries an inline rationale.
- **SC-006**: The module's public surface after migration exports the same five members (`isTTY`, `red`, `blue`, `dim`, `bold`) with unchanged signatures.

## Assumptions

- The project runs TypeScript source directly (Node engine `^26.1.0` native type stripping); a single migrated `.ts` module can be imported and executed without adding a compile or bundle step. The one import specifier referencing the module is updated to resolve the new `.ts` file.
- The module has no existing dedicated test file; its behavior is verified through `pnpm typecheck` and the demo-app output comparison rather than a new unit suite. Adding a test suite for it is out of scope.
- The only in-repo consumer is `lint-color/index.js`; the separate inline `blue`/TTY definitions that exist elsewhere in the codebase are left as-is and are not consolidated by this migration.
- This is a language migration, not a behavior change: no new helpers, no changed escape codes, no changed TTY-gating semantics.
