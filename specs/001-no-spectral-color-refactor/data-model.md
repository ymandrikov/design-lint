# Phase 1 Data Model — Refactor `no-spectral-color`

No persistent data. These are the in-memory shapes the refactor moves between the
classifier and the rule. All already exist except **Spectral match**.

## Color verdict (existing)

The classifier's per-token result. Enum returned by `classifyColorPart` / `classifyParts`:

| Value | Meaning |
|-------|---------|
| `"spectral"` | palette color + shade (`red-500`) — this rule's fire signal |
| `"semantic"` | design-token name (`primary`) |
| `"static"` | keyword color (`black`, `transparent`) |
| `"raw"` | literal color in an arbitrary value — owned by `no-raw-css-color` |
| `"var"` | clean CSS-variable reference — owned by `no-var-color` |
| `null` | not a color |

Unchanged by this feature. The rule reads it via `classifyParts(parts, tokens)`.

## Color part (existing)

The class base with its color prefix removed — what the classifier evaluates.
Carried on the composed parts as `parts.colorPart`.

- `bg-red-500` → `red-500`
- `ring-offset-blue-200` → `blue-200` (longest color prefix `ring-offset` removed)
- `divide-x-red-500` → `x-red-500`
- `bg-primary` → `primary`
- `null` when no color prefix matched (rule then reports nothing)

## Spectral match (NEW — output of `findSpectralMatch`)

The located palette name + shade inside a color part. Sole new shape.

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `name` | string | `"green"` | a member of `spectralSet` |
| `shade` | string | `"500"` | digits following the name (kept as string; `findReplacement` parses) |

- Returns `null` when no palette-name-immediately-followed-by-a-numeric-shade pair exists in the color part.
- First match wins (scans left to right), matching the current rule's behavior for multi-segment bases.

## Replacement map (existing — rule config)

Config-supplied `ruleConfig.replacement`, consumed only to build the hint. Untouched.

```
{ <prefix>: [ { "<name>-<shadeOrRange>": <semanticToken> }, ... ] }
```

- `<shadeOrRange>` is a single shade (`500`) or an inclusive range (`400...600`).
- Looked up by `findReplacement(replacement, colorPrefix, name, shade)` using the
  `name` + `shade` from **Spectral match**.
- No hit → no hint appended; the violation still reports.
