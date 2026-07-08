# Implementation Plan: Namespace-Aware Color Classification

**Branch**: `014-namespace-color-classify` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/014-namespace-color-classify/spec.md`

## Summary

Non-color Tailwind utilities that share a prefix with a color utility
(`text-sm`, `text-base`, `shadow-lg`, `border-2`) are misreported as color-token
problems, producing ~43% of the linter's output on real codebases. Root cause
(see [research.md](./research.md)): the `no-undefined-token` and
`token-constraints` rules fire on color-prefix presence, and the
`isValidTailwindCandidate` oracle is built from a design system that knows only
color tokens — so `text-sm` looks like an undefined token.

**Approach**: add one **namespace-complete resolver** (Tailwind default theme
merged with the target's color tokens) that determines whether a candidate
resolves to a **non-color** CSS property. A single filter seam drops non-color
candidates before any color rule runs; surviving candidates are judged exactly as
today. This mirrors Tailwind's own namespace resolution, so newly added scale
values need no code change, and it preserves every genuine color finding
(`bg-black`, typos, opacity modifiers).

## Technical Context

**Language/Version**: TypeScript (ESM, `.ts` executed directly via Node, per recent JS→TS migration)

**Primary Dependencies**: `tailwindcss` v4 (`__unstable__loadDesignSystem`, `candidatesToCss`); `herb` ERB parser; vendored Tailwind parse-parity helpers in `lint-color/vendor/`

**Storage**: N/A (stateless CLI over source files)

**Testing**: Node test runner (`node --test`, `*.test.ts`); `pnpm test`, `pnpm typecheck`, `pnpm lint:demo`

**Target Platform**: Node CLI (darwin/linux), run on save and in CI

**Project Type**: Single-project CLI linter (`lint-color/`)

**Performance Goals**: Linear in candidates per file; no per-file runtime regression on the demo fixture (Constitution IV, FR-008). One candidate compile per token, reusing the existing `candidatesToCss` call shape.

**Constraints**: Deterministic output (no wall-clock/network/order dependence); exact violation counts are the test contract; public contract (rule names, messages, exit codes) unchanged except the intended FP removal.

**Scale/Scope**: Color domain only. ~20 rule modules; the change touches the classifier, the linter dispatch seam, the design-system loader in `index.ts`, and the two rules that surface the FPs — plus fixtures.

## Constitution Check

*GATE: must pass before Phase 0 and re-checked after Phase 1.*

| Principle | Assessment | Status |
|---|---|---|
| I. Code Quality & Simplicity | One additive filter mechanism, not six per-rule guards (D4). Vendored/parity resolution cites upstream `.repos/tailwindcss` (D1). Prefer deleting FP paths over adding config. Typecheck zero-error gate applies. | ✅ Pass |
| II. Testing Standards (NON-NEGOTIABLE) | Before/after fixtures over a mixed color + non-color corpus assert exact violation set (SC-005, FR-009). Every changed rule ships a failing→green test. Deterministic. | ✅ Pass |
| III. UX Consistency | No new reporting format; messages/exit codes unchanged. FP removal is the only output delta. `text-base` behavior clarified, not changed (D3). Rule names stay stable — no public-contract break. | ✅ Pass |
| IV. Performance | One compile per candidate, reusing `candidatesToCss`; filter is O(declarations) per token, linear. Demo-fixture runtime measured, no regression. | ✅ Pass |

**No violations.** Complexity Tracking not required.

One item requires user acknowledgement (not a gate failure): **research Decision 3**
revises **SC-001** downward (~1268, not ~1946) because `text-base` is a
Tailwind-correct color resolution that stays flagged. Recommend confirming the
SC-001 wording before `/speckit-tasks`.

## Project Structure

### Documentation (this feature)

```text
specs/014-namespace-color-classify/
├── plan.md              # This file
├── spec.md              # Feature spec (+ Clarifications)
├── research.md          # Phase 0 — root cause + 5 decisions
├── data-model.md        # Phase 1 — classification entities
├── quickstart.md        # Phase 1 — validation guide
├── contracts/
│   └── classification.md # Phase 1 — the non-color filter contract
├── checklists/
│   └── requirements.md   # Spec quality checklist (16/16)
└── tasks.md             # Phase 2 — created by /speckit-tasks
```

### Source Code (repository root)

```text
lint-color/
├── index.ts             # CHANGE: build namespace-complete design system;
│                        #   expose non-color resolver alongside isValidTailwindCandidate
├── classify.ts          # CHANGE: extend CSS_COLOR_PROPERTIES; add non-color
│                        #   classification helper consuming resolved declarations
├── linter.ts            # CHANGE: apply the non-color filter seam before rule fan-out
├── classify.test.ts     # CHANGE: unit tests for non-color detection + color-property predicate
├── linter.test.ts       # CHANGE: dispatch drops non-color candidates from all rules
├── rules/
│   ├── no-undefined-token.ts    # VERIFY: no longer flags text-sm; still flags bg-black, typos
│   ├── token-constraints.ts     # VERIFY: text-base preserved; no non-color leakage
│   └── *.test.ts                # CHANGE: add non-color negative cases where relevant
└── vendor/              # (reuse) segment / is-color / decode helpers

fixtures/
└── <new mixed corpus>   # NEW: color + non-color classes with before/after expected output

tests/
└── e2e.test.ts          # CHANGE: assert exact violation set over the new fixture
```

**Structure Decision**: Single-project CLI. The fix is concentrated at three
seams — the design-system loader (`index.ts`), the classifier
(`classify.ts`), and the rule dispatch (`linter.ts`) — plus fixtures and the two
rules whose behavior is verified. No new module or abstraction is introduced;
the filter is a function consumed at one call site (Constitution I, YAGNI).

## Complexity Tracking

No constitution violations — section intentionally empty.
