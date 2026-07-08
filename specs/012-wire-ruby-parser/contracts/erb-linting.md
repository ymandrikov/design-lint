# Contract: ERB Linting

The linter's contract is its **output** (Constitution III) and the internal seam the new extractor
must satisfy. No network/API surface — this is a CLI over files.

## C1 — File discovery (FR-001)

- The CLI scans `<ROOT>/src` for `.erb` files (single glob; `extname` matches both `.erb` and
  `.html.erb`), alongside the existing `.css` and `.ts`/`.tsx` globs, in one pass.
- Storybook exclusion (`isStorybookFile`) applies unchanged.

## C2 — Extractor method: `createLinter(...).lintErbSource(source, filePath?)`

- **Input**: ERB source string + optional file path.
- **Output**: `LintResult = { violations: Violation[]; ignores: number[] }` — the **same shape** every
  other `lint*Source` method returns.
- **Behavior**:
  1. `Herb.parse(source)` (herb already loaded; see C5).
  2. Build `IgnoredLines` from `<%# color-lint-ignore %>` ERBContentNodes.
  3. Visit the AST; for each `HTMLAttributeNode` whose static name is `class`, tokenize the value into
     static `ClassToken`s (only all-literal groups).
  4. Drop tokens on ignored lines; run `checkTailwindClasses(token.text, token.line)`.
  5. Collect ignores (sorted) and violations; if `ParseResult.errors` is non-empty, surface a parse
     note but still return the violations found.
- **Guarantee**: for a class token string `T`, `lintErbSource` produces the same violations
  `lintTailwindSource` would for the same `T` (inner pipeline reused verbatim) — FR-003, SC-002.

## C3 — Output contract (FR-004, unchanged)

Every ERB violation is reported as `<file>:<line>  <message>`, grouped under its rule's designer-facing
label, counted in the summary, exit code non-zero if any violation. Identical to existing rules — ERB
violations are indistinguishable in format from JSX/CSS ones except by `file`.

## C4 — Interpolation contract (FR-005)

| Input `class="…"`                    | Linted tokens        | Skipped                    |
|--------------------------------------|----------------------|----------------------------|
| `text-red-500 bg-blue-600`           | both                 | —                          |
| `text-red-500 <%= foo %>`            | `text-red-500`       | the `<%= foo %>` group     |
| `text-<%= shade %>-500`              | *(none)*             | whole mixed group          |
| `<% if x %>text-red-500<% end %>`    | *(none; control-flow group)* | whole group        |
| `p-4 flex` (no color)                | *(candidates, no color violation)* | —            |

Zero partial-token false positives (`text-`, `-500`, `text--500` never emitted).

## C5 — Async init contract

- `Herb.load()` is awaited exactly once at CLI startup (index.ts top-level await) before any
  `.erb` file is linted. `Herb.parse` is synchronous thereafter, so `lintErbSource` is synchronous and
  composes with the existing sync `accumulate()` loop.
- Tests that call `lintErbSource` directly must `await` the same one-time load in setup.

## C6 — Non-regression contract (FR-009, SC-004)

- No change to `.css`/`.ts`/`.tsx`/`.jsx` linting. `pnpm lint:demo` output is byte-identical to
  pre-feature. The ERB path is additive: new glob, new dispatch line, new method — no edit to existing
  rule logic or the four existing `lint*Source` methods.

## C7 — Scope guard (FR-008)

`lintErbSource` runs **only** the class-attribute token pipeline. `no-style-color`,
`no-component-color-override`, `no-useless-hover` are not invoked for `.erb` and produce no ERB output.
