# Feature Specification: Refactor and migrate the color-rule modules (`lint-color/rules/**`) from JavaScript to TypeScript

**Feature Branch**: `ym/explore`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Refactor lint-color/rules/** files and migrate them from JS to TS."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every color rule is type-checked at its own contract (Priority: P1)

A rule author opens any rule under `lint-color/rules/` and finds it written in TypeScript.
The nine still-JavaScript rule modules — `no-style-color`, `no-raw-css-color`,
`no-opacity-modifier`, `token-constraints`, `no-var-color`, `no-dark-variant`,
`no-useless-hover`, `no-component-color-override`, and `no-undefined-token` — now carry
parameter and return types the compiler enforces. Each rule's check entrypoint
(`checkToken(rawTok, parts, ctx)`, `lintSource(source, filePath, ctx)`, or the
`no-raw-css-color` `findRawColor` / `checkValue` helpers) is typed against the shared runtime
contracts from `classify.ts` (`ColorParts`, `Tokens`, `ColorVerdict`) plus a small
self-contained local `ctx`/`Ansi` type per rule — mirroring the pattern the already-migrated
`no-spectral-color.ts` and the linter factory `linter.ts` already establish. `pnpm typecheck`
now covers the bodies of these rules, not just their callers.

**Why this priority**: This is the whole point of the change. The rule layer is where the
linter's decisions live — nine of the ten color rules were still authored in untyped
JavaScript while every module they depend on (`classify.ts`, `helpers.ts`, `linter.ts`,
`index.ts`, and the already-migrated `no-spectral-color.ts`) is TypeScript. The constitution
names TypeScript types "the primary contract"; these rules are the last untyped surface in
the color-rule pipeline. Making each rule's `rawTok`/`parts`/`ctx` inputs and its report
behavior explicit is the value delivered; everything else is preservation.

**Independent Test**: Confirm each of the nine modules now lives at a `.ts` path, `pnpm
typecheck` passes with zero errors, and every exported member and internal helper carries
types (no implicit `any` on parameters or returns; any explicit `any` carries an inline
justification). Run the full existing test suite and confirm every case passes with no
assertion changes.

**Acceptance Scenarios**:

1. **Given** the nine migrated rule modules, **When** `pnpm typecheck` runs, **Then** it reports zero errors and each rule's own parameters and return values are typed.
2. **Given** the full existing rule test suite (each rule's `*.test.ts`, plus `linter.test.ts`, `linter.lintCss.test.ts`, and `tests/e2e.test.ts`), **When** it runs against the migrated modules, **Then** every test passes unchanged.
3. **Given** each rule module, **When** inspected after migration, **Then** its exported `id`, `name`, and check-function names and call signatures are unchanged.

---

### User Story 2 - The linter still loads and runs every rule (Priority: P1)

An app developer runs the linter (`pnpm lint:demo` / `node lint-color/index.ts`) exactly as
before. The rule registry in `linter.ts` and `index.ts` resolves each rule via its
`import * as rule… from "./rules/<name>"` site, and the linter produces the same violations —
same classes flagged, same messages, same suppression counts — as it did when the rules were
JavaScript. The one cross-rule dependency (`no-component-color-override` importing
`findRawColor` from `no-raw-css-color`) keeps resolving.

**Why this priority**: A rule module the runtime can no longer import breaks the linter at
startup, regardless of how clean its types are. Each rule is loaded at two registry sites
(`linter.ts` and `index.ts`) plus, for `no-raw-css-color`, one sibling-rule site; those
import specifiers and the runtime's ability to load each TypeScript module are part of the
contract, not an afterthought. Per the repo convention (e.g. `no-spectral-color.ts` imported
as `"./rules/no-spectral-color.ts"`, `classify.ts` as `"../classify.ts"`), each migrated rule
is imported by its `.ts` specifier.

**Independent Test**: Run `pnpm lint:demo` over the demo-app fixture before and after the
migration and confirm the full violation set — classes, messages, and counts across all ten
rules — is byte-for-byte identical.

**Acceptance Scenarios**:

1. **Given** the rule registry in `linter.ts` and `index.ts` (each importing all ten rules via `import * as`), **When** the migrated rules are imported by their `.ts` specifiers, **Then** every import resolves and each rule's `id`, `name`, and check function are usable with the same signatures.
2. **Given** the demo-app fixture, **When** the linter runs after migration, **Then** the complete set of violations (classes, messages, counts) across all rules is identical to the pre-migration run.
3. **Given** the CLI entrypoint `node lint-color/index.ts`, **When** it loads the migrated rules with no build or bundle step, **Then** the linter resolves and runs exactly as before.
4. **Given** `no-component-color-override`'s import of `findRawColor` from `no-raw-css-color`, **When** both are migrated, **Then** the cross-rule import resolves by its `.ts` specifier and the override rule's raw-color detection is unchanged.

---

### User Story 3 - Each rule's detection behavior is preserved exactly (Priority: P2)

A design-system maintainer sees no change in what the linter detects because every rule's
observable behavior is unchanged: `no-style-color` and `no-component-color-override` still
walk JSX for their targeted attributes; `no-raw-css-color` still parses CSS values and flags
raw colors via the vendored `is-color`; `no-opacity-modifier` and `no-var-color` still branch
on the classifier verdict; `token-constraints` still matches its configured patterns;
`no-dark-variant`, `no-useless-hover`, and `no-undefined-token` still fire on exactly the
same tokens and elements as before. Every rule reports the same lines and messages.

**Why this priority**: Preserving observable behavior is the contract of a language
migration. It is P2 only because Stories 1 and 2 already assert typing and loading; this
story pins each rule's specific detection surface, which the per-rule test files
(`no-*.test.ts`) and the demo-app fixture already lock down.

**Acceptance Scenarios**:

1. **Given** each rule's existing `*.test.ts` suite, **When** it runs against the migrated module, **Then** every reported line and message is identical to today's — no assertion or fixture edits.
2. **Given** `no-raw-css-color`'s `findRawColor` and `checkValue` helpers (exercised directly by `no-raw-css-color.checkValue.test.ts` and reused by `no-component-color-override`), **When** called after migration, **Then** they return identical results for every input.
3. **Given** the JSX-walking rules (`no-style-color`, `no-useless-hover`, `no-component-color-override`), **When** run over the demo-app fixture, **Then** the interactive-element, style-attribute, and override detections are unchanged.
4. **Given** any structural cleanup done alongside the migration (renaming a local, re-sectioning, extracting or inlining a helper), **When** the suite and demo-app fixture run, **Then** every observable output is unchanged.

---

### Edge Cases

- **Runtime module loading**: the project runs `.ts` sources directly via Node native type stripping (engine `^26.1.0`) with no build step; the migration must keep each rule importable without introducing a compile/bundle stage. The rule registry (`index.ts`, `linter.ts`) and the one cross-rule importer (`no-component-color-override`) reference migrated rules by their `.ts` specifier per the repo convention, so each `"./rules/<name>.js"` / `"./no-raw-css-color.js"` specifier must be updated to `.ts`.
- **Test-file import resolution**: the test runner resolves a `.js` specifier to the sibling `.ts` file (established in the codebase — `no-spectral-color.test.ts` imports `"./no-spectral-color.js"` against a `.ts`-only module and passes), so a rule test importing `"./<name>.js"` keeps resolving after the rename. Test import specifiers may be updated to `.ts` for consistency, but no test assertion or logic changes.
- **Cross-rule dependency**: `no-component-color-override` imports `findRawColor` from `no-raw-css-color`. Both are in scope; whichever is migrated second must update its specifier so the pair resolves regardless of migration order within this change.
- **Where the shared types live**: the classifier's runtime contracts (`ColorParts`, `Tokens`, `ColorVerdict`) are exported from `classify.ts` and are imported by the migrated rules for the `parts`/`tokens` surfaces. The `ctx` and `Ansi`/`report` shapes are declared as small self-contained local types per rule, matching the established migrated-rule precedent (`no-spectral-color.ts`) and the linter factory (`linter.ts`) — both of which declare local ctx/`Ansi` types rather than importing them. `helpers.ts` is the test-harness module (its own header scopes it to rule *tests*) and stays out of scope: the runtime rules do not couple to it.
- **Rules that consume the classifier**: `no-raw-css-color`, `no-var-color`, `no-opacity-modifier`, and `no-component-color-override` import from `classify.ts` (`classifyParts`, `classifyColorPart`, `composeColorParts`). Those imports are already `.ts` and out of scope; the migration types how each rule calls them at its own boundary without altering `classify.ts`.
- **Vendored helpers**: `no-raw-css-color` uses `postcss-value-parser` and the vendored `is-color`. These stay as-is; the migration types the rule's calls into them and preserves the vendored parity citation.
- **`ctx` variance across rules**: different rules read different `ctx` fields (`tokens`, `ansi`, `ruleConfig`, `report`). The linter factory (`linter.ts`) deliberately types its dispatch `ctx` shapes *without* `ruleConfig` and matches rule methods bivariantly, so each rule may declare a narrow local `ctx` (with `ruleConfig?` optional, and `tokens` narrowed to the classifier's `Tokens` where it calls the classifier) and still satisfy dispatch — without a spurious `any`.
- **Behavior-preserving refactor only**: any structural cleanup done alongside the migration must not change any observable output; it is bounded by the same before/after fixture and test parity as the migration itself.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All nine still-JavaScript rule modules — `no-style-color`, `no-raw-css-color`, `no-opacity-modifier`, `token-constraints`, `no-var-color`, `no-dark-variant`, `no-useless-hover`, `no-component-color-override`, and `no-undefined-token` — MUST be authored in TypeScript, each replacing its existing JavaScript file at a `.ts` path. (`no-spectral-color` is already TypeScript and is out of scope.)
- **FR-002**: Each migrated rule MUST preserve its public surface exactly — its exported `id` (unchanged numeric value), `name` (unchanged string), and check entrypoint(s) (`checkToken`, `lintSource`, and for `no-raw-css-color` also `findRawColor` and `checkValue`), each with its current name and call signature — so the linter factory, the CLI entrypoint, the cross-rule importer, and the tests keep working unchanged.
- **FR-003**: Every import site that references a migrated rule MUST continue to resolve after the extension change: the registry in `lint-color/linter.ts` and `lint-color/index.ts` (each importing all ten rules via `import * as`), and the cross-rule import of `findRawColor` in `no-component-color-override`. Each specifier MUST be updated to the migrated `.ts` path, with no other loader or build configuration required to run the linter.
- **FR-004**: Each rule's parameters, local helpers, and return values MUST carry types. The `parts`/`tokens` surfaces MUST reuse the classifier's exported runtime contracts (`ColorParts`, `Tokens`, `ColorVerdict` from `classify.ts`) rather than re-declaring those shapes; the per-rule `ctx` and `Ansi`/`report` types are small self-contained local declarations following the established migrated-rule pattern (`no-spectral-color.ts`, `linter.ts`). Any explicit `any` MUST carry an inline justification. `pnpm typecheck` MUST pass with zero errors.
- **FR-005**: `no-style-color` MUST be preserved exactly: its JSX-source walk (`lintSource`) reports the same `style`-attribute color violations on the same lines with the same messages as before.
- **FR-006**: `no-raw-css-color` MUST be preserved exactly: `checkToken` still flags raw-color arbitrary values via `classifyParts`, `findRawColor` still detects a raw color inside a CSS value string via the vendored `is-color` + `postcss-value-parser`, and `checkValue` still returns the same result for every input (as locked by `no-raw-css-color.checkValue.test.ts`).
- **FR-007**: `no-opacity-modifier` and `no-var-color` MUST be preserved exactly: each still branches on the `classify.ts` verdict (`classifyColorPart` / `classifyParts`) and reports the same tokens with the same messages.
- **FR-008**: `token-constraints` MUST be preserved exactly: its `matchPattern` helper and `checkToken` still apply the configured pattern constraints and report the same violations.
- **FR-009**: `no-dark-variant` and `no-undefined-token` MUST be preserved exactly: each `checkToken` still fires on the same tokens (dark-variant usage; undefined-token references) with the same messages.
- **FR-010**: `no-useless-hover` MUST be preserved exactly: its interactive-element detection (the `INTERACTIVE_TAGS` / `TABLE_ROW_TAGS` / `INTERACTION_PROPS` / `INTERACTIVE_ROLES` sets, `attrStringValue`, `elementIsInteractive`, and `lintSource`) reports the same hover violations on the same elements.
- **FR-011**: `no-component-color-override` MUST be preserved exactly: its `isColorToken` helper and `lintSource` walk, including its reuse of `findRawColor` from `no-raw-css-color`, report the same override violations with the same messages.
- **FR-012**: All existing tests that exercise these rules MUST pass without modification to their assertions or logic, and the demo-app violation set (`pnpm lint:demo`) MUST be unchanged (zero net delta).
- **FR-013**: The change MUST be scoped to these nine rule modules (plus the minimal import-site edits in FR-003). Migrating or altering `classify.ts`, `helpers.ts`, `linter.ts`, `index.ts`, the vendored helpers, or `no-spectral-color`, or changing any rule's detection logic, is out of scope. Any refactoring is behavior-preserving.

### Key Entities *(include if feature involves data)*

- **Rule module**: the unit being migrated — a module exporting `id: number`, `name: string`, and one or more check entrypoints (`checkToken`, `lintSource`, `checkValue`), matching the dispatch shapes the linter factory (`linter.ts`) reads off each `import * as rule…` namespace. Nine such modules are in scope.
- **Check entrypoint**: the per-rule function the linter invokes — `checkToken(rawTok, parts, ctx)` for token rules, `lintSource(source, filePath, ctx)` for source-walking rules, and `checkValue(value, ctx)` for the CSS-value path — whose name, arity, and return type (`string | null`, or `void` for `lintSource`) must be preserved so the linter's bivariant dispatch keeps accepting it.
- **Rule context (`ctx`)**: the per-run object rules read — `{ tokens, ansi, ruleConfig? }` for token rules and `{ report, ansi, tokens?, ruleConfig? }` for source rules. Each rule declares a small local `ctx` type carrying exactly the fields it reads (with `tokens` narrowed to the classifier's `Tokens` where it calls the classifier), matching `no-spectral-color.ts` and `linter.ts`.
- **Composed color parts**: the `ColorParts` record (`NonNullable<ReturnType<typeof composeColorParts>>`) that token rules destructure; consumed as an input, not redefined by this change.
- **Cross-rule export**: `findRawColor`, exported by `no-raw-css-color` and imported by `no-component-color-override` — the one intra-`rules/` dependency, whose specifier and signature must both survive the migration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All nine rule modules are TypeScript sources; zero JavaScript source remains under `lint-color/rules/`.
- **SC-002**: `pnpm typecheck` passes with zero errors, with each migrated rule's own body now within type coverage.
- **SC-003**: 100% of the existing tests that exercise these rules pass with zero edits to their assertions or logic.
- **SC-004**: The demo-app fixture (`pnpm lint:demo`) produces an identical set of violations — classes, messages, and counts across all ten rules — before and after the change (zero net delta).
- **SC-005**: The linter runs end-to-end via its normal entrypoint (`node lint-color/index.ts`) with no new build, bundling, or loader step introduced by the change.
- **SC-006**: The migrated rules introduce zero unjustified `any`; every `any` (if any) carries an inline rationale, and each rule reuses the classifier's exported `ColorParts`/`Tokens`/`ColorVerdict` contracts for its `parts`/`tokens` surfaces rather than re-declaring them (the `ctx`/`Ansi` locals follow the `no-spectral-color.ts`/`linter.ts` precedent).

## Assumptions

- The project runs TypeScript source directly (Node engine `^26.1.0` native type stripping, `tsconfig` `noEmit`); each migrated `.ts` rule can be imported and executed without adding a compile or bundle step, and importers reference it by its `.ts` specifier per the repo's established convention (`no-spectral-color.ts`, `classify.ts`).
- The test runner resolves a `.js` import specifier to the sibling `.ts` module (as it already does for `no-spectral-color`), so rule test files keep resolving whether or not their specifiers are updated; any specifier update to a test is mechanical and touches no assertion.
- The classifier's runtime contracts (`ColorParts`, `Tokens`, `ColorVerdict`) in `classify.ts` are the canonical types the rules reuse for their `parts`/`tokens` surfaces; the per-rule `ctx`/`Ansi` types are declared locally, matching `no-spectral-color.ts` and `linter.ts`. `helpers.ts` is the test-harness module and stays out of scope — it is not imported by the runtime rules and is not modified by this change.
- `classify.ts`, `linter.ts`, `index.ts`, the vendored helpers (`postcss-value-parser`, `vendor/is-color`), and the already-migrated `no-spectral-color` remain as-is and out of scope; the migration types how each rule calls into them and preserves their behavior.
- This is a language migration with behavior-preserving refactoring, not a behavior change: no new detections, no new configuration surface, and no message-wording changes beyond what existing tests already assert.
- Each rule's existing design decisions — its detection strategy, `ctx` fields read, and cross-rule reuse — are retained as-is; this change types and tidies them, it does not redesign them.
