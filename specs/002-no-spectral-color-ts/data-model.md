# Phase 1 Data Model: `no-spectral-color` (TS)

No runtime data structures change. The "entities" here are the **types** the migrated
module introduces or consumes at its boundary. Sourced from the spec's Key Entities and the
Phase 0 typing decisions (R4).

## Public rule contract (unchanged surface)

| Member | Type | Notes |
|--------|------|-------|
| `id` | `number` (literal `4`) | Numeric rule id; unchanged. |
| `name` | `string` (literal `"no-spectral-color"`) | kebab-case rule name; unchanged. |
| `checkToken` | `(rawTok: string, parts: Parts, ctx: Ctx) => string \| null` | Message string on violation, else `null`. Signature unchanged. |

## `Parts` — decomposed candidate

Derived, not hand-declared: `type Parts = NonNullable<ReturnType<typeof composeColorParts>>`
(imported from `../classify.js`). Non-null because the linter guards `parts === null` and
`!parts.base` before this rule runs. Fields this rule reads:

| Field | Type | Used for |
|-------|------|----------|
| `base` | `string` | Offending class text in the message (`ansi.red(base)`). |
| `colorPrefix` | `string \| null` | Replacement lookup key + hint prefix. |
| `colorPart` | `string \| null` | Passed to `findSpectralMatch` for name+shade. |

(`variants`, `modifier`, `arbitraryProperty`, `arbitraryValue` also exist on the type but are
unread here — consumed via `classifyParts(parts, tokens)`.)

## `Ctx` — rule invocation context

Built by `checkTokenIfEnabled` in `shared.js` as `{ tokens, ansi, ruleConfig }`. Declared
locally in the rule:

| Field | Type | Used for |
|-------|------|----------|
| `tokens` | `ClassifierTokens` | Passed to `classifyParts`; supplies `spectralSet` for `findSpectralMatch`. |
| `ansi` | `Ansi` | Message coloring. |
| `ruleConfig` | `RuleConfig \| undefined` | Carries the optional `replacement` map. |

### `ClassifierTokens`

```ts
interface ClassifierTokens {
  semanticSet?: Set<string>;
  spectralSet?: Set<string>;
}
```

Matches the `tokens` param JSDoc on `classifyParts` / `findSpectralMatch`. The rule reads
`tokens.spectralSet`; `classifyParts` reads both.

### `Ansi`

```ts
interface Ansi {
  red(s: string): string;
  blue(s: string): string;
}
```

The two helpers this rule calls. The runtime `ansi` object also has `dim`; not needed here.

### `RuleConfig`

```ts
interface RuleConfig {
  replacement?: ReplacementMap;
}
```

## `ReplacementMap` — configured hint source

```ts
type ReplacementMap = Record<string, Array<Record<string, string>>>;
// prefix → [ { "name-shadeOrRange": semanticToken }, ... ]
// e.g. { text: [ { "green-400...600": "success-content" } ], bg: [ { "green-500": "success" } ] }
```

**Parsing rules preserved** (in `findReplacement`):
- Look up `replacement[colorPrefix]`; empty/missing list → no hint (`null`).
- Each entry is a single-key object; split its key at the first `-` into `name` + `range`.
- `name` must equal the matched palette `colorName`, else skip.
- `range` containing `...` → numeric `lo`/`hi`; hint applies when `lo ≤ shade ≤ hi`.
- `range` without `...` → exact shade match.
- No matching entry → `null` (violation still reported, no hint).

## Message shape (unchanged)

```
`${ansi.red(base)} — spectral color class; use a design token instead${hint}`
hint = semantic ? ` — try ${ansi.blue(colorPrefix + "-" + semantic)}` : ""
```
