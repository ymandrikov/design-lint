# Feature Specification: Refactor and migrate the AST layer (`ast.js`) from JavaScript to TypeScript

**Feature Branch**: `ym/explore`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "Refactor lint-color/ast.js and migrate from JS to TS."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The AST boundary is type-checked at its own contract (Priority: P1)

A rule author opens the AST layer and finds it written in TypeScript. The parsed-AST
value every rule receives (its `program`, `comments`, `lineStarts`, and lazily-filled
`ignored` fields) is a named type; the offset/line helpers, the depth-first `walk`, the
JSX-name resolver, the suppression scanner, and the two className extractors and the
style-object reader all carry parameter and return types the compiler enforces. `pnpm
typecheck` now covers the body of this module — the single boundary between raw source
and every rule — not just its callers.

**Why this priority**: This is the whole point of the change. The AST layer is the most
depended-upon source module in the linter: every rule and the linter factory consume its
exports. The constitution names TypeScript types "the primary contract," and this is the
last shared boundary module still authored in untyped JavaScript. Making the AST-node and
extraction-result shapes explicit is the value delivered; everything else is preservation.

**Independent Test**: Confirm the module now lives at a `.ts` path, `pnpm typecheck` passes
with zero errors, and every exported member and internal helper carries types (no implicit
`any` on parameters or returns; any explicit `any` carries an inline justification). Run the
full existing test suite and confirm every case passes with no assertion changes.

**Acceptance Scenarios**:

1. **Given** the migrated AST module, **When** `pnpm typecheck` runs, **Then** it reports zero errors and the module's own parameters and return values are typed.
2. **Given** the full existing linter test suite (`linter.test.ts`, `linter.lintCss.test.ts`, `classify.test.ts`, and the rule tests that walk this AST), **When** it runs against the migrated module, **Then** every test passes unchanged.
3. **Given** each exported member (`buildLineStarts`, `offsetToLine`, `parseSource`, `walk`, `jsxName`, `ignoredLines`, `classNameStatics`, `classNameStaticsDeep`, `styleObjectProps`), **When** inspected after migration, **Then** its name and call signature are unchanged.

---

### User Story 2 - The linter still loads and runs every rule over the AST (Priority: P1)

An app developer runs the linter (`pnpm lint:demo` / `node lint-color/index.js`) exactly as
before. Each importer of the AST layer resolves to the migrated module, the single per-file
parse still feeds all four rule passes, and the linter produces the same violations — same
classes flagged, same messages, same suppression counts — as it did when the module was
JavaScript.

**Why this priority**: A boundary module the runtime can no longer import breaks every rule
at once, regardless of how clean its types are. The module is consumed by static imports in
the linter factory, the shared test helpers, and three rule modules; those import sites and
the runtime's ability to load the TypeScript module are part of the contract, not an
afterthought.

**Independent Test**: Run `pnpm lint:demo` over the demo-app fixture before and after the
migration and confirm the full violation set — classes, messages, and counts across all
rules — is byte-for-byte identical.

**Acceptance Scenarios**:

1. **Given** every current importer of the module (`lint-color/linter.js`, `lint-color/helpers.ts`, `lint-color/rules/no-component-color-override.js`, `lint-color/rules/no-useless-hover.js`, `lint-color/rules/no-style-color.js`), **When** they import the migrated module, **Then** the import resolves and the exported functions are callable with the same signatures.
2. **Given** the demo-app fixture, **When** the linter runs after migration, **Then** the complete set of violations (classes, messages, counts) across all rules is identical to the pre-migration run.
3. **Given** a source line carrying a `color-lint-ignore` comment, **When** linted after migration, **Then** it is still suppressed and counted exactly as before.

---

### User Story 3 - AST parsing, caching, and extraction behavior are preserved exactly (Priority: P2)

A design-system maintainer sees no change in what the linter detects because the AST layer's
observable behavior is unchanged: one oxc parse per source with the last parse cached (LRU-1);
language chosen by extension (`.tsx`/`.jsx` → `tsx`, everything else → `ts`) so a plain-TS
generic arrow or angle-bracket cast never mis-parses; a best-effort recovered program walked
on syntax error; suppression scoped to the exact comment line matching only the standalone
`color-lint-ignore` marker (no superstring, no className match); shallow className extraction
over plain and template-literal statics; deep extraction that descends into call arguments;
and style-object property reading driven by the object AST (with `as`/`satisfies`/parenthesized
unwrapping and computed-key handling).

**Why this priority**: Preserving observable behavior is the contract of a language migration.
It is P2 only because Stories 1 and 2 already assert typing and loading; this story pins the
specific parse/cache/extraction boundary cases that the module's own comments call out as
deliberate (and that guard against regressing fixed bugs #2, #18, and the FP class the AST
layer was introduced to kill).

**Acceptance Scenarios**:

1. **Given** the same source string linted twice (as the four rule passes do), **When** parsed, **Then** the parse runs once and the cached AST is reused, unchanged from today.
2. **Given** a `.ts` file containing a generic arrow (`const f = <T,>(x) => x`) or an angle-bracket cast, **When** parsed, **Then** it parses under `ts` mode without dropping the rest of the file.
3. **Given** a className like `color-lint-ignore-panel` (superstring) and a separate comment containing the bare marker, **When** suppression is computed, **Then** only the comment's physical line is suppressed and the className suppresses nothing.
4. **Given** a `style={{ ... }}` object whose value contains a `{` inside a string, **When** its properties are read, **Then** the correct own properties are returned with no brace-desync (bug #2 stays fixed), and `style={expr}` returns none.

---

### Edge Cases

- **Runtime module loading**: the project runs `.ts` sources directly via Node native type stripping (engine `^26.1.0`) with no build step; the migration must keep the module importable without introducing a compile/bundle stage. Per the repo convention (e.g. `no-spectral-color.ts` imported as `"./rules/no-spectral-color.ts"`), the migrated module is imported by its `.ts` specifier, so each importer's `"./ast.js"` / `"../ast.js"` specifier must be updated to resolve the renamed module.
- **Typing the oxc AST boundary**: the module reads oxc-parser node shapes (`Literal`, `TemplateLiteral`/`TemplateElement`, `JSXExpressionContainer`, `JSXIdentifier`/`JSXNamespacedName`/`JSXMemberExpression`, `ObjectExpression`/`Property`, `TSAsExpression`/`TSSatisfiesExpression`/`ParenthesizedExpression`). Types must come from the parser's published types where available; where a precise type is not exported, the module expresses the shapes it reads at its own boundary without forcing changes to the parser vendor or to still-JavaScript consumers.
- **The generic `walk` contract**: `walk` accepts an arbitrary node and recurses over unknown object shapes, calling back on any value with a string `type`. Its parameter type must stay permissive enough to accept the whole tree (and be called with extracted sub-nodes) without requiring an unsafe cast at every call site; if `any`/`unknown` is unavoidable at this reflective boundary, it carries an inline justification per the constitution.
- **JS↔TS boundary with untyped consumers**: the three still-JavaScript rule modules and `linter.js` import these functions. Their `.js`-authored call sites must keep type-checking (under `checkJs: false` they are not checked, but the migrated module's exported signatures must not break their runtime calls).
- **Lazily-filled cache fields**: the parsed-AST `ignored` field starts null and is filled on first `ignoredLines` call, and the module-level parse cache starts all-null. The chosen types must model these nullable/lazy fields without a spurious `any`.
- **Behavior-preserving refactor only**: any structural cleanup done alongside the migration (renaming, re-sectioning, extracting a helper) must not change any observable output; it is bounded by the same before/after fixture and test parity as the migration itself.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The AST layer MUST be authored in TypeScript, replacing the existing JavaScript module, at a `.ts` path.
- **FR-002**: The migrated module MUST preserve its public surface exactly — the exported functions `buildLineStarts`, `offsetToLine`, `parseSource`, `walk`, `jsxName`, `ignoredLines`, `classNameStatics`, `classNameStaticsDeep`, and `styleObjectProps`, each with its current name and call signature — so every rule, the linter factory, and the shared test helpers keep working unchanged.
- **FR-003**: Every import site that references the module (currently `lint-color/linter.js`, `lint-color/helpers.ts`, `lint-color/rules/no-component-color-override.js`, `lint-color/rules/no-useless-hover.js`, and `lint-color/rules/no-style-color.js`) MUST continue to resolve to the migrated module after the extension change, with no other loader or build configuration required to run the linter.
- **FR-004**: The module's parameters, local helpers, return values, the parsed-AST value it produces, and its internal parse cache MUST carry types; any explicit `any` MUST carry an inline justification. `pnpm typecheck` MUST pass with zero errors.
- **FR-005**: The single-parse-per-file behavior MUST be preserved: `parseSource` parses once and reuses its last-parse (LRU-1) cache keyed on source and language, and the language-by-extension selection (`.tsx`/`.jsx` → `tsx`, otherwise `ts`) is unchanged, so the four rule passes still incur one parse per file.
- **FR-006**: Syntax-error handling MUST be preserved: on an unparseable source the module walks oxc's best-effort recovered program (a genuinely unparseable file lints clean) rather than surfacing parser errors.
- **FR-007**: Suppression semantics MUST be preserved exactly: only the standalone `color-lint-ignore` marker inside a comment suppresses, scoped to the marker's physical line, computed once and memoized on the cached AST — no superstring match and no className match.
- **FR-008**: className extraction MUST be preserved for both views: the shallow `classNameStatics` (plain string literal and template-literal static quasis only) and the deep `classNameStaticsDeep` (descending into nested expressions and call arguments, including template elements), each returning the same `{ text, node }` results as today.
- **FR-009**: Style-object reading MUST be preserved: `styleObjectProps` returns each own `Property` of a `style={{…}}` object literal as `{ keyName, valueNode, node }`, driven by the object AST (unwrapping `as`/`satisfies`/parenthesized expressions, skipping spreads, resolving identifier and literal keys, and dropping non-static computed keys), and returns none for `style={expr}`.
- **FR-010**: The JSX-name resolver (`jsxName`), the offset/line helpers (`buildLineStarts`, `offsetToLine`), and the depth-first `walk` (which skips `parent` back-references and `type`) MUST retain identical behavior once typed.
- **FR-011**: All existing tests that exercise this module MUST pass without modification, and the demo-app violation set (`pnpm lint:demo`) MUST be unchanged (zero net delta).
- **FR-012**: The change MUST be scoped to this one module (plus the minimal import-site edits in FR-003). Migrating sibling rules or shared modules, or altering rule detection logic, is out of scope. Any refactoring is behavior-preserving.

### Key Entities *(include if feature involves data)*

- **Parsed AST value**: the object `parseSource` returns and every rule consumes — `program` and `comments` from the parser plus the module's own `lineStarts` (offset→line index) and lazily-filled `ignored` (suppressed line set). Its shape must be a named type, identical in runtime structure before and after.
- **Parse cache**: the module-level last-parse memo keyed on `{ source, lang }`, holding the parsed AST value; its nullable/lazy fields must be typed without an unjustified `any`.
- **Extraction results**: the `{ text, node }` records from the two className extractors and the `{ keyName, valueNode, node }` records from the style-object reader — the structures downstream rules destructure, whose shapes must be expressible as types without changing their runtime content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The AST layer source is a TypeScript module; zero JavaScript source remains for this module.
- **SC-002**: `pnpm typecheck` passes with zero errors, with the module's own body now within type coverage.
- **SC-003**: 100% of the existing tests that exercise this module pass with zero edits to the test files.
- **SC-004**: The demo-app fixture (`pnpm lint:demo`) produces an identical set of violations — classes, messages, and counts across all rules — before and after the change (zero net delta).
- **SC-005**: The linter runs end-to-end via its normal entrypoint with no new build, bundling, or loader step introduced by the change.
- **SC-006**: The migrated module introduces zero unjustified `any`; every `any` (if any) carries an inline rationale.

## Assumptions

- The project runs TypeScript source directly (Node engine `^26.1.0` native type stripping, `tsconfig` `noEmit`); the migrated `.ts` module can be imported and executed without adding a compile or bundle step, and importers reference it by its `.ts` specifier per the repo's established convention.
- `oxc-parser` publishes usable TypeScript types for the AST nodes and parse result this module reads; where a specific node type is not exported, the module types the fields it actually reads at its own boundary rather than migrating the parser vendor.
- The sibling rule modules and shared modules that import this layer remain JavaScript and are explicitly out of scope; the migration must keep their runtime calls working via unchanged export signatures.
- This is a language migration with behavior-preserving refactoring, not a behavior change: no new detections, no new configuration surface, and no message-wording changes beyond what existing tests already assert.
- The module's existing design decisions — one parse per file with LRU-1 caching, language-by-extension, best-effort recovery, line-scoped standalone-marker suppression, shallow vs deep className extraction, and AST-driven style reading — are retained as-is; this change types and tidies them, it does not redesign them.
