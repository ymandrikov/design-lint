# Contract: Non-Color Filter

**Feature**: 014-namespace-color-classify | **Date**: 2026-07-08

The interface this linter exposes here is internal (a CLI over source files) —
the "contract" is the observable classification behavior the color rules and the
e2e fixtures depend on. Stated as input → decision, so tests can pin it.

## Resolver contract

A resolver function, built once from the namespace-complete design system:

```
resolveNamespaceKind(base: string) -> "color" | "non-color" | "unresolved"
```

- `base` is the candidate with variants and modifier already stripped
  (`ColorParts.base`).
- Backed by `candidatesToCss([base])` against the merged design system.
- Pure w.r.t. a fixed design system; deterministic.

| Input `base` | Compiles to | Returns |
|---|---|---|
| `text-sm` | `font-size: …` | `non-color` |
| `text-lg` | `font-size: …` | `non-color` |
| `shadow-lg` | `box-shadow: …` | `non-color` |
| `border-2` | `border-width: …` | `non-color` |
| `ring-2` | `--tw-ring-*: …` width | `non-color` |
| `outline-2` | `outline-width: …` | `non-color` |
| `bg-accent` | `background-color: …` | `color` |
| `text-red-500` | `color: …` | `color` |
| `bg-black` | `background-color: …` | `color` |
| `text-base` (target defines `--color-base`) | `color: …` | `color` |
| `shadow-accent` | `--tw-shadow-color: …` | `color` |
| `text-accnt` (typo) | (nothing) | `unresolved` |

## Filter contract

At the dispatch seam:

```
if colorPrefix != null AND resolveNamespaceKind(base) == "non-color":
    skip candidate  # no color rule runs
else:
    run existing color-rule fan-out
```

**Guarantees**:

- **C-1** (FR-003): a `non-color` candidate yields **zero** findings from
  `no-undefined-token`, `token-constraints`, `no-spectral-color`,
  `no-opacity-modifier`, `no-raw-css-color`, `no-var-color`.
- **C-2** (FR-004 / INV-2): a `color` or `unresolved` candidate produces the
  **identical** findings it produced before this feature.
- **C-3** (Q1=B): `unresolved` is **not** skipped — typo'd token names still
  reach `no-undefined-token`.
- **C-4** (FR-006): adding a Tailwind scale value the linter has never seen
  changes the resolver result with **no linter code change**.
- **C-5** (FR-008): at most one candidate compile per token feeds the decision.

## Color-property predicate contract

```
isColorProperty(property: string) -> boolean
```

Returns true for `--*` custom properties and the enumerated color properties
(see data-model.md). Returns false for `font-size`, `box-shadow`,
`border-width`, `border-*-width`, `outline-width`, `background-image`,
`text-decoration-thickness`, and any other non-color property.

**A candidate is `non-color` iff** its compiled declarations are non-empty and
`isColorProperty` is false for **all** of them.

## Regression contract (fixtures)

A committed fixture mixing color and non-color classes MUST assert the exact
violation set (SC-005, FR-009):

- non-color utilities present (`text-sm`, `text-base` variants, `shadow-lg`,
  `border-2`, `ring-2`, `outline-2`) → **not** reported.
- genuine color violations present (`text-red-500`, `bg-accent/50`, `bg-black`,
  a token-constraint break, a typo) → reported with unchanged messages/counts.
- adding a novel size value to the fixture's design system → still not reported,
  no linter source edited (C-4 / User Story 3).
