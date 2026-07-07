# Contract: `lint-color/ast.ts` exported surface

The AST layer's public surface. Names and runtime call signatures MUST be identical before and
after migration (FR-002); the migration only adds types. Node-type names below are from
`oxc-parser` / `@oxc-project/types`.

## Exports

### `buildLineStarts(src: string): number[]`
Offset of each line start (index 0 = offset 0, then each char after a `\n`). Pure.

### `offsetToLine(lineStarts: number[], offset: number): number`
Binary-search a byte/char offset to its 1-based line. Pure.

### `parseSource(source: string, filePath?: string): ParsedAst`
`filePath` default `"file.tsx"`. Returns the cached `ParsedAst` when `(source, lang)` matches the
last call (LRU-1); otherwise parses once via `parseSync(filePath, source, { lang })`, where
`lang = langForFile(filePath)`. Walks oxc's best-effort recovered program on syntax error (never
throws on bad syntax). See [data-model](../data-model.md#parsedast).

### `walk(node: unknown, enter: (node: Node) => void): void`
Depth-first traversal. Calls `enter(node)` for every value with a string `type`. Skips `parent`
back-references and the `type` key when recursing; ignores non-object values. `node` is `unknown`
so both whole programs and extracted sub-nodes are valid arguments.

### `jsxName(node: JSXIdentifier | JSXNamespacedName | JSXMemberExpression | null | undefined): string`
Resolves a JSX element/attribute name node to source text: `<div>`→`"div"`,
`<Dialog.Trigger>`→`"Dialog.Trigger"`, `<svg:a>`→`"svg:a"`. Returns `""` for null/unknown node
types. (Recursive on `JSXMemberExpression`.)

### `ignoredLines(ast: ParsedAst): Set<number>`
Set of 1-based lines suppressed by a standalone `color-lint-ignore` comment marker, scoped to the
marker's physical line. Memoized on `ast.ignored`. No superstring match, no className match.

### `classNameStatics(value): ClassStatic[]`
Shallow static class strings from a `className`/`class` attribute value: plain `StringLiteral`
and `TemplateLiteral` static quasis only; unwraps `JSXExpressionContainer`. Each element
`{ text, node }`.

### `classNameStaticsDeep(value): ClassStatic[]`
Deep static strings reachable inside the value via `walk` — every `StringLiteral` and
`TemplateElement`, descending into call args (cn/clsx/…). Each element `{ text, node }`.

### `styleObjectProps(attrValue): StyleProp[]`
Own properties of a `style={{…}}` object literal as `{ keyName, valueNode, node }`. Object
detected via the AST (unwraps `as`/`satisfies`/parenthesized); skips spreads; drops non-literal
computed keys. Returns `[]` for `style={expr}`.

## Consumers (import-specifier edits, FR-003)

| Importer | Current specifier | New specifier |
|----------|-------------------|---------------|
| `lint-color/linter.js` | `./ast.js` | `./ast.ts` |
| `lint-color/helpers.ts` | `./ast.js` | `./ast.ts` |
| `lint-color/rules/no-component-color-override.js` | `../ast.js` | `../ast.ts` |
| `lint-color/rules/no-useless-hover.js` | `../ast.js` | `../ast.ts` |
| `lint-color/rules/no-style-color.js` | `../ast.js` | `../ast.ts` |

## Invariants (verification targets)

- `pnpm typecheck` → 0 errors, module body within coverage (SC-002).
- `pnpm test` → all green, zero test edits (SC-003).
- `pnpm lint:demo` → **23 violations, 1 suppressed**, unchanged (SC-004).
- No new build/loader step (SC-005); zero unjustified `any` (SC-006).
