# Implementation Plan: Refactor `no-spectral-color` onto the shared classifier

**Branch**: `001-no-spectral-color-refactor` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-no-spectral-color-refactor/spec.md`

## Summary

`no-spectral-color` decides "is this a spectral color?" with its own `base.split("-")` segment scan — a duplicate of the scan that already lives in the shared classifier (`classifyColorPart` → `"spectral"` verdict). Sibling rules `no-var-color` and `no-raw-css-color` already consume `classifyParts(parts, tokens)`. This refactor makes `no-spectral-color` fire on the classifier's `"spectral"` verdict too and deletes its private scan.

The one wrinkle: the rule's replacement hint needs the *matched palette name and shade* (e.g. `green` + `500`), which a boolean-ish verdict doesn't carry. Resolution: extract the palette scan into a single exported helper `findSpectralMatch(colorPart, spectralSet) → { name, shade } | null`, have `classifyColorPart` call it internally, and have the rule call it to build the hint. The rule still **gates** on the `classifyParts` verdict (mirrors siblings); the helper only supplies hint data on the violation path. Net: one copy of the scan, one gate shape across all three color-verdict rules.

## Technical Context

**Language/Version**: JavaScript (ESM), Node `^26.1.0`; typechecked via TypeScript (`checkJs`), `tsconfig.json` at repo root.

**Primary Dependencies**: none new. Internal: `lint-color/classify.js` (owns the color vocabulary + verdicts), `oxc-parser` (upstream, untouched here).

**Storage**: N/A.

**Testing**: `vitest`. Suites: `lint-color/rules/no-spectral-color.test.ts` (rule oracle, unchanged), `tests/e2e.test.ts` (demo-app exact-output), classifier tests.

**Target Platform**: CLI linter run on dev machines + CI.

**Project Type**: Single project (library + CLI). Source under `lint-color/`.

**Performance Goals**: No regression on demo fixture. Scan stays linear in a token's segments; the helper runs at most twice on the violation path only (gate scan inside the classifier + one hint scan), never on clean tokens.

**Constraints**: Behavior-preserving — existing rule tests pass unmodified; demo-app spectral-violation set unchanged; message wording/coloring unchanged; rule `name`/`id`/`checkToken` signature unchanged.

**Scale/Scope**: Two files touched (`classify.js`, `rules/no-spectral-color.js`); ~30 lines net. No config, CLI, or output-contract surface changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**I. Code Quality & Simplicity** — PASS. Removes duplication (deletes the rule's private scan; single-sources the palette scan in `classify.js`). Rule stays single-concern. No new abstraction beyond one helper with two real callers (classifier + rule) — the YAGNI "second caller" bar is met on introduction. `pnpm typecheck` is a gate below.

**II. Testing Standards (NON-NEGOTIABLE)** — PASS. Behavior-preserving: the existing rule suite is the oracle and must stay green with zero edits. A new helper-level test asserts `findSpectralMatch` returns the matched `{name, shade}` (and `null`) so the extracted scan is pinned directly. `tests/e2e.test.ts` demo-app exact-output guards the parity. No new behavior → no new red→green feature test required, but the helper gets its own unit test.

**III. User Experience Consistency** — PASS. Output contract untouched: same `file/line/rule/message` shape, same wording, same `CONTEXT.md` vocabulary ("spectral color class; use a design token instead"). No CLI/config/suppression change → no version bump needed.

**IV. Performance Requirements** — PASS. Parsing/classification already done once per token upstream; this rule keeps inspecting only classes behind a color prefix (in fact tightens to it — see spec Assumptions). Extra hint scan is violation-path-only and linear. No super-linear blowup, no new per-file cost.

No violations. Complexity Tracking table omitted (nothing to justify).

## Project Structure

### Documentation (this feature)

```text
specs/001-no-spectral-color-refactor/
├── plan.md              # This file
├── research.md          # Phase 0 — the one design decision (helper extraction)
├── data-model.md        # Phase 1 — verdict / color part / spectral match / replacement map
├── quickstart.md        # Phase 1 — how to validate (tests + demo diff)
├── contracts/
│   ├── find-spectral-match.md   # new exported helper contract
│   └── check-token.md           # rule checkToken contract (unchanged behavior)
└── checklists/
    └── requirements.md  # spec quality checklist (from /speckit-specify)
```

### Source Code (repository root)

```text
lint-color/
├── classify.js                     # EDIT — extract findSpectralMatch; classifyColorPart calls it
├── classify.test.ts                # EDIT/ADD — unit test for findSpectralMatch (if suite exists; else new)
└── rules/
    ├── no-spectral-color.js        # EDIT — gate on classifyParts verdict; delete private scan;
    │                               #        use findSpectralMatch for hint name+shade
    └── no-spectral-color.test.ts   # UNCHANGED — oracle, must stay green

tests/
└── e2e.test.ts                     # UNCHANGED — demo-app exact-output parity guard
```

**Structure Decision**: Single project. Change is confined to the classification module and the one rule that still duplicates its scan; tests already exist and stay as the oracle.

## Complexity Tracking

> No Constitution Check violations — section intentionally empty.
