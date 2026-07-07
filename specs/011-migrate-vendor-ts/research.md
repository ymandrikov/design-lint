# Phase 0 Research: Migrate vendored primitives (`lint-color/vendor/**`) JS → TS

**Feature**: 011-migrate-vendor-ts | **Date**: 2026-07-07

No open `NEEDS CLARIFICATION` remained after the spec. The decisions below record how each
primitive is typed and why the migration is behavior-preserving. Every finding is grounded in
the repository as it stands (the migrated siblings from specs 002, 004–010) and the vendored
sources themselves.

## Decision 1: Signatures are fully determined by the upstream Tailwind TypeScript sources

- **Decision**: Type each exported function against the upstream signature its vendored copy
  was ported from — `isColor(value: string): boolean`, `isNamedColor(value: string): boolean`,
  `segment(input: string, separator: string): string[]`, `isValidArbitrary(input: string):
  boolean`, `decodeArbitraryValue(input: string): string`.
- **Rationale**: The vendoring headers cite the exact upstream files at commit
  `9b0e8af…` (v4.3.2). Upstream is TypeScript (`segment(input: string, separator: string)`,
  `isValidArbitrary(input: string)`, `decodeArbitraryValue(input: string): string`), so
  re-adding types restores the original annotations rather than inventing new ones — this
  makes the vendored copies *closer* to upstream, satisfying constitution I's vendored-parity
  intent. The return types are what the existing JS already returns (an array from `segment`, a
  boolean from the two predicates, a string from decode).
- **Alternatives considered**: Leaving the files as `.js` under `allowJs` (rejected — they are
  the last untyped source and the whole point is to complete the migration); re-syncing with a
  newer upstream Tailwind while migrating (rejected — out of scope; this is a language
  migration, not a dependency bump).

## Decision 2: `decode-arbitrary-value`'s node walk types against `postcss-value-parser`'s bundled `Node` union — zero `any`

- **Decision**: Import the node type from `postcss-value-parser` and type
  `recursivelyDecodeArbitraryValues(nodes: Node[])` (and the `valueParser(input).nodes`
  it receives) against that union. `convertUnderscoresToWhitespace(input: string,
  skipUnderscoreToSpace = false): string` types trivially.
- **Rationale**: `postcss-value-parser@4.2.0` ships a bundled `.d.ts` declaring a
  `namespace postcssValueParser` with a `Node` union — `FunctionNode` (`type: "function"`,
  `nodes: Node[]`), `WordNode`, `DivNode`, `SpaceNode`, `StringNode`, `CommentNode`,
  `UnicodeRangeNode` — every member extending `BaseNode { value: string }`. The walk only
  reads `node.type`/`node.value` and, inside the `type === "function"` branch, `node.nodes`;
  all of that is expressible on the `Node` union with no cast. So the walk types with **zero**
  `any` and **no new dependency** (the package is already installed and imported by this same
  file). The `default` import (`valueParser`) and `valueParser.stringify` are likewise typed by
  the bundled declarations.
- **Alternatives considered**: Declaring a local `{ type, value, nodes? }` node type (rejected —
  redundant with the parser's own, and constitution I prefers reusing the real contract over
  re-declaring it); using `any` for the nodes (rejected — SC-006 forbids unjustified `any`, and
  none is needed here).

## Decision 3: `.ts` import specifiers at every consumer and test site

- **Decision**: Flip the four `"./vendor/<name>.js"` specifiers in `classify.ts` and the one
  `"../vendor/is-color.js"` in `no-raw-css-color.ts` to `.ts`. Flip the four vendor test
  specifiers `"./<name>.js"` → `".ts"` mechanically.
- **Rationale**: This is the established convention across the migrated codebase — migrated
  modules are imported by their `.ts` specifier (e.g. `no-spectral-color.ts`, `classify.ts`),
  and Node v26.1.0 native type stripping plus `allowImportingTsExtensions` make `.ts` specifiers
  resolve at runtime and under `tsc`. The test runner additionally resolves a `.js` specifier to
  the sibling `.ts`, so the test flips are cosmetic-for-consistency, not correctness-critical
  (FR-002 assumption). No loader, bundler, or tsconfig change is required.
- **Alternatives considered**: Keeping `.js` specifiers pointing at `.ts` files (rejected —
  inconsistent with every migrated sibling and the repo convention, even though the runner
  tolerates it).

## Decision 4: Preserve the vendoring headers; correct only the now-false "plain JS" note

- **Decision**: In each migrated file, keep the upstream source path, commit hash, ADR-0002
  citation, and (for `decode-arbitrary-value`) the divergence-from-upstream note; rewrite only
  the "Changes: converted to plain JS (type annotations dropped); no logic changes." line so it
  no longer misdescribes a TypeScript file.
- **Rationale**: Constitution I requires vendored parsing logic to cite its upstream source and
  the parity it preserves — the citation MUST survive. But the "converted to plain JS" note now
  describes the opposite of reality; leaving it would make the provenance record wrong. The
  minimal honest edit keeps the audit trail intact while telling the truth about the file's
  language (FR-009).
- **Alternatives considered**: Deleting the headers (rejected — violates constitution I's
  vendored-source-citation rule); leaving the "plain JS" note untouched (rejected — it would be
  a false provenance record on a `.ts` file).

## Decision 5: No behavior change, pinned by the existing tests and the demo fixture

- **Decision**: Treat this strictly as a language migration; change no parsing logic, add no
  new behavior, re-sync no upstream. Hold the baseline: `pnpm typecheck` clean, `pnpm test`
  393 passing / 20 files, `pnpm lint:demo` 23 violations / 1 suppressed (exit 1).
- **Rationale**: Each primitive already has an exact-output `*.test.ts`, and the classifier's
  own tests plus the demo fixture exercise the primitives transitively. Type stripping is
  erasure-only, so the runtime is byte-identical. Any structural tidy (renaming a local,
  annotating a helper) is bounded by these same suites (FR-010, SC-003, SC-004).
- **Alternatives considered**: Bundling a small behavior fix or upstream re-sync into the
  migration (rejected — out of scope per FR-011; would break the "zero net delta" parity
  guarantee that makes the migration safe to land unreviewed line-by-line).

## Resolved unknowns

| Question | Resolution |
|----------|-----------|
| Do the primitives need `any` anywhere? | No. Three are plain `string` functions; `decode`'s nodes type against `postcss-value-parser`'s bundled `Node` union. Zero `any`. |
| Is a new dependency needed to type the parser nodes? | No. `postcss-value-parser` is already installed and imported by `decode-arbitrary-value`; its bundled `.d.ts` supplies the types. |
| Does the migration touch tsconfig or `allowJs`? | No. `allowImportingTsExtensions`/`checkJs`/`allowJs` are already set; toggling `allowJs` after the last `.js` is gone is out of scope. |
| Will the vendor tests break on the rename? | No. The runner resolves `.js`→sibling `.ts`; specifiers flip to `.ts` for consistency, assertions untouched. |
| Any public-contract (CLI/config/rule) change? | No. The primitives are internal to the classifier; no flag, key, rule name, exit code, or suppression syntax changes. |
