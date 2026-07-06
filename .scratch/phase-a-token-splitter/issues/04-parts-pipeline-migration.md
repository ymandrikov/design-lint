# 04 — v1.1: parts pipeline migration, dedupe, final drift gate

Status: done
Type: task

## Parent

`.scratch/phase-a-token-splitter/PRD.md`

## What to build

The consolidation pass. Token rules migrate to `checkToken(rawTok, parts, ctx)` where `parts = { variants, base, modifier, colorPrefix, colorPart }` is composed once per token in the pipeline. Every remaining divergent splitter/classifier call site (pipeline, shared token-runner helper, spectral rule's segment scan) consumes the classification module. Token-constraints replaces its `hover:` substring sniff with the parsed Tailwind variants. The deprecated normalizer wrapper and all dead splitting code are deleted.

Behavior-preserving except the substring-sniff edge (a `hover` inside a bracket group no longer triggers the hover constraint). Closes with the final drift gate against the issue 01 baseline.

## Acceptance criteria

- [x] All token rules receive pre-split parts; none re-derives variants, base, Modifier, color prefix, or color part
- [x] Splitting/classification happens exactly once per token in the pipeline (composeColorParts, composed once in linter.js checkTailwindToken)
- [x] Token-constraints hover check driven by parsed Tailwind variants; bracket-embedded `hover` no longer triggers it (test proves it)
- [x] Spectral rule and the shared token-runner consume the classification module
- [x] Deprecated normalizer deleted; no dead splitter code remains
- [x] Full test suite and e2e green
- [x] Final demo lint diff vs issue 01 baseline: only the trigger cases fixed in issues 02–03 differ

## Comments

**2026-07-06 — implemented.** Token rules migrated to `checkToken(rawTok, parts, ctx)`; `parts` composed once per token by new `composeColorParts(rawTok, colorPrefixes)` in classify.js. Pipeline (linter.js), shared token-runner (runTokenRuleOnSource), and the no-component-color-override lintSource rule all consume it. `normalizeTwToken` deleted.

Hover check now `variants.some(v => v === "hover" || v.endsWith("-hover"))` — preserves compound hover coverage (group-hover:/peer-hover:) that the old substring sniff caught, while excluding a bracket-embedded `hover:` (the one intended behavior change). Code review flagged the naive `variants.includes("hover")` as an unintended regression on compound hovers; fixed with a locking test.

Verification: 278 tests green (incl. 2 new token-constraints cases); typecheck clean; `node lint-color/index.js fixtures/demo-app` byte-identical to the post-issue-03 output (zero further drift vs issue 01 baseline beyond the 02–03 trigger cases).

## Blocked by

- `03-rule-fixes-opacity-and-override.md`
