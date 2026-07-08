# Phase 0 Research: Wire Ruby/ERB Parser

All items resolved — no NEEDS CLARIFICATION remains. Deep, cited source-of-truth investigation
lives in `.scratch/wire-ruby-parser/research.md` (two passes: `gh api` + a full local clone at
`.repos/herb`, verified against parser test fixtures). This file records the **decisions**.

## D1 — Parser binding

- **Decision**: Depend on `@herb-tools/node-wasm`, version-pinned (pre-1.0, currently `0.10.1`).
- **Rationale**: Pure-WASM, single dependency (`@herb-tools/core`), no per-platform native compile —
  portable for dev machines + CI. Identical API to `@herb-tools/node`. `await Herb.load()` (async,
  once) then `Herb.parse(source)` is synchronous, so the extractor stays sync like its oxc sibling.
- **Alternatives considered**: `@herb-tools/node` (native addon via node-pre-gyp) — rejected: needs a
  prebuilt binary or C toolchain, install can fail on unsupported platforms. Ruby herb gem — rejected:
  we run in Node, no Ruby runtime in scope.

## D2 — AST traversal + class extraction

- **Decision**: Subclass herb's exported `Visitor`; override `visitHTMLAttributeNode`; use herb's own
  exported helpers `getStaticAttributeName`, `splitLiteralsAtWhitespace`, `groupNodesByClass`,
  `isLiteralNode` (all from `@herb-tools/core`) to tokenize the `class` value. Keep only groups where
  every node is a `LiteralNode`; those are safe static tokens.
- **Rationale**: This is exactly how herb's own `@herb-tools/linter` rule
  `erb-no-interpolated-class-names` handles `class` attributes — battle-tested, and reusing it avoids
  reimplementing whitespace/hyphen/interpolation tokenization. Less code, aligns with Constitution I.
- **Alternatives considered**: (a) generic key-walk like oxc `walk` — rejected: herb nodes are class
  instances, not plain `.type` objects; `walk` cannot traverse them. (b) subclass
  `AttributeVisitorMixin` from `@herb-tools/linter` — deferred: cleaner hooks but adds a dependency;
  adopt only if it imports cleanly, else the plain `Visitor` route needs just `@herb-tools/core`.

## D3 — ERB interpolation boundary (FR-005)

- **Decision**: Treat any class group containing a non-`LiteralNode` (ERBContentNode or ERB
  control-flow node) as dynamic and skip it whole. Only whitespace-complete, fully-static tokens reach
  `checkTailwindClasses`.
- **Rationale**: Verified against herb fixtures — `class="text-red-500 <%= foo %>"` yields a static
  `LiteralNode` group + an ERB group; `class="text-<%= x %>-500"` collapses (hyphen-adjacent) into one
  mixed group. `every(isLiteralNode)` cleanly lints the former's static token and skips both dynamic
  cases, producing zero partial-token false positives (SC-003). Matches the existing static-only stance
  for JSX (`cn()`/ternary out of scope).
- **Alternatives considered**: concatenating literals across the ERB hole (→ `text--500` false
  candidate) or splitting each literal independently (→ `text-`/`-500` partial false positives) — both
  rejected as noise sources.

## D4 — Parse-error resilience (FR-006)

- **Decision**: `lintErbSource` always lints `ParseResult.value`; if `ParseResult.errors` is non-empty,
  surface a parse note and continue. Never throw out of a single file.
- **Rationale**: herb is error-recovering — `parse` returns a `ParseResult` carrying `.errors`
  (verified `core/src/parse-result.ts:27,95-97`), it does not throw. One malformed template cannot abort
  the run (SC-005). Mirrors the existing `try/catch` around `postcss.parse` in `lintCssSource`.

## D5 — Suppression directive

- **Decision**: `<%# color-lint-ignore %>` on a line suppresses violations on that line. Build the
  ignored-lines set from `ERBContentNode`s whose `tag_opening === "<%#"` and `content` trims to
  `color-lint-ignore`, using `location.start.line`.
- **Rationale**: ERB comments parse as `ERBContentNode` with `<%#` opener (verified fixtures). Keeps the
  `color-lint-ignore` directive name stable across JS/CSS/ERB per Constitution III (public contract).
- **Alternatives considered**: HTML comment `<!-- color-lint-ignore -->` (`HTMLCommentNode`) — rejected
  for v1 to keep one ERB-idiomatic directive; can be added later without breaking the contract.

## D6 — File discovery

- **Decision**: Add a single `.erb` glob. No change to `getAllFiles`.
- **Rationale**: `getAllFiles` filters on `extname`; `extname("x.html.erb") === ".erb"`, so one `.erb`
  extension matches both `.erb` and `.html.erb` (FR-001).

## Deferred (FR-008, out of scope for this feature)

`no-style-color` (ERB `style="…"` is a plain string, not a JS object literal),
`no-component-color-override`, `no-useless-hover` — JSX/React-shaped, need new ERB logic. Not wired to
ERB here; must not emit spurious ERB output.
