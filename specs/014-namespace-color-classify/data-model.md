# Data Model: Namespace-Aware Color Classification

**Feature**: 014-namespace-color-classify | **Date**: 2026-07-08

This is a linter, not a data application — the "entities" are the classification
concepts that flow through `lint-color/`. No persistence.

## Entity: Namespace kind

The category a candidate's value resolves into, derived from the compiled CSS
property, not from the class string.

| Kind | Meaning | Example inputs | Effect |
|---|---|---|---|
| `color` | Compiles to ≥1 color property | `bg-accent`, `text-red-500`, `bg-black`, `text-base` (target defines `--color-base`) | In scope for color rules |
| `non-color` | Compiles to ≥1 declaration, **none** a color property | `text-sm`, `text-base` (if `--color-base` absent), `shadow-lg`, `border-2`, `ring-2`, `outline-2` | **Dropped** — no color rule inspects it |
| `unresolved` | Compiles to nothing | `text-accnt` (typo), `bg-notacolor` | In scope (Q1=B) — undefined-token rule may flag |

State rule: a candidate is `non-color` **iff** `compiled.length > 0 AND none of
compiled is a color property`. Otherwise it is in scope (`color` or `unresolved`
are both treated as color references for filtering purposes).

## Entity: Color-property predicate

Extends `classify.ts:45` `CSS_COLOR_PROPERTIES`. A property is a **color
property** if it is a custom property (`--*`) or one of:

```
color, background-color, border-color,
border-{top,right,bottom,left}-color,
outline-color, text-decoration-color,
fill, stroke, caret-color, accent-color,
--tw-shadow-color, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to,
--tw-ring-color, --tw-ring-offset-color
```

Validation rules:
- Custom properties (`--tw-shadow-color`, `--tw-ring-color`) MUST count as color
  so `shadow-<color>` / `ring-<color>` stay in scope.
- Width/size/image properties (`font-size`, `box-shadow`, `border-width`,
  `border-*-width`, `outline-width`, `background-image`, `text-decoration-thickness`)
  are non-color by omission.
- Predicate is a pure function of the property name; no value inspection.

## Entity: Namespace-complete design system

A second Tailwind design system used only as the resolution oracle for the
non-color filter.

| Attribute | Value |
|---|---|
| Source | Tailwind default theme (all namespaces) **merged** with the target's color-token CSS |
| Built by | `__unstable__loadDesignSystem` in `index.ts`, entry CSS that pulls Tailwind defaults + `@theme` color tokens |
| Query | `candidatesToCss([base]) → string[]` → parsed to properties |
| Lifetime | Built once at startup, reused across all files/candidates (Constitution IV) |
| Distinct from | The existing color-token-only oracle behind `isValidTailwindCandidate` — that one is kept as-is for undefined-token/spectral flagging (research D2) |

Merge rule (research D3): because the target's `--color-*` tokens are merged in,
a value defined as both a color token and a default size (e.g. `base`) resolves
**color-first** for `text-`, exactly as Tailwind does — so `text-base` is `color`,
not `non-color`.

## Entity: Filter seam

The single dispatch point (in `linter.ts`, where `composeColorParts` output is
fanned out to rules) at which a `non-color` candidate is skipped.

| Attribute | Value |
|---|---|
| Input | `base` (candidate with variants/modifier stripped), the namespace-complete resolver |
| Output | Skip (non-color) vs proceed (color/unresolved) |
| Guarantee | FR-003 — when it skips, **no** color rule emits a finding for that class |
| Scope note | Only applies where a `colorPrefix` is present; prefix-less arbitrary properties keep their existing path |

## Relationships

```
candidate (raw class token)
  └─ composeColorParts ──► ColorParts { colorPrefix, colorPart, base, ... }
        └─ [NEW] non-color filter (namespace-complete resolver + color-property predicate)
              ├─ non-color  ──► DROP (skip all color rules)
              └─ color/unresolved ──► existing rule fan-out
                    ├─ no-undefined-token  (color-token-only oracle)
                    ├─ token-constraints   (semanticSet)
                    ├─ no-spectral-color
                    ├─ no-opacity-modifier
                    └─ no-raw-css-color / no-var-color
```

## Invariants

- **INV-1**: A class dropped by the filter produces zero findings from any color
  rule (FR-003).
- **INV-2**: A class the filter keeps is judged byte-for-byte as before this
  feature — no message, count, or verdict changes (FR-004).
- **INV-3**: The filter decision depends only on the target's design system +
  Tailwind defaults, never on a hardcoded value suffix (FR-006).
- **INV-4**: Exactly one candidate compile per token feeds both the filter and
  the undefined-token oracle where possible; no double parse of source (FR-008).
