# Research: Namespace-Aware Color Classification

**Feature**: 014-namespace-color-classify | **Date**: 2026-07-08

## Investigation summary

Traced the actual false-positive path through `lint-color/`. The classifier
(`classify.ts`) already returns `null` (not-a-color) for `text-sm` — so the
false positives do **not** originate there. They come from two rules that fire
on **color-prefix presence**, independent of the color verdict:

- **`no-undefined-token`** (`rules/no-undefined-token.ts:30`) flags a class when
  `isValidTailwindCandidate(base)` is `false`. It is the source of bucket 3
  (`text-sm`, `text-xs`, `text-lg`, `shadow-lg`, …).
- **`token-constraints`** (`rules/token-constraints.ts:41`) flags a class only
  when `semanticSet.has(colorPart)` — i.e. the target actually defines
  `--color-<value>`. It is the source of bucket 2's `text-base` (678×).

The `isValidTailwindCandidate` oracle is built in `index.ts:83-115` via
`__unstable__loadDesignSystem(entryCSS, …)` where `entryCSS` is **only the first
color-token file** (`config.colorTokenFiles[0]`). That design system therefore
knows the target's `--color-*` semantic tokens but **not** Tailwind's default
non-color namespaces (`--text-*` font sizes, `--shadow-*`, `--*-width`). So
`candidatesToCss(["text-sm"])` returns empty → `text-sm` looks "invalid" →
`no-undefined-token` reports it as an undefined token. **This is the root cause.**

---

## Decision 1: Detect non-color resolution with a namespace-complete design system

**Decision**: Add a purpose-built resolver that answers *"does `<prefix>-<value>`
resolve to a non-color CSS property?"* by compiling the candidate against a
**namespace-complete** Tailwind design system — Tailwind's default theme
(font-size, shadow, width, radius, …) merged with the target's color tokens —
and inspecting the resulting CSS declarations. A class whose compiled output
contains **only non-color properties** is not a color reference and is dropped
before any color rule runs.

**Rationale**: This mirrors Tailwind's own resolution exactly (existence-lookup
of a synthesized `--namespace-value`, validated against `.repos/tailwindcss`
`theme.ts:168` `#resolveKey`). Because classification is by *resolved property*,
never by a suffix string, any future scale value Tailwind adds is handled with
zero code change (FR-006, User Story 3). One mechanism covers every overloaded
prefix (FR-002, clarification Q2 = A).

**Alternatives considered**:
- *Hardcoded suffix denylist* (`sm`, `xs`, `base`, `lg`, `xl`, …): rejected —
  rots on every new Tailwind scale value, violates FR-006.
- *Manual prefix→namespace table in the linter*: rejected — duplicates Tailwind's
  resolution and drifts from upstream; the constitution requires vendored parity
  logic to cite upstream, not re-derive it.

## Decision 2: Keep the existing color-token-only oracle for `no-undefined-token`

**Decision**: Do **not** enrich the existing `isValidTailwindCandidate` (the
color-token-only design system). Add the namespace-complete resolver as a
**separate, additive filter** that runs first and only *removes* non-color
candidates from scope. Surviving candidates are judged exactly as today.

**Rationale**: `no-undefined-token` currently flags `bg-black`, `text-white`,
`ring-black` (spec US2 scenario 4 requires these to stay flagged) precisely
because the color-token-only oracle rejects Tailwind's default palette colors.
If the oracle were made namespace-complete, `bg-black` would become a "valid
candidate" and silently stop being flagged — a regression. Keeping the two
design systems separate preserves every true positive:

| Class | Full-theme resolve | Non-color filter | Color-token oracle | Result |
|---|---|---|---|---|
| `text-sm` | `font-size` | drop | — | not reported ✅ (fix) |
| `shadow-lg` | box-shadow size | drop | — | not reported ✅ (fix) |
| `bg-black` | `background-color` (color) | keep | invalid → flag | reported ✅ (preserved) |
| `text-accnt` (typo) | no resolution | keep | invalid → flag | reported ✅ (preserved, Q1=B) |
| `bg-accent/50` | color | keep | valid | opacity rule fires ✅ |

**Alternatives considered**:
- *Single enriched oracle*: rejected — collapses the "valid Tailwind class" and
  "valid semantic-token class" distinctions, regressing `bg-black`/`text-white`.

## Decision 3: `text-base` stays flagged — strict Tailwind mirroring (⚠ revises SC-001)

**Finding**: The target defines `--color-base` (proven: `token-constraints` only
fires when `semanticSet.has("base")`). For the `text-` utility, Tailwind checks
the **color** namespace *before* font-size (validated: `utilities.ts:5327` color
branch precedes `5335` font-size branch; precedence `--text-color-* > --color-* >
--text-*`). So `--color-base` **shadows** the `text-base` font-size utility —
Tailwind compiles `text-base` to `color: var(--color-base)`, not a font size.

**Decision**: Under "mirror Tailwind exactly," `text-base` **is** a color
reference and `token-constraints` correctly flags it (the developer's `text-base`
silently became a color, and that color is not allowed behind `text-`). The
namespace-complete resolver — because it merges the target's color tokens —
resolves `text-base` to a color property and does **not** drop it.

**Consequence for the spec**: SC-001 over-counted. The true false-positive
removal is **~1268** (`text-sm` 572 + `text-xs` 543 + `text-lg` 125 + `text-xl` 9
+ `shadow-*` ~19, plus `text-2xl/3xl` tail), **not** ~1946. The 678 `text-base`
findings are Tailwind-correct true positives and **remain**.

**Recommendation**: Correct **SC-001** to "~1268 findings from non-color
utilities drop to zero" and add a note under **SC-002** that `text-base` (678)
is preserved as a genuine color resolution. This is a metric correction only —
the mechanism is unchanged and strictly more faithful to the user's stated goal
("a class is a color reference only if its value resolves under `--color-*`").
Flagged for user confirmation before `/speckit-tasks`.

## Decision 4: One filter seam for all color rules

**Decision**: Apply the non-color filter at the single per-candidate dispatch
point where `composeColorParts` is consumed (the linter's token loop / rule
fan-out in `linter.ts`), so a dropped candidate is invisible to **every** color
rule uniformly — `no-undefined-token`, `token-constraints`, `no-spectral-color`,
`no-opacity-modifier`, `no-raw-css-color`, `no-var-color`.

**Rationale**: FR-002 mandates one general mechanism; FR-003 requires *no* color
rule to fire on a non-color class. A single seam guarantees both and keeps each
rule single-concern (Constitution I). It also keeps cost at one compile per
candidate (Constitution IV / FR-008) — the filter reuses the same
`candidatesToCss` call shape the linter already performs.

**Alternatives considered**:
- *Per-rule guards*: rejected — six edits, drift risk, violates single-mechanism
  FR-002 and invites a rule that forgets the guard.

## Decision 5: Color-property predicate by inversion

**Decision**: Classify a compiled declaration's property as color vs non-color
using an explicit **color-property** predicate (extend the existing
`CSS_COLOR_PROPERTIES` in `classify.ts:45` — currently only `color`,
`background-color` — to the full set: `border-color`, `outline-color`,
`text-decoration-color`, `fill`, `stroke`, `caret-color`, `accent-color`,
`--tw-shadow-color`, `--tw-gradient-*`, and custom props `--*`). A candidate is
**non-color** iff it compiles to ≥1 declaration and **none** is a color property.
Compiles-to-nothing ⇒ keep (Q1=B).

**Rationale**: Enumerating color properties is finite and stable; inverting is
safer than enumerating the open-ended non-color set. Custom-property outputs
(`--tw-shadow-color`) must count as color so a `shadow-<color>` stays in scope.

**Open item for Phase 1**: confirm the exact shape `candidatesToCss` returns
(raw CSS text vs. structured declarations) so the property extraction is robust;
pin with a vendored parse or a minimal declaration-split. Captured in
`data-model.md` and the quickstart validation.

---

## Resolved unknowns

| Unknown | Resolution |
|---|---|
| Where do FPs originate? | `no-undefined-token` + `token-constraints`, not the classifier |
| Why is `text-sm` "invalid"? | Oracle design system loads only color tokens, lacks `--text-*` |
| Is `text-base` a real FP? | No — `--color-base` shadows it; Tailwind resolves to color (D3) |
| How to stay future-proof? | Resolve via namespace-complete design system, never a suffix list (D1) |
| How to preserve `bg-black`? | Keep the color-token oracle separate; filter is additive (D2) |
| One mechanism for all prefixes? | Single filter seam at the dispatch point (D4) |
