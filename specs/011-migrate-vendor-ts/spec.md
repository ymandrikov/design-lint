# Feature Specification: Refactor and migrate the vendored Tailwind parsing primitives (`lint-color/vendor/**`) from JavaScript to TypeScript

**Feature Branch**: `ym/explore`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Migrate lint-color/vendor/** from JS to TS."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The vendored parsing primitives are type-checked at their own contract (Priority: P1)

A linter maintainer opens any module under `lint-color/vendor/` and finds it written in
TypeScript. The four still-JavaScript vendored primitives — `is-color`, `segment`,
`is-valid-arbitrary`, and `decode-arbitrary-value` — now carry parameter and return types the
compiler enforces. Each exported function (`isColor(value)` / `isNamedColor(value)`,
`segment(input, separator)`, `isValidArbitrary(input)`, `decodeArbitraryValue(input)`) and each
internal helper (`convertUnderscoresToWhitespace`, `recursivelyDecodeArbitraryValues`) is typed,
restoring the annotations the vendoring step deliberately dropped. Because the upstream
Tailwind sources these files were ported from are themselves TypeScript, re-adding the types
moves the vendored copies *back toward* their upstream shape rather than away from it.
`pnpm typecheck` now covers the bodies of these primitives, not just their callers.

**Why this priority**: This is the whole point of the change. `lint-color/vendor/` is the last
untyped source surface in the linter — every rule module, the classifier, the linter factory,
and the CLI entrypoint have already been migrated to TypeScript. The constitution names
TypeScript types "the primary contract"; these four primitives are the sole remaining
JavaScript. Making each function's `input`/`value`/`separator` parameters and its boolean or
string return explicit is the value delivered; everything else is preservation.

**Independent Test**: Confirm each of the four modules now lives at a `.ts` path, `pnpm
typecheck` passes with zero errors, and every exported function and internal helper carries
types (no implicit `any` on parameters or returns; any explicit `any` carries an inline
justification). Run the full existing vendor test suite and confirm every case passes with no
assertion changes.

**Acceptance Scenarios**:

1. **Given** the four migrated vendor modules, **When** `pnpm typecheck` runs, **Then** it reports zero errors and each function's parameters and return values are typed.
2. **Given** the four existing vendor test files (`is-color.test.ts`, `segment.test.ts`, `is-valid-arbitrary.test.ts`, `decode-arbitrary-value.test.ts`), **When** they run against the migrated modules, **Then** every case passes unchanged.
3. **Given** each vendor module, **When** inspected after migration, **Then** its exported function names and call signatures are unchanged.

---

### User Story 2 - The classifier and CSS-color rule still import the primitives (Priority: P1)

The linter runs exactly as before because every consumer of the vendored primitives still
resolves. The classifier (`classify.ts`) imports all four primitives (`segment`,
`isValidArbitrary`, `decodeArbitraryValue`, `isColor`); the `no-raw-css-color` rule imports
`isColor`. After the rename, each import specifier resolves to the migrated `.ts` module and
the classifier produces the same verdicts — same arbitrary-value decoding, same
top-level segmentation, same literal-color detection — as it did when the primitives were
JavaScript.

**Why this priority**: A primitive the classifier can no longer import breaks color
classification at startup, regardless of how clean its types are. The five import sites
(`classify.ts` × 4, `no-raw-css-color.ts` × 1) are part of the contract, not an afterthought.
Per the repo convention (e.g. `classify.ts` imported as `"../classify.ts"`, the migrated rules
imported by their `.ts` specifier), each migrated primitive is imported by its `.ts` specifier.

**Independent Test**: Run `pnpm lint:demo` over the demo-app fixture before and after the
migration and confirm the full violation set — classes, messages, and counts — is
byte-for-byte identical, proving the classifier's use of the primitives is unchanged.

**Acceptance Scenarios**:

1. **Given** the four imports in `classify.ts` and the one in `no-raw-css-color.ts`, **When** the primitives are migrated and each specifier updated to `.ts`, **Then** every import resolves and each function is usable with the same signature.
2. **Given** the demo-app fixture, **When** the linter runs after migration, **Then** the complete set of violations (classes, messages, counts) is identical to the pre-migration run.
3. **Given** the CLI entrypoint `node lint-color/index.ts`, **When** it loads the classifier (which loads the migrated primitives) with no build or bundle step, **Then** the linter resolves and runs exactly as before.

---

### User Story 3 - Each primitive's parsing behavior is preserved exactly (Priority: P2)

A design-system maintainer sees no change in what the linter detects because every primitive's
observable behavior is unchanged: `isColor` still treats a leading `#`, a color-function root,
or a CSS named color as a color (and `isNamedColor` still matches only named colors);
`segment` still splits on a top-level separator while respecting parens/brackets/braces and
quotes; `isValidArbitrary` still rejects unbalanced brackets and a top-level `;`; and
`decodeArbitraryValue` still converts underscores to whitespace with the same `url()` /
`var()` / `theme()` first-argument exceptions, built on `postcss-value-parser`. Every function
returns identical results for every input.

**Why this priority**: Preserving observable behavior is the contract of a language migration.
It is P2 only because Stories 1 and 2 already assert typing and loading; this story pins each
primitive's specific parsing surface, which the per-file `*.test.ts` fixtures already lock
down.

**Acceptance Scenarios**:

1. **Given** each vendor file's existing `*.test.ts` suite, **When** it runs against the migrated module, **Then** every result is identical to today's — no assertion or fixture edits.
2. **Given** `decodeArbitraryValue`'s `url()` / `var()` / `theme()` first-argument exceptions and its intentional omission of the upstream math-operator-spacing pass, **When** called after migration, **Then** it returns identical output for every input.
3. **Given** the shared-buffer performance optimizations in `segment` and `isValidArbitrary` (the module-level `Uint8Array` stack) and the character-code branching, **When** exercised after migration, **Then** behavior is unchanged.
4. **Given** any structural cleanup done alongside the migration (renaming a local, re-typing a helper), **When** the suite and demo-app fixture run, **Then** every observable output is unchanged.

---

### Edge Cases

- **Runtime module loading**: the project runs `.ts` sources directly via Node native type stripping (engine `^26.1.0`) with no build step; the migration must keep each primitive importable without introducing a compile/bundle stage. The classifier (`classify.ts`) and the `no-raw-css-color` rule reference the migrated primitives by their `.ts` specifier per the repo convention, so each `"./vendor/<name>.js"` / `"../vendor/is-color.js"` specifier must be updated to `.ts`.
- **Test-file import resolution**: the test runner resolves a `.js` specifier to the sibling `.ts` file (established in the codebase — migrated modules import `.js` specifiers against `.ts`-only modules and pass), so a vendor test importing `"./<name>.js"` keeps resolving after the rename. Test import specifiers may be updated to `.ts` for consistency, but no test assertion or logic changes.
- **`decode-arbitrary-value` node types**: this primitive was reimplemented on `postcss-value-parser` (not Tailwind's private value-parser), so its AST-node types (`type`/`div`/`space`/`word`/`string`/`function`, each with `value` and `nodes`) come from `postcss-value-parser`'s own type declarations, not from upstream Tailwind. The migration types `recursivelyDecodeArbitraryValues`'s node walk against the parser's node shape. If `postcss-value-parser` does not ship usable node types for the mutation the walk performs, a small self-contained local type declaration (or a justified `any`) is used, matching how other migrated modules type third-party boundaries.
- **`skipUnderscoreToSpace` default parameter**: `convertUnderscoresToWhitespace(input, skipUnderscoreToSpace = false)` has a defaulted second parameter; its type must be inferred or annotated so both call forms (one-arg and two-arg) keep type-checking.
- **Vendored-parity contract**: each file carries a header citing its upstream Tailwind source, commit, and the ADR 0002 vendoring decision. The migration re-adds types the header says were "dropped"; the header MUST be updated to reflect that the file is once again TypeScript (the "converted to plain JS (type annotations dropped)" note no longer describes the file), while preserving the source/commit/ADR citation and the `decode-arbitrary-value` divergence note. No upstream logic is re-synced as part of this change.
- **No new dependency**: `decode-arbitrary-value` already imports `postcss-value-parser` (an existing dependency); typing its nodes must not add a new package. If parser types are needed, they come from the already-installed package's bundled declarations.
- **Behavior-preserving refactor only**: any structural cleanup done alongside the migration must not change any observable output; it is bounded by the same before/after fixture and test parity as the migration itself.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All four still-JavaScript vendored modules — `is-color`, `segment`, `is-valid-arbitrary`, and `decode-arbitrary-value` — MUST be authored in TypeScript, each replacing its existing JavaScript file at a `.ts` path under `lint-color/vendor/`. No JavaScript source remains under `lint-color/vendor/`.
- **FR-002**: Each migrated primitive MUST preserve its public surface exactly — every exported function (`isColor`, `isNamedColor`, `segment`, `isValidArbitrary`, `decodeArbitraryValue`) keeps its current name, arity, and call signature — so the classifier, the `no-raw-css-color` rule, and the vendor tests keep working unchanged.
- **FR-003**: Every import site that references a migrated primitive MUST continue to resolve after the extension change: the four imports in `lint-color/classify.ts` (`segment`, `isValidArbitrary`, `decodeArbitraryValue`, `isColor`) and the one in `lint-color/rules/no-raw-css-color.ts` (`isColor`). Each specifier MUST be updated to the migrated `.ts` path, with no other loader or build configuration required to run the linter.
- **FR-004**: Each primitive's parameters, local helpers, and return values MUST carry types. `isColor`/`isNamedColor` take `string` and return `boolean`; `segment(input: string, separator: string)` returns `string[]`; `isValidArbitrary(input: string)` returns `boolean`; `decodeArbitraryValue(input: string)` returns `string`; the internal helpers (`convertUnderscoresToWhitespace`, `recursivelyDecodeArbitraryValues`) are typed against their inputs. Any explicit `any` MUST carry an inline justification. `pnpm typecheck` MUST pass with zero errors.
- **FR-005**: `is-color` MUST be preserved exactly: `isColor` still returns true for a leading `#` (charcode `0x23`), a value matching the color-function regex, or a lowercase-matched CSS named color; `isNamedColor` still matches only the named-color set. The `NAMED_COLORS` set and `IS_COLOR_FN` regex are unchanged.
- **FR-006**: `segment` MUST be preserved exactly: its top-level split on a separator character, its state machine over parens/brackets/braces, its quote and backslash handling, and its shared `Uint8Array` bracket stack all behave identically.
- **FR-007**: `is-valid-arbitrary` MUST be preserved exactly: it still rejects unbalanced closing brackets and a top-level `;`, still ignores `{` for stack purposes, and still handles quotes and backslashes identically, using its shared `Uint8Array` stack.
- **FR-008**: `decode-arbitrary-value` MUST be preserved exactly: its early-bail on inputs with no `(`, its `postcss-value-parser`-based recursive decode, the `url()` / `var()` / `theme()` first-argument exceptions, the escaped-underscore handling in `convertUnderscoresToWhitespace`, and the intentional omission of the upstream math-operator-spacing pass are all unchanged. Types for the parser nodes come from `postcss-value-parser`; no new dependency is introduced.
- **FR-009**: Each migrated file's vendoring header MUST be updated so it no longer claims the file is "plain JS (type annotations dropped)", while preserving the upstream source path, commit hash, the ADR 0002 citation, and (for `decode-arbitrary-value`) the divergence-from-upstream note.
- **FR-010**: All four existing vendor tests MUST pass without modification to their assertions or logic, and the demo-app violation set (`pnpm lint:demo`) MUST be unchanged (zero net delta), confirming the classifier's use of the primitives is preserved.
- **FR-011**: The change MUST be scoped to these four vendor modules (plus the minimal import-site edits in FR-003 and any mechanical test-specifier updates). Migrating or altering `classify.ts`, `no-raw-css-color.ts` (beyond its one import specifier), any already-migrated module, or the `postcss-value-parser` dependency, or changing any primitive's parsing logic, is out of scope. Any refactoring is behavior-preserving.

### Key Entities *(include if feature involves data)*

- **Vendored primitive**: the unit being migrated — a self-contained module ported from a Tailwind CSS source file, exporting one or more pure functions with no cross-vendor imports. Four such modules are in scope (`is-color`, `segment`, `is-valid-arbitrary`, `decode-arbitrary-value`).
- **Exported function**: the primitive's public entrypoint the classifier and rules call — `isColor`/`isNamedColor` (string → boolean), `segment` (string, string → string[]), `isValidArbitrary` (string → boolean), `decodeArbitraryValue` (string → string) — whose name, arity, and return type must be preserved so callers keep type-checking.
- **Parser node**: the `postcss-value-parser` AST node (`{ type, value, nodes? }`) that `decodeArbitraryValue`'s recursive walk reads and mutates; typed from the parser's own declarations, consumed as an input shape, not redefined by this change.
- **Vendoring header**: the block comment atop each file citing upstream source, commit, changes, and ADR 0002; updated to reflect the file's return to TypeScript while preserving its provenance citation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four vendor modules are TypeScript sources; zero JavaScript source remains under `lint-color/vendor/`.
- **SC-002**: `pnpm typecheck` passes with zero errors, with each migrated primitive's own body now within type coverage.
- **SC-003**: 100% of the four existing vendor test files pass with zero edits to their assertions or logic.
- **SC-004**: The demo-app fixture (`pnpm lint:demo`) produces an identical set of violations — classes, messages, and counts — before and after the change (zero net delta).
- **SC-005**: The linter runs end-to-end via its normal entrypoint (`node lint-color/index.ts`) with no new build, bundling, or loader step introduced by the change.
- **SC-006**: The migrated primitives introduce zero unjustified `any`; every `any` (if any) carries an inline rationale, and the parser-node types in `decode-arbitrary-value` come from the already-installed `postcss-value-parser` with no new dependency added.

## Assumptions

- The project runs TypeScript source directly (Node engine `^26.1.0` native type stripping, `tsconfig` `noEmit`); each migrated `.ts` primitive can be imported and executed without adding a compile or bundle step, and importers reference it by its `.ts` specifier per the repo's established convention.
- The test runner resolves a `.js` import specifier to the sibling `.ts` module (as it already does across the migrated codebase), so the four vendor test files keep resolving whether or not their specifiers are updated; any specifier update to a test is mechanical and touches no assertion.
- `postcss-value-parser` is an existing dependency and ships (or bundles) type declarations sufficient to type `decodeArbitraryValue`'s node walk; if a gap remains, a small self-contained local node type (or a justified `any`) is used rather than adding a new dependency.
- Once `tsconfig`'s `allowJs` no longer has any JavaScript source to cover under `lint-color/`, the migration does not depend on `allowJs` being removed; toggling `allowJs`/`checkJs` is out of scope for this change.
- `classify.ts`, `no-raw-css-color.ts`, and all already-migrated modules remain as-is and out of scope (except the FR-003 import-specifier edits); the migration types how the primitives are authored and preserves their behavior.
- This is a language migration with behavior-preserving refactoring, not a behavior change: no re-sync with newer upstream Tailwind, no new parsing behavior, and no change to any function's results beyond what existing tests already assert.
- The vendored-parity intent (ADR 0002) is retained: the files remain faithful ports of their cited upstream sources; re-adding types brings them closer to the upstream TypeScript originals, and the provenance headers are preserved (only the "dropped to plain JS" wording is corrected).
