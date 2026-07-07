# Feature Specification: Migrate `no-spectral-color` rule from JavaScript to TypeScript

**Feature Branch**: `ym/explore`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "I want to migrate lint-color/rules/no-spectral-color.js from JS to TS"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The rule is type-checked at its own contract (Priority: P1)

A rule author opens `no-spectral-color` and finds it written in TypeScript. The token
shape, the classification verdict it consumes, the rule context (`tokens`, `ansi`,
`ruleConfig`), and the `checkToken` return type are all expressed as types the compiler
enforces, rather than left implicit. `pnpm typecheck` now covers the rule's own body,
not just its callers and its tests.

**Why this priority**: This is the whole point of the migration. The constitution names
TypeScript types as "the primary contract," and this rule is one of the last color-rule
source modules still authored in untyped JavaScript. Making its contract explicit is the
value delivered; everything else is preservation.

**Independent Test**: Confirm the rule now lives at a `.ts` path, `pnpm typecheck` passes
with zero errors, and the rule's exported members and helpers carry types (no implicit
`any` on parameters or returns). Run the existing rule test suite and confirm every case
passes with no assertion changes.

**Acceptance Scenarios**:

1. **Given** the migrated rule module, **When** `pnpm typecheck` runs, **Then** it reports zero errors and the rule's own parameters and return values are typed.
2. **Given** the full existing `no-spectral-color` test suite, **When** it runs against the migrated rule, **Then** every test passes unchanged.
3. **Given** the rule's exported public members (`id`, `name`, `checkToken`), **When** inspected after migration, **Then** their names, values, and call signature are unchanged.

---

### User Story 2 - The linter still loads and runs the rule (Priority: P1)

An app developer runs the linter (`node lint-color/index.js` / `pnpm lint:demo`) exactly
as before. The linter loads the migrated rule, runs it over source, and produces the same
spectral-color violations — same classes flagged, same messages, same replacement hints,
same suppression behavior — as it did when the rule was JavaScript.

**Why this priority**: A rule the runtime can no longer import is a regression regardless
of how clean its types are. The rule is consumed by static imports in both `index.js` and
`linter.js`; those import sites and the runtime's ability to load a TypeScript module are
part of the migration's contract, not an afterthought.

**Independent Test**: Run `pnpm lint:demo` over the demo-app fixture before and after the
migration and confirm the spectral-color violation set — classes, messages, and counts —
is byte-for-byte identical.

**Acceptance Scenarios**:

1. **Given** the linter entrypoint and the linter factory, **When** they import the migrated rule, **Then** the import resolves and the rule object exposes the same members the pipeline expects.
2. **Given** the demo-app fixture, **When** the linter runs after migration, **Then** the set of spectral-color violations (classes, messages, counts) is identical to the pre-migration run.
3. **Given** a spectral class carrying a `color-lint-ignore` directive, **When** linted after migration, **Then** it is still suppressed and counted exactly as before.

---

### User Story 3 - Behavior and message wording are preserved exactly (Priority: P2)

A design-system maintainer sees no change in what the rule reports: spectral classes behind
any color prefix (including compound prefixes and multi-segment bases) are flagged; configured
replacement ranges still produce the "try `<prefix>-<token>`" hint; classes with no matching
replacement entry are still flagged with no hint; palette names without a shade and non-color
utilities sharing a color prefix are still allowed. Coloring (`ansi`) and message structure
are unchanged.

**Why this priority**: Preserving observable behavior is the contract of a language migration.
It is P2 only because Stories 1 and 2 already assert typing and loading; this story pins the
remaining message-content and boundary cases.

**Independent Test**: Lint the sample cases exercised by the test suite and confirm each
message string is identical to the pre-migration output.

**Acceptance Scenarios**:

1. **Given** a replacement entry whose range covers a flagged class's shade, **When** the class is flagged, **Then** the message names the mapped semantic utility in the same wording and coloring as before.
2. **Given** a spectral class whose prefix has no replacement entry, **When** it is flagged, **Then** the message contains the offending class and no hint, unchanged.
3. **Given** `text-red` (name, no shade) or `text-sm` (non-color utility sharing a color prefix), **When** linted, **Then** no violation is reported.

---

### Edge Cases

- **Runtime module loading**: the project runs `.ts` sources directly with no build step; the migration must keep the rule importable by the linter without introducing a compile/bundle stage. Import specifiers that reference the rule by its old extension must be updated to resolve the new one.
- **Typing the shared classifier boundary**: `checkToken` consumes results from the shared classifier and the token structure. Where the shared modules are still untyped JavaScript, the rule must express its expected shapes without forcing a broader migration of those modules.
- **No new `any`**: if a value crossing the JS↔TS boundary cannot be typed precisely, an `any` requires an inline justification (per constitution); silent `any` is not acceptable.
- **Replacement-map parsing**: the range/single-shade parsing helper (`findReplacement`) must keep identical behavior once typed, including the `"lo...hi"` range and single-shade branches and the "no entry" / "out of range" paths returning no hint.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `no-spectral-color` rule MUST be authored in TypeScript, replacing the existing JavaScript module, at a `.ts` path.
- **FR-002**: The migrated module MUST preserve the rule's public surface exactly — the exported `id` (numeric), `name` (`"no-spectral-color"`), and the `checkToken(rawTok, parts, ctx)` call signature — so the linter pipeline and any configuration keep working unchanged.
- **FR-003**: Every import site that references the rule (currently `lint-color/index.js` and `lint-color/linter.js`) MUST continue to resolve to the migrated module after the extension change, with no other loader or build configuration required to run the linter.
- **FR-004**: The rule's parameters, local helpers, and return values MUST carry types; any `any` MUST carry an inline justification. `pnpm typecheck` MUST pass with zero errors.
- **FR-005**: The rule MUST continue to fire when, and only when, the shared classifier returns the `spectral` verdict for the token, delegating the spectral decision to the classifier exactly as it does today (no reintroduced private palette scan).
- **FR-006**: The replacement-hint logic MUST be preserved: append the mapped semantic token when a class's prefix, palette name, and shade match a configured replacement entry (single shade or range), and omit the hint when the prefix has no entry or the shade is outside every configured range — while still reporting the violation.
- **FR-007**: The violation message text, coloring, and structure MUST NOT change for any case already covered by the test suite.
- **FR-008**: All existing `no-spectral-color` tests MUST pass without modification, and the demo-app spectral-violation set MUST be unchanged (zero net delta).
- **FR-009**: The migration MUST be scoped to this one rule module (plus the minimal import-site edits in FR-003). Migrating sibling rules or shared modules is out of scope.

### Key Entities *(include if feature involves data)*

- **Rule module contract**: the shape the linter pipeline depends on — `id`, `name`, and `checkToken` — that must be identical before and after migration.
- **Rule context (`ctx`)**: the object passed to `checkToken`, carrying `tokens` (including the classifier's spectral data), `ansi` (color helpers), and `ruleConfig` (including the optional `replacement` map). The migration must type the fields the rule actually reads.
- **Replacement map**: the configured `prefix → [{ "name-shadeOrRange": semanticToken }]` structure the hint logic parses; its shape must be expressible as a type without changing its runtime behavior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The `no-spectral-color` rule source is a TypeScript module; zero JavaScript source remains for this rule.
- **SC-002**: `pnpm typecheck` passes with zero errors, with the rule's own body now within type coverage.
- **SC-003**: 100% of the existing `no-spectral-color` test cases pass with zero edits to the test file.
- **SC-004**: The demo-app fixture (`pnpm lint:demo`) produces an identical set of spectral-color violations — classes, messages, and counts — before and after the migration (zero net delta).
- **SC-005**: The linter runs end-to-end via its normal entrypoint with no new build, bundling, or loader step introduced by the migration.
- **SC-006**: The migrated module introduces zero unjustified `any`; every `any` (if any) carries an inline rationale.

## Assumptions

- The project runs TypeScript source directly (Node engine `^26.1.0` native type stripping); a single migrated `.ts` rule can be imported and executed without adding a compile or bundle step. Import specifiers referencing the rule are updated to resolve the new module.
- This is the first color-rule source module migrated to TypeScript; sibling rules remain JavaScript and are explicitly out of scope for this feature.
- The shared modules the rule imports (the classifier and shared helpers) remain JavaScript; the rule expresses the shapes it consumes at its own boundary without requiring those modules to be migrated first.
- This is a language migration, not a behavior change: no new detections, no new configuration surface, and no message-wording changes beyond what existing tests already assert.
- The rule's current delegation to the shared classifier (the already-completed refactor) is retained as-is; this migration does not alter the rule's detection logic.
