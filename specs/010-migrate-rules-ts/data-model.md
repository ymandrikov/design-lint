# Phase 1 Data Model: Migrate `lint-color/rules/**` JS → TS

This migration introduces **no new runtime data**. It types the shapes the rule layer already
passes at runtime. The `parts`/`tokens` surfaces reuse the classifier's exported runtime
contracts (`classify.ts`); the `ctx`/`Ansi`/`report` shapes are small self-contained local
types per rule, matching the `no-spectral-color.ts` and `linter.ts` precedent. The "entities"
below are the type surfaces each migrated rule is written against — not new state.

## Reused classifier contracts (source of truth: `classify.ts`, UNCHANGED)

| Type | Shape | Role |
|------|-------|------|
| `ColorParts` | `{ variants: string[]; base: string; modifier: string \| null; colorPrefix: string \| null; colorPart: string \| null; arbitraryProperty: string \| null; arbitraryValue: string \| null }` | The composed color-parts record a token rule destructures. Imported from `classify.ts`; `linter.ts` passes the non-null form to `checkToken`. |
| `Tokens` | `{ semanticSet?: Set<string>; spectralSet?: Set<string> }` | The classifier's token-set input; rules that call `classifyParts`/`classifyColorPart` type their `ctx.tokens` as this (extended locally where a rule also reads `colorPrefixes`/`uiComponents`/`isValidTailwindCandidate`). |
| `ColorVerdict` | `"semantic" \| "spectral" \| "static" \| "raw" \| "var" \| null` | The classifier verdict `no-var-color`/`no-opacity-modifier`/`no-raw-css-color` branch on. |

## Per-rule local types (declared in each rule, matching `no-spectral-color.ts`)

| Type | Shape | Role |
|------|-------|------|
| `Ansi` | `{ red(s: string): string; blue(s: string): string }` | Colorizer passed in `ctx`; declared locally per rule. |
| `ReportFn` | `(line: number, message: string) => void` | How `lintSource` rules emit a violation. |
| `Ctx` (token rules) | `{ tokens: <narrowed>; ansi: Ansi; ruleConfig?: … }` | Local `ctx` carrying exactly the fields the rule reads. `ruleConfig?` is optional because `linter.ts`'s dispatch ctx omits it and matches methods bivariantly. |
| `Ctx` (source rules) | `{ report: ReportFn; ansi: Ansi; tokens?: <narrowed>; ruleConfig?: … }` | Local `ctx` for `lintSource` rules. |

## Rule inventory (nine modules migrated)

Each row lists the module's public surface. `id`/`name` values are preserved exactly; each
entrypoint keeps its name/arity/return type and gets typed params (`parts: ColorParts`,
`tokens: Tokens`-derived, a local `ctx`).

| Module (`.js`→`.ts`) | `id` | Exported entrypoint(s) | Shape | Internal helpers typed |
|----------------------|------|------------------------|-------|------------------------|
| `no-style-color` | 1 | `lintSource` | `(source, filePath, ctx) => void` | JSX walk locals (oxc `Node` narrowing) |
| `no-raw-css-color` | 2 | `checkToken`, `findRawColor(value)`, `checkValue` | `checkToken/checkValue → string \| null`; `findRawColor(value: string): string \| null` | `valueParser` node walk (typed by the bundled `postcss-value-parser` `.d.ts` — **no `any` needed**), `isColor` call |
| `no-opacity-modifier` | 3 | `checkToken` | `(rawTok, parts, ctx) => string \| null` | `classifyColorPart` call |
| `token-constraints` | 5 | `checkToken` | `(rawTok, parts, ctx) => string \| null` | `matchPattern(value, pattern): boolean`, local `PatternMap` for `ruleConfig` |
| `no-var-color` | 6 | `checkToken` | `(rawTok, parts, ctx) => string \| null` | `classifyParts` call |
| `no-dark-variant` | 9 | `checkToken` | `(rawTok, parts, ctx) => string \| null` | — |
| `no-useless-hover` | 10 | `lintSource` | `(source, filePath, ctx) => void` | `INTERACTIVE_TAGS`/`TABLE_ROW_TAGS`/`INTERACTION_PROPS`/`INTERACTIVE_ROLES` (`Set<string>`), `attrStringValue(attr: JSXAttribute)`, `elementIsInteractive(opening: JSXOpeningElement, tagName, extraInteractiveTags)` |
| `no-component-color-override` | 11 | `lintSource`, `isColorToken(tok, tokens)` | `(source, filePath, ctx) => void` | imports `findRawColor` from `no-raw-css-color.ts`, `classifyColorPart`/`composeColorParts` calls, local `OverrideTokens extends Tokens` |
| `no-undefined-token` | 12 | `checkToken` | `(rawTok, parts, ctx) => string \| null` | — |

`no-spectral-color` (`id` 4) is already TypeScript and **not** in this inventory.

## Cross-rule dependency

```text
no-component-color-override  ──imports findRawColor──▶  no-raw-css-color
```

Both are migrated in this change; the import specifier flips `"./no-raw-css-color.js"` →
`"./no-raw-css-color.ts"`. `findRawColor`'s signature (`(value: string) => …`) is preserved so
the caller is unaffected.

## Invariants preserved

- **Identity of `id` and `name`**: every rule keeps its exact numeric `id` and kebab-case `name` string. The registry, suppression accounting, and rule-grouping in the report depend on these.
- **Entrypoint signatures**: parameter order/arity and return type (`string | null` for token/value rules; `void` for `lintSource`) are unchanged — the linter dispatches through them.
- **No new fields on `ctx` or `parts`**: rules read the same `ctx`/`parts` members as before; the migration names their types, it does not add or rename members.
