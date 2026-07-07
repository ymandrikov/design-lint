# Feature Specification: Refactor and migrate the core linting engine (`linter.js`) from JavaScript to TypeScript

**Feature Branch**: `ym/explore`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Refactor lint-color/linter.js and migrate from JS to TS."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The core linting engine is type-checked at its own contract (Priority: P1)

A rule author opens the linting engine and finds it written in TypeScript. The factory
`createLinter(config, tokens, ansi)` declares what it takes — the per-rule config map, the
resolved token set (`semanticSet`, `spectralSet`, `colorPrefixes`, `uiComponents`,
`isValidTailwindCandidate`), and the ANSI colorizer — and what it returns: an object of five
`lint*Source` methods, each yielding `{ violations, ignores }`. The internal dispatch
helpers (`buildDisabledRules`, `lintSourceIfEnabled`, `checkTokenIfEnabled`,
`checkValueIfEnabled`) and the per-token pipeline (`checkTailwindToken`,
`checkTailwindClasses`) carry compiler-enforced types, so the `{ line, message, ruleId }`
violation records the engine assembles — and the `ColorParts` it threads from
`composeColorParts` into every token rule — can no longer drift silently. `pnpm typecheck`
now covers the body of this module — the engine every rule runs inside — not just its callers.

**Why this priority**: This is the whole point of the change. The linting engine is the
orchestration hub of the entire product: every rule is dispatched through it, every violation
the tool reports is assembled here, and both the CLI entrypoint and the test suite construct
their linter through this one factory. The constitution names TypeScript types "the primary
contract," and this is the central boundary module still authored in untyped JavaScript.
Making the factory's inputs (`config`, `tokens`, `ansi`), the shape of a violation record, and
the rule-dispatch helpers explicit is the value delivered; everything else is preservation.

**Independent Test**: Confirm the module now lives at a `.ts` path, `pnpm typecheck` passes
with zero errors, and the factory, its five returned methods, the dispatch helpers, and the
violation records all carry types (no implicit `any` on parameters or returns; any explicit
`any` carries an inline justification).

**Acceptance Scenarios**:

1. **Given** the migrated engine module, **When** `pnpm typecheck` runs, **Then** it reports zero errors and the factory's parameters, its returned methods, and the violation records are typed.
2. **Given** the exported factory `createLinter` and each of its five returned methods (`lintTailwindSource`, `lintStyleSource`, `lintHoverSource`, `lintComponentSource`, `lintCssSource`), **When** inspected after migration, **Then** every name and call signature is unchanged.

---

### User Story 2 - The linter and its test suite still run exactly as before (Priority: P1)

An app developer runs the linter (`pnpm lint:demo` / `node lint-color/index.js`) and a rule
author runs the test suite (`pnpm test`) exactly as before. All three importers of the engine
— the CLI entrypoint `lint-color/index.js` and the two test files `linter.test.ts` and
`linter.lintCss.test.ts` — resolve to the migrated module, and the engine dispatches the same
rules, assembles the same violations, and produces the same output — same files scanned, same
classes flagged, same messages, same counts, same suppression totals — as it did when the
module was JavaScript.

**Why this priority**: An engine the runtime and the tests can no longer import breaks the
entire product before a single rule fires. The module is consumed by a static import in the
CLI entrypoint and by two Vitest suites; those three import sites and the runtime's ability
to load the TypeScript module are part of the contract, not an afterthought. Per the repo
convention (e.g. `ast.ts` imported as `"./ast.ts"`, `no-spectral-color.ts` as `"./rules/no-spectral-color.ts"`), every importer references the migrated module by its `.ts` specifier.

**Independent Test**: Run `pnpm lint:demo` over the demo-app fixture and `pnpm test` before
and after the migration; confirm the full violation set (files scanned, classes, messages,
counts, suppression totals) is byte-for-byte identical and every test suite stays green.

**Acceptance Scenarios**:

1. **Given** the three importers (`lint-color/index.js`, `linter.test.ts`, `linter.lintCss.test.ts`), **When** each imports the migrated module, **Then** the import resolves and `createLinter` is usable with the same signature.
2. **Given** the demo-app fixture, **When** the linter runs after migration, **Then** the complete set of violations (files, classes, messages, counts, suppressions) across all rules is identical to the pre-migration run.
3. **Given** the CLI entrypoint `node lint-color/index.js`, **When** it loads the migrated module with no build or bundle step, **Then** it resolves and runs exactly as before.
4. **Given** the full Vitest suite, **When** it runs after migration, **Then** every suite passes with the same assertions, including `linter.test.ts` and `linter.lintCss.test.ts`.

---

### User Story 3 - Rule dispatch and the violation pipeline are preserved exactly (Priority: P2)

A design-system maintainer sees no change in what the linter reports because the engine's
observable behavior is unchanged: the disabled-rules set built from `enabled === false`, the
three "if enabled" dispatch guards (`lintSource`/`checkToken`/`checkValue`), the per-token
pipeline that composes `ColorParts` once and runs every token rule with no early return
(except the two documented `parts === null` / `!parts.base` short-circuits), the five public
`lint*Source` methods, and the CSS path's PostCSS walk (declarations, `@apply` params, and
`color-lint-ignore` comment suppression) all behave identically.

**Why this priority**: Preserving observable behavior is the contract of a language
migration. It is P2 only because Stories 1 and 2 already assert typing, loading, and the green
suite; this story pins the specific dispatch, pipeline, and CSS-walk cases the engine encodes.

**Acceptance Scenarios**:

1. **Given** a config in which a rule is set `enabled: false`, **When** the engine runs, **Then** that rule is skipped and no others are, identical to today (the `buildDisabledRules` set is unchanged).
2. **Given** a raw Tailwind token, **When** it flows through `checkTailwindToken`, **Then** `composeColorParts` is called once, the `parts === null` and `!parts.base` short-circuits fire exactly as before, and every enabled token rule contributes the same `{ message, ruleId }` records.
3. **Given** a CSS source with declarations, an `@apply` directive, and a `color-lint-ignore` comment, **When** `lintCssSource` runs, **Then** the same declaration values and `@apply` params are checked, the same lines are suppressed and counted, and a malformed-CSS parse still returns `{ violations: [], ignores: [] }`.

---

### Edge Cases

- **Runtime module loading**: the project runs `.ts` sources directly via Node native type stripping (engine `^26.1.0`) with no build step; the migration must keep the module importable without introducing a compile/bundle stage. Every importer (`index.js`, and the two test files) references the module by its `.ts` specifier per the repo convention, so each `"./linter.js"` specifier must be updated to resolve the renamed module.
- **Two test importers, not one**: unlike the file-discovery migration (007, one importer), the engine is imported by two Vitest suites (`linter.test.ts`, `linter.lintCss.test.ts`) in addition to the CLI entrypoint. All three specifiers change together; the test suites are the primary behavior contract and MUST stay green with no assertion edits.
- **`.js` rule modules imported from a `.ts` engine**: `linter.ts` is the first `.ts` module to `import * as` the ten rule modules, nine of which are still `.js`. Under `tsconfig` `allowJs: true, checkJs: false`, those `.js` namespaces resolve and their exported functions type as permissive (`any`-param) signatures, so the migration does not require migrating any rule module. The already-migrated `no-spectral-color.ts` is imported the same way. No rule module is in scope.
- **Behavior-preserving refactor only**: any structural cleanup done alongside the migration (renaming a local, re-sectioning, a comment tidy, tightening a type) must not change any observable output; it is bounded by the same before/after demo-app parity and green-suite gate as the migration itself.
- **Malformed CSS**: `lintCssSource` wraps `postcss.parse` in try/catch and returns empty results on a parse failure rather than falling back to a line scanner; this behavior is preserved exactly, and its return type is the same `{ violations, ignores }` as the success path.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The core linting engine MUST be authored in TypeScript, replacing the existing JavaScript module, at a `.ts` path.
- **FR-002**: The migrated module MUST preserve its public surface exactly — the exported factory `createLinter(config, tokens, ansi)` and the five methods it returns (`lintTailwindSource`, `lintStyleSource`, `lintHoverSource`, `lintComponentSource`, `lintCssSource`), each with its current name and call signature — so every importer keeps working unchanged.
- **FR-003**: Every import site that references the module — `lint-color/index.js`, `lint-color/linter.test.ts`, and `lint-color/linter.lintCss.test.ts` — MUST continue to resolve to the migrated module after the extension change, with no other loader or build configuration required to run the linter or the tests.
- **FR-004**: The module's parameters, local values, and return values MUST carry types: the factory's `config` (per-rule config map), `tokens` (the resolved token set), and `ansi` (the colorizer); the `{ line, message, ruleId }` violation record and the `{ violations, ignores }` result; and the dispatch helpers. Any explicit `any` MUST carry an inline justification. `pnpm typecheck` MUST pass with zero errors.
- **FR-005**: The rule-dispatch behavior MUST be preserved exactly: the disabled-rules set built from `enabled === false`; the `lintSourceIfEnabled` / `checkTokenIfEnabled` / `checkValueIfEnabled` guards that return early for a disabled rule; and the per-token pipeline (`checkTailwindToken`) that composes `ColorParts` once, honors the `parts === null` and `!parts.base` short-circuits, and runs every enabled token rule in the same order producing the same `{ message, ruleId }` records.
- **FR-006**: The CSS linting path (`lintCssSource`) MUST be preserved exactly: the PostCSS parse with try/catch returning empty results on failure, the `color-lint-ignore` comment suppression and its count, the declaration-value scan, and the `@apply` params scan.
- **FR-007**: The demo-app violation set (`pnpm lint:demo`) MUST be unchanged (zero net delta) after the migration, and the full Vitest suite (`pnpm test`) MUST stay green with no assertion edits.
- **FR-008**: The change MUST be scoped to this one module (plus the minimal import-specifier edits in FR-003). Migrating the ten rule modules, the CLI entrypoint, or any sibling module, and altering dispatch or pipeline logic, are out of scope. Any refactoring is behavior-preserving.

### Key Entities *(include if data involved)*

- **Violation record**: the `{ line: number, message: string, ruleId: number }` object the engine assembles and every `lint*Source` method returns inside `violations`. Its shape is the contract the CLI entrypoint consumes (`accumulate` reads `line`, `message`, `ruleId`); it must be typed and unchanged.
- **Lint result**: the `{ violations: Violation[], ignores: number[] }` object every public method returns. `ignores` carries the suppressed line numbers; both fields and their element types must be explicit and identical to today's runtime values.
- **Token set (`tokens`)**: the resolved object the factory receives — `semanticSet`, `spectralSet`, `colorPrefixes`, `uiComponents`, `isValidTailwindCandidate` — threaded into `composeColorParts` (reads `colorPrefixes`) and passed to each rule as `ctx.tokens`. Its type must admit the runtime shape the CLI builds and the `minimalTokens` the tests build.
- **Rule module**: each `import * as ruleX` namespace, carrying `id`, `name`, and one of `lintSource` / `checkToken` / `checkValue`. Nine are `.js` (permissive types under `allowJs`/`checkJs:false`), one is `.ts` (`no-spectral-color.ts`); the dispatch helpers accept them without migrating any of them.
- **Per-rule config (`config`)**: the map keyed by rule name whose entries carry `enabled?: boolean` plus arbitrary rule-specific keys; read by `buildDisabledRules` and passed as each rule's `ruleConfig`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The core linting engine source is a TypeScript module; zero JavaScript source remains for this module.
- **SC-002**: `pnpm typecheck` passes with zero errors, with the module's own body now within type coverage.
- **SC-003**: The demo-app fixture (`pnpm lint:demo`) produces an identical set of violations — files scanned, classes, messages, counts, and suppressions across all rules — before and after the change (zero net delta): **23 violations, 1 suppressed**.
- **SC-004**: The full Vitest suite (`pnpm test`) stays green with no assertion edits, including `linter.test.ts` and `linter.lintCss.test.ts` after their import-specifier change.
- **SC-005**: The linter runs end-to-end via its normal entrypoint (`node lint-color/index.js`) with no new build, bundling, or loader step introduced by the change.
- **SC-006**: The migrated module introduces zero unjustified `any`; every `any` (if any) carries an inline rationale.

## Assumptions

- The project runs TypeScript source directly (Node engine `^26.1.0` native type stripping, `tsconfig` `noEmit`, `allowImportingTsExtensions`, `allowJs`); the migrated `.ts` module can be imported and executed without adding a compile or bundle step, and every importer references it by its `.ts` specifier per the repo's established convention (`ast.ts`, `classify.ts`, `no-spectral-color.ts`).
- The engine is imported by exactly three sites today — `lint-color/index.js`, `lint-color/linter.test.ts`, `lint-color/linter.lintCss.test.ts` — each of which needs only an import-specifier edit; no other module references it.
- The ten rule modules (nine `.js`, one `.ts`) are out of scope. Under `allowJs: true, checkJs: false` the `.js` namespaces resolve with permissive signatures, so the engine can be typed without migrating or editing any rule module.
- This is a language migration with behavior-preserving refactoring, not a behavior change: no new rule, no new dispatch behavior, no new configuration surface, and no change to which files are scanned, which violations fire, or their messages/counts.
- The engine's existing design — the disabled-rules set, the three dispatch guards, the compose-once per-token pipeline, the five `lint*Source` methods, and the PostCSS CSS walk — is retained as-is; this change types and tidies it, it does not redesign it.
