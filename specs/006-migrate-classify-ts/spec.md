# Feature Specification: Refactor and migrate the color-classification layer (`classify.js`) from JavaScript to TypeScript

**Feature Branch**: `ym/explore`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Refactor lint-color/classify.js and migrate from JS to TS."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The classification layer is type-checked at its own contract (Priority: P1)

A rule author opens the color-classification layer and finds it written in TypeScript.
The verdict a candidate class resolves to — `"semantic" | "spectral" | "static" | "raw"
| "var" | null` — is a named type; the token-set inputs (`semanticSet`, `spectralSet`),
the token-split result (`{ variants, base, modifier }`), the composed color parts
(`{ variants, base, modifier, colorPrefix, colorPart, arbitraryProperty, arbitraryValue }`),
the spectral-match result (`{ name, shade }`), and every internal helper carry parameter
and return types the compiler enforces. `pnpm typecheck` now covers the body of this
module — the layer that turns a raw Tailwind candidate into a color verdict — not just its
callers.

**Why this priority**: This is the whole point of the change. The classification layer is
the shared decision surface every color rule depends on: `composeColorParts` and the
`classify*` family are consumed by the linter factory and five rule modules. The
constitution names TypeScript types "the primary contract," and this is a core shared
boundary module still authored in untyped JavaScript. Making the verdict union and the
part/token shapes explicit is the value delivered; everything else is preservation.

**Independent Test**: Confirm the module now lives at a `.ts` path, `pnpm typecheck` passes
with zero errors, and every exported member and internal helper carries types (no implicit
`any` on parameters or returns; any explicit `any` carries an inline justification). Run the
full existing test suite and confirm every case passes with no assertion changes.

**Acceptance Scenarios**:

1. **Given** the migrated classification module, **When** `pnpm typecheck` runs, **Then** it reports zero errors and the module's own parameters and return values are typed.
2. **Given** the full existing linter test suite (`classify.test.ts`, `linter.test.ts`, `linter.lintCss.test.ts`, and the rule tests that call into this module), **When** it runs against the migrated module, **Then** every test passes unchanged.
3. **Given** each exported member (`TAILWIND_SPECTRAL_COLORS`, `TAILWIND_STATIC_COLORS`, `CSS_COLOR_PROPERTIES`, `TAILWIND_COLOR_PREFIXES`, `splitColorToken`, `findSpectralMatch`, `classifyColorPart`, `parseArbitraryProperty`, `classifyParts`, `findColorPrefix`, `composeColorParts`), **When** inspected after migration, **Then** its name and call signature are unchanged.

---

### User Story 2 - The linter still loads and classifies every candidate (Priority: P1)

An app developer runs the linter (`pnpm lint:demo` / `node lint-color/index.js`) exactly as
before. Each importer of the classification layer resolves to the migrated module, and the
linter produces the same violations — same classes flagged, same messages, same
suppression counts — as it did when the module was JavaScript.

**Why this priority**: A boundary module the runtime can no longer import breaks every color
rule at once, regardless of how clean its types are. The module is consumed by static
imports in the CLI entrypoint, the linter factory, the shared helpers, and five rule
modules; those import sites and the runtime's ability to load the TypeScript module are part
of the contract, not an afterthought. Per the repo convention (e.g. `ansi.ts` imported as
`"./ansi.ts"`, `no-spectral-color.ts` as `"./rules/no-spectral-color.ts"`), the runtime
entrypoints import migrated modules by their `.ts` specifier.

**Independent Test**: Run `pnpm lint:demo` over the demo-app fixture before and after the
migration and confirm the full violation set — classes, messages, and counts across all
rules — is byte-for-byte identical.

**Acceptance Scenarios**:

1. **Given** every current importer of the module (`lint-color/index.js`, `lint-color/linter.js`, `lint-color/helpers.ts`, `lint-color/rules/no-var-color.js`, `lint-color/rules/no-component-color-override.js`, `lint-color/rules/no-opacity-modifier.js`, `lint-color/rules/no-raw-css-color.js`, `lint-color/rules/no-spectral-color.ts`), **When** they import the migrated module, **Then** the import resolves and the exported members are usable with the same signatures.
2. **Given** the demo-app fixture, **When** the linter runs after migration, **Then** the complete set of violations (classes, messages, counts) across all rules is identical to the pre-migration run.
3. **Given** the CLI entrypoint `node lint-color/index.js`, **When** it loads the migrated module with no build or bundle step, **Then** it resolves and runs exactly as before.

---

### User Story 3 - Tailwind candidate parsing and color verdicts are preserved exactly (Priority: P2)

A design-system maintainer sees no change in what the linter detects because the
classification layer's observable behavior is unchanged: token splitting that peels
variants, the trailing/leading important markers (v4 `bg-primary/50!`, v3 `!bg-primary`),
and a single modifier while leaving a second modifier to fail the candidate; longest-prefix
color-prefix matching; the `semantic → static → arbitrary/var → spectral` verdict order
(so `(--red-500-rgb)` never misreads as spectral); arbitrary-value and v4 var-shorthand
classification with recursive `var()` fallback detection; arbitrary-property parsing and
color-property gating; and the candidate-discard rules for malformed variants, unterminated
or trailing-junk arbitrary groups, and invalid modifiers.

**Why this priority**: Preserving observable behavior is the contract of a language
migration. It is P2 only because Stories 1 and 2 already assert typing and loading; this
story pins the specific parse/verdict boundary cases that the module's own comments call out
as deliberate (parse-parity with Tailwind's candidate machinery) and that the curated
`EDGE_TOKENS` and rule tests already lock down.

**Acceptance Scenarios**:

1. **Given** the curated `EDGE_TOKENS` edge-case corpus driving `splitColorToken`, **When** each token is split after migration, **Then** every `{ variants, base, modifier }` result is identical to today's.
2. **Given** a color part like `(--red-500-rgb)` (var shorthand whose interior looks spectral), **When** classified, **Then** the arbitrary/var branch runs before the spectral scan and it is not misreported as `"spectral"`.
3. **Given** an arbitrary value carrying a literal-color fallback nested at any depth (`var(--x, var(--y, red))`), **When** classified, **Then** the recursive fallback check returns `"raw"`, while a clean `var(--x)` returns `"var"`.
4. **Given** malformed candidates (`bg-[#fff` unterminated, `bg-[#fff]x` trailing junk, `bg-red/50/50` second modifier, a `[…]` property `parseArbitraryProperty` rejects), **When** composed, **Then** `composeColorParts` returns `null` exactly as before.

---

### Edge Cases

- **Runtime module loading**: the project runs `.ts` sources directly via Node native type stripping (engine `^26.1.0`) with no build step; the migration must keep the module importable without introducing a compile/bundle stage. Runtime entrypoints (`index.js`, `linter.js`, and the still-JavaScript rules) import the module by its `.ts` specifier per the repo convention, so each importer's `"./classify.js"` / `"../classify.js"` specifier must be updated to resolve the renamed module.
- **Test-file import resolution**: the test runner resolves a `.js` specifier to the sibling `.ts` file (established in the codebase — `no-spectral-color.test.ts` imports `"./no-spectral-color.js"` against a `.ts`-only module and passes), so a test importing `"./classify.js"` keeps resolving after the rename. Test import specifiers may be updated to `.ts` for consistency, but no test assertion or logic changes.
- **The verdict union at the JS↔TS boundary**: the still-JavaScript rule modules (`no-var-color.js`, `no-component-color-override.js`, `no-opacity-modifier.js`, `no-raw-css-color.js`) and `linter.js` consume the verdict and the composed parts. Under `checkJs: false` they are not type-checked, but the migrated module's exported signatures must not break their runtime calls; the verdict type must be expressible without forcing changes to those still-JavaScript consumers.
- **Vendored parse-parity helpers**: the module leans on `./vendor/*` helpers (`segment`, `isValidArbitrary`, `decodeArbitraryValue`, `isColor`) that preserve Tailwind candidate-parsing parity. Types must describe how this module calls them at its own boundary; the migration does not alter or re-vendor those helpers, and their parity citations stay intact.
- **Nullable / optional token sets**: `classifyColorPart`/`classifyParts` accept a `tokens` object whose `semanticSet` and `spectralSet` are optional, and `findSpectralMatch` guards a missing set by returning `null`; `findColorPrefix` accepts a possibly-empty prefix list. The chosen types must model these optional/nullable inputs without a spurious `any`.
- **Behavior-preserving refactor only**: any structural cleanup done alongside the migration (renaming, re-sectioning, extracting or inlining a helper) must not change any observable output; it is bounded by the same before/after fixture and test parity as the migration itself.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The color-classification layer MUST be authored in TypeScript, replacing the existing JavaScript module, at a `.ts` path.
- **FR-002**: The migrated module MUST preserve its public surface exactly — the exported constants `TAILWIND_SPECTRAL_COLORS`, `TAILWIND_STATIC_COLORS`, `CSS_COLOR_PROPERTIES`, and `TAILWIND_COLOR_PREFIXES`, and the exported functions `splitColorToken`, `findSpectralMatch`, `classifyColorPart`, `parseArbitraryProperty`, `classifyParts`, `findColorPrefix`, and `composeColorParts`, each with its current name and call signature — so every rule, the linter factory, the CLI entrypoint, the shared helpers, and the tests keep working unchanged.
- **FR-003**: Every import site that references the module (currently `lint-color/index.js`, `lint-color/linter.js`, `lint-color/helpers.ts`, `lint-color/rules/no-var-color.js`, `lint-color/rules/no-component-color-override.js`, `lint-color/rules/no-opacity-modifier.js`, `lint-color/rules/no-raw-css-color.js`, and `lint-color/rules/no-spectral-color.ts`, plus the test files) MUST continue to resolve to the migrated module after the extension change, with no other loader or build configuration required to run the linter.
- **FR-004**: The module's parameters, local helpers, and return values MUST carry types; the color verdict MUST be a named union (`"semantic" | "spectral" | "static" | "raw" | "var" | null`), and the token-split, composed-parts, spectral-match, and arbitrary-property result shapes MUST be named types. Any explicit `any` MUST carry an inline justification. `pnpm typecheck` MUST pass with zero errors.
- **FR-005**: Token splitting (`splitColorToken`) MUST be preserved exactly: variant peeling on `:`, trailing v4 important (`…!`) and leading v3 important (`!…`) stripping, and single-modifier extraction on `/` (with a second modifier left in `base` so the candidate is later discarded), producing the same `{ variants, base, modifier }` for every input including the curated `EDGE_TOKENS` corpus, and never throwing on unbalanced brackets.
- **FR-006**: The color-part verdict order MUST be preserved: `semantic` (semantic-set hit) → `static` (keyword color) → arbitrary/var-shorthand branch → `spectral` (palette name + numeric shade), so an arbitrary or var-shorthand part whose interior resembles a spectral name (e.g. `(--red-500-rgb)`) is classified by the arbitrary branch and never misread as spectral.
- **FR-007**: Arbitrary-value and var-shorthand classification MUST be preserved: bracketed `[…]` values and v4 `(…)` shorthand resolve to `"var"` for a clean CSS-var reference and `"raw"` for a literal-color value or a `var()` carrying a literal-color fallback detected recursively at any nesting depth; non-color typehints (`(length:--x)`, `[url(…)]`) resolve to `null`.
- **FR-008**: Arbitrary-property handling MUST be preserved: `parseArbitraryProperty` parses a whole-base `[property:value]` (custom props leading `--` or an `a-z` property, non-empty value) and returns `null` otherwise; `classifyParts` gates on `isColorProperty` (a `--` custom property or a known CSS color property) before classifying the value, and returns `null` for non-color properties.
- **FR-009**: Candidate composition and discard MUST be preserved: `composeColorParts` parses the arbitrary-property shape once, discards candidates with an invalid variant, a second modifier, an invalid modifier, an unterminated or trailing-junk arbitrary group, or a malformed arbitrary property (returning `null`), and otherwise returns the full parts record with the longest-matching color prefix and the derived `colorPart`, `arbitraryProperty`, and `arbitraryValue`.
- **FR-010**: The spectral scan (`findSpectralMatch`) and prefix match (`findColorPrefix`) MUST retain identical behavior once typed: `findSpectralMatch` returns the first left-to-right palette-name-followed-by-numeric-shade match (or `null`, including when the set is missing), and `findColorPrefix` returns the longest prefix whose `prefix-` leads the base (or `null`).
- **FR-011**: All existing tests that exercise this module MUST pass without modification to their assertions or logic, and the demo-app violation set (`pnpm lint:demo`) MUST be unchanged (zero net delta).
- **FR-012**: The change MUST be scoped to this one module (plus the minimal import-site edits in FR-003). Migrating sibling rules or the vendored helpers, or altering rule detection logic, is out of scope. Any refactoring is behavior-preserving.

### Key Entities *(include if feature involves data)*

- **Color verdict**: the result of classification — `"semantic" | "spectral" | "static" | "raw" | "var" | null` — the value every color rule branches on. Its union must be a named type, identical in runtime values before and after.
- **Token-split result**: the `{ variants: string[], base: string, modifier: string | null }` produced by `splitColorToken`, the first decomposition of a raw candidate.
- **Composed color parts**: the `{ variants, base, modifier, colorPrefix, colorPart, arbitraryProperty, arbitraryValue }` record `composeColorParts` returns (or `null`) — the structure downstream rules destructure to decide what to classify.
- **Spectral match**: the `{ name: string, shade: string }` record `findSpectralMatch` returns — consumed both for the `"spectral"` verdict and by `no-spectral-color` for its replacement hint.
- **Token sets**: the `{ semanticSet?, spectralSet? }` inputs — the design-system's semantic token names and the Tailwind spectral palette names — whose optional/nullable shape must be typed without an unjustified `any`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The classification layer source is a TypeScript module; zero JavaScript source remains for this module.
- **SC-002**: `pnpm typecheck` passes with zero errors, with the module's own body now within type coverage.
- **SC-003**: 100% of the existing tests that exercise this module pass with zero edits to their assertions or logic.
- **SC-004**: The demo-app fixture (`pnpm lint:demo`) produces an identical set of violations — classes, messages, and counts across all rules — before and after the change (zero net delta).
- **SC-005**: The linter runs end-to-end via its normal entrypoint (`node lint-color/index.js`) with no new build, bundling, or loader step introduced by the change.
- **SC-006**: The migrated module introduces zero unjustified `any`; every `any` (if any) carries an inline rationale.

## Assumptions

- The project runs TypeScript source directly (Node engine `^26.1.0` native type stripping, `tsconfig` `noEmit`); the migrated `.ts` module can be imported and executed without adding a compile or bundle step, and runtime importers reference it by its `.ts` specifier per the repo's established convention (`ansi.ts`, `no-spectral-color.ts`).
- The test runner resolves a `.js` import specifier to the sibling `.ts` module (as it already does for `no-spectral-color`), so test files keep resolving whether or not their specifiers are updated; any specifier update to a test is mechanical and touches no assertion.
- The vendored parse-parity helpers (`./vendor/segment`, `is-valid-arbitrary`, `decode-arbitrary-value`, `is-color`) remain as-is and out of scope; the migration types how this module calls them and preserves their parity citations.
- The sibling rule modules and the linter factory that import this layer remain JavaScript and are explicitly out of scope; the migration must keep their runtime calls working via unchanged export signatures.
- This is a language migration with behavior-preserving refactoring, not a behavior change: no new detections, no new configuration surface, and no message-wording changes beyond what existing tests already assert.
- The module's existing design decisions — Tailwind-parity token splitting, longest-prefix matching, the fixed verdict order, recursive `var()` fallback detection, and the candidate-discard rules — are retained as-is; this change types and tidies them, it does not redesign them.
