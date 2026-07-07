# Phase 1 Data Model: classify.ts

The module has no persisted data. Its "entities" are the in-memory shapes the classification
functions pass and return — each already exists structurally in `classify.js`; the migration
gives each a name. Field names/shapes are fixed by the current runtime output and downstream
destructuring; only the types are added.

## `ColorVerdict` (union)

The result of classifying a color part or value.

| Value | Meaning |
|-------|---------|
| `"semantic"` | design-token name (`primary`) |
| `"spectral"` | palette color + shade (`red-500`) |
| `"static"` | keyword color (`black`, `transparent`) |
| `"raw"` | literal color (`[#fff]`, `[var(--x,red)]`) |
| `"var"` | clean CSS-var reference (`(--x)`, `[var(--x)]`) |
| `null` | not a color |

`ColorVerdict = "semantic" | "spectral" | "static" | "raw" | "var" | null`

Returned by `classifyColorPart`, `classifyParts`, and (as the non-null subset `"var" | "raw" |
null`) the internal `classifyArbitraryColor` / `classifyColorValue` / `classifyVarReference`.

## `Tokens`

The design-system token sets a classification consults. Both fields optional.

- `semanticSet?: Set<string>` — semantic design-token names.
- `spectralSet?: Set<string>` — Tailwind spectral palette names.

Input to `classifyColorPart` and `classifyParts`. `findSpectralMatch` takes the
`spectralSet` alone (possibly `undefined`) and returns `null` when it is missing.

## `SplitToken`

First decomposition of a raw candidate, from `splitColorToken`.

- `variants: string[]` — leading `:`-separated variant segments.
- `base: string` — the utility base after important-marker and modifier stripping.
- `modifier: string | null` — the single trailing `/`-modifier, else `null`.

## `SpectralMatch`

A palette-name-plus-shade hit inside a color part, from `findSpectralMatch`.

- `name: string` — the palette name (`red`).
- `shade: string` — the numeric shade (`500`).

Returned as `SpectralMatch | null`. Consumed for the `"spectral"` verdict and by
`no-spectral-color` for its replacement hint.

## `ArbitraryProperty`

A parsed whole-base `[property:value]`, from `parseArbitraryProperty`.

- `property: string` — the property name (`color`, `--x`).
- `value: string` — the still-undecoded value side.

Returned as `ArbitraryProperty | null`.

## `ColorParts`

The full composition of a candidate, from `composeColorParts` (or `null` when the raw token is
not a candidate). Superset of `SplitToken`.

- `variants: string[]`, `base: string`, `modifier: string | null` — from the split.
- `colorPrefix: string | null` — the longest matching color prefix (`bg`, `text`, …), else `null`.
- `colorPart: string | null` — `base` with `colorPrefix-` removed, else `null`.
- `arbitraryProperty: string | null` — the property of a whole-base `[prop:value]`, else `null`.
- `arbitraryValue: string | null` — the value of a whole-base `[prop:value]`, else `null`.

The subset `{ colorPart, arbitraryProperty, arbitraryValue }` is the `parts` argument
`classifyParts` reads.

## Exported constants (typed, values unchanged)

- `TAILWIND_SPECTRAL_COLORS: Set<string>` — 22 palette names.
- `TAILWIND_STATIC_COLORS: Set<string>` — `black white transparent current inherit`.
- `CSS_COLOR_PROPERTIES: Set<string>` — `color background-color`.
- `TAILWIND_COLOR_PREFIXES: string[]` — the ordered color-utility prefixes.

## Notes

- No field name, set membership, or array element changes. This document names the shapes the
  code already produces; runtime structure is byte-identical before and after (SC-004).
