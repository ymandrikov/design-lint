# Contract: `lint-color/linter.ts` exported surface

The migrated module MUST export exactly this factory, and the factory MUST return exactly
these five methods, with these names and call signatures. This is the contract the three
importers (`lint-color/index.js`, `lint-color/linter.test.ts`,
`lint-color/linter.lintCss.test.ts`) depend on; it is unchanged from the JavaScript module
(FR-002).

## `createLinter(config, tokens, ansi)`

Build an in-memory linter bound to a rule config, a resolved token set, and an ANSI colorizer.

- **Parameters**:
  - `config` — per-rule config map (`Record<string, RuleConfig>`, `RuleConfig = { enabled?: boolean; [key: string]: unknown }`). The caller passes `config.rules ?? {}`.
  - `tokens` — the resolved token set: `semanticSet`, `spectralSet`, `colorPrefixes`, `uiComponents`, `isValidTailwindCandidate`.
  - `ansi` — the colorizer (`{ red, blue, … }`); only `red`/`blue` are read by rules, extra members (e.g. `dim`) are accepted structurally.
- **Returns**: an object of the five `lint*Source` methods below.
- **Behavior** (preserved): builds the disabled-rules set from `enabled === false`; closes over `config`/`tokens`/`ansi` for every dispatch.
- **Callers**: `index.js` (`createLinter(config.rules ?? {}, tokens, ansi)`) and both test suites (`createLinter(rules, minimalTokens, ansi)`).

## Returned methods

Each returns `{ violations: { line: number; message: string; ruleId: number }[]; ignores: number[] }`.

### `lintTailwindSource(source: string, filePath: string)`

Parse the source, walk `className`/`class` JSX attribute values, run the full token pipeline on
each static class string; `ignores` is the sorted `color-lint-ignore` line set.

### `lintStyleSource(source: string, filePath: string)`

Run the `no-style-color` rule (inline `style={{ color/backgroundColor }}`); `ignores` is `[]`.

### `lintHoverSource(source: string, filePath: string)`

Run the `no-useless-hover` rule (hover: on non-interactive elements); `ignores` is `[]`.

### `lintComponentSource(source: string, filePath: string)`

Run the `no-component-color-override` rule (shadcn UI component color overrides); `ignores` is `[]`.

### `lintCssSource(source: string, isExempt: boolean)`

Walk the PostCSS CST — declaration values (`no-raw-css-color` `checkValue`) and `@apply` params
(the full token pipeline) — with `color-lint-ignore` comment suppression; a malformed-CSS
parse returns `{ violations: [], ignores: [] }`. Exempt (color-token) files count ignores but
skip color rules.

## Contract tests

Two dedicated Vitest suites already exercise this contract and MUST stay green with no
assertion edits (only their import specifier changes to `./linter.ts`):

- **`linter.test.ts`** — per-rule enable/disable gating across all ten rules, bracket-/quote-aware split integrity, driven through `lintTailwindSource`/`lintStyleSource`/`lintHoverSource`/`lintComponentSource`.
- **`linter.lintCss.test.ts`** — the `lintCssSource` path.

Plus the end-to-end gates:

- **`pnpm typecheck`** — proves the factory, its five methods, the dispatch helpers, and the violation records type-check with no implicit or unjustified `any`.
- **`pnpm lint:demo`** — drives the engine through `index.js` over `fixtures/demo-app`; the resulting violations (**23 violations, 1 suppressed**) must be byte-for-byte identical to the pre-migration run.
