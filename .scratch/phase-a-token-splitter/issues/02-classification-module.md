# 02 — Classification module; de-corrupt bracketed candidates (finding #5)

Status: done
Type: task

## Parent

`.scratch/phase-a-token-splitter/PRD.md`

## What to build

The classification layer, end-to-end: a new classification module owning `splitColorToken`, `classifyColorPart`, `findColorPrefix`, and the spectral-color / color-prefix constant sets — plus its consumption in the existing pipeline so bracketed candidates stop being corrupted (review finding #5).

Splitter contract (locked in PRD §Implementation Decisions — do not re-litigate): depth tracking over `[]` and `()`; Tailwind variants split on every depth-0 `:` returned as array; Modifier split on last depth-0 `/`, `null` when absent; important `!` (leading/trailing) stripped silently; unbalanced brackets never throw. Hand-rolled — Tailwind's `parseCandidate` is a test oracle only (ADR 0001).

The existing normalizer becomes a thin deprecated wrapper over the splitter so every current call site inherits bracket-awareness without signature changes. Red→green: failing test for the `text-[color:red]` corruption first.

## Acceptance criteria

- [x] `splitColorToken("hover:bg-primary/[0.5]")` → variants `["hover"]`, base `bg-primary`, modifier `[0.5]`
- [x] `splitColorToken("text-[color:red]")` → base kept whole, no variant split on the inner `:`
- [x] `splitColorToken("data-[state=open]:hover:bg-x")` → variants `["data-[state=open]", "hover"]`
- [x] Paren shorthand (`bg-(--my-color)`, `/(--alpha)`) and important marker (v3 `!` prefix, v4 `!` suffix) handled per contract
- [x] Unbalanced-bracket input returns best-effort parts, never throws
- [x] `classifyColorPart` distinguishes semantic / spectral (numeric shade required, segment scan preserved for `divide-x-red-500`-style bases) / arbitrary / not-a-color
- [x] `findColorPrefix` longest-match (e.g. `ring-offset` beats `ring`), covered by a test
- [x] Curated edge-token fixture list exported from one module; exact-output test consumes it
- [x] Oracle test: splitter agrees with the design system's `parseCandidate` on every fixture token it can parse
- [x] Behavior proven at the linter seam: previously-corrupted candidates flow through `lintTailwindSource` uncorrupted
- [x] Existing normalizer delegates to the splitter; all existing tests pass unchanged
- [x] Demo lint output diff vs issue 01 baseline shows no unexplained changes

## Blocked by

- `01-capture-demo-baseline.md`

## Comments

**2026-07-06 — implemented.** New `lint-color/classify.js` owns `splitColorToken`,
`classifyColorPart`, `findColorPrefix`, and the spectral-color / color-prefix
constant sets (moved from `shared.js`, re-exported there for back-compat).
`normalizeTwToken` is now a deprecated thin wrapper over `splitColorToken`, so
the pipeline inherits bracket-aware variant/modifier splitting (finding #5):
`text-[x:bg-nope]` no longer corrupts to `bg-nope]` and false-fires
no-undefined-token. Curated edge-token fixtures in `lint-color/edge-tokens.ts`
feed both the exact-output and `parseCandidate` oracle tests.

Red→green proof: `lint-color/linter.test.ts` "bracket-aware token splitting
(finding #5)". Full project suite (207 lint-color + 3 e2e) green; tsc clean;
demo drift gate byte-identical to issue 01 baseline.

Code review (3 finder angles + verify) fixed two issues before commit:
`classifyColorPart` now checks arbitrary (`[`/`(`) before the spectral segment
scan (so `bg-(--red-500-rgb)` classifies arbitrary, not spectral); the oracle
test now compares live `splitColorToken` output to `parseCandidate` instead of
the fixture table. A low-severity note (deprecated wrapper still re-splits on
`/`, so a base containing a slash isn't fully preserved) is pre-existing, not a
regression, and resolved by the v1.1 parts migration (issue 04); comment
tightened to not overclaim.
