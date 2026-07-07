# Phase 1 Data Model: AST layer types

Types introduced by the migration. All AST-node types (`Program`, `Comment`, `Node`,
`StringLiteral`, `TemplateElement`, `ObjectExpression`, `ObjectProperty`, `JSXIdentifier`,
`JSXNamespacedName`, `JSXMemberExpression`, `Expression`, etc.) are imported from `oxc-parser`
(re-exporting `@oxc-project/types`), not redefined. Only the module's own structures are named
here.

## `Lang`

```
type Lang = "tsx" | "ts";
```

Chosen by `langForFile`: `.tsx`/`.jsx` → `"tsx"`, everything else → `"ts"` (FR-005). Cache key
component.

## `ParsedAst`

The value `parseSource` returns and every rule consumes (Key Entity: *Parsed AST value*).

| Field | Type | Notes |
|-------|------|-------|
| `program` | `Program` | oxc parse result program (from `ParseResult.program`). |
| `comments` | `Comment[]` | oxc comment list (`{ type, value, start, end }`). |
| `lineStarts` | `number[]` | Offset of each line start, from `buildLineStarts`. |
| `ignored` | `Set<number> \| null` | Lazily filled by `ignoredLines`; `null` until first call (FR-007). |

Validation / invariants:
- `program` and `comments` come straight from `parseSync`; structure unchanged from today.
- `ignored` starts `null`; once computed it is memoized on this object and never recomputed for
  the same parse (single-compute per file, constitution IV).

## `ParseCache`

Module-level LRU-1 memo (Key Entity: *Parse cache*).

| Field | Type | Notes |
|-------|------|-------|
| `source` | `string \| null` | Last parsed source text; `null` at init. |
| `lang` | `Lang \| null` | Language of the last parse; `null` at init. |
| `ast` | `ParsedAst \| null` | Last parsed value; `null` at init. |

Invariant: a cache hit requires **both** `source` and `lang` to match the incoming request
(FR-005) — guarantees one parse per `(source, lang)` and correct re-parse when language differs.

## `ClassStatic`

Result element of both className extractors (Key Entity: *Extraction results*).

```
type ClassStatic = { text: string; node: Node };
```

- `classNameStatics(value)` → `ClassStatic[]` — shallow: plain `StringLiteral` and
  `TemplateLiteral` static quasis only (FR-008).
- `classNameStaticsDeep(value)` → `ClassStatic[]` — deep: every `StringLiteral` and
  `TemplateElement` reached by `walk`, descending into call args (FR-008).

`text` is the literal's string value (or a template chunk's `cooked ?? raw ?? ""`); `node`
carries the offset used to locate the class.

## `StyleProp`

Result element of `styleObjectProps` (Key Entity: *Extraction results*).

```
type StyleProp = { keyName: string; valueNode: Expression; node: ObjectProperty };
```

- Produced only from a `style={{…}}` `ObjectExpression`, after unwrapping
  `TSAsExpression` / `TSSatisfiesExpression` / `ParenthesizedExpression` (FR-009).
- `SpreadElement` properties are skipped; computed keys that are not literals are dropped;
  identifier and literal keys resolve to `keyName` (FR-009).
- `style={expr}` (non-object) → `[]`.

## Export surface (unchanged — FR-002)

`buildLineStarts`, `offsetToLine`, `parseSource`, `walk`, `jsxName`, `ignoredLines`,
`classNameStatics`, `classNameStaticsDeep`, `styleObjectProps`. Names and call signatures
identical before/after; only types are added. Internal helpers (`langForFile`,
`collectClassStatics`, `objectExpressionOf`, `propKeyName`) stay module-private and typed.
