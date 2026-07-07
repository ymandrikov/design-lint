---
description: "Task list — Refactor no-spectral-color onto the shared classifier"
---

# Tasks: Refactor `no-spectral-color` onto the shared classifier

**Input**: Design documents from `/specs/001-no-spectral-color-refactor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: INCLUDED. Constitution II (Testing — NON-NEGOTIABLE) requires the new
`findSpectralMatch` helper to ship with tests, and the existing oracle to stay green.

**Organization**: Grouped by user story for traceability. ⚠️ **Coupling note**: this is a
single atomic 2-file refactor (`lint-color/classify.js`, `lint-color/rules/no-spectral-color.js`).
US1 and US2 both edit the same `checkToken` and are therefore sequential, not independent
deployable slices. US3 is verification-only (no new code). Do not expect parallel story
delivery here — the story labels are for requirement traceability, not staffing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different file, no dependency on an incomplete task → parallelizable.
- **[Story]**: US1 / US2 / US3 maps to spec.md user stories.

## Path Conventions

Single project. Source under `lint-color/`, e2e under `tests/`.

---

## Phase 1: Setup

**Purpose**: Establish the green baseline the refactor must preserve.

- [X] T001 Capture the baseline: run `pnpm test` and `pnpm lint:demo`, confirm all green and note the current `no-spectral-color` demo-app violation set (this is the zero-delta target per spec SC-003).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Single-source the palette scan. BLOCKS US1 and US2 — both depend on
`findSpectralMatch` existing.

**⚠️ CRITICAL**: No rule changes until the helper exists and the classifier delegates to it.

- [X] T002 Add `findSpectralMatch` unit tests in `lint-color/classify.test.ts` per contracts/find-spectral-match.md (cases: `red-500`, `blue-200`, `x-red-500`, `green-100` → `{name,shade}`; `red`, `sm`, `cover`, `primary`, `""` → `null`). Write first; expect them to FAIL (helper not yet exported).
- [X] T003 Extract `findSpectralMatch(colorPart, spectralSet) → { name, shade } | null` as a new **export** in `lint-color/classify.js` (lift the `SHADE_RE` segment scan currently inlined in `classifyColorPart`). T002 tests now pass.
- [X] T004 Rewire `classifyColorPart` in `lint-color/classify.js` to call `findSpectralMatch` for its `"spectral"` verdict (delete the inlined loop; behavior identical). Confirm `lint-color/classify.test.ts` fully green.

**Checkpoint**: One implementation of the palette scan, exported, classifier delegates to it.

---

## Phase 3: User Story 1 - One source of truth for "spectral" (Priority: P1) 🎯 MVP

**Goal**: The rule fires on the classifier's `"spectral"` verdict; its private
`base.split("-")` scan is deleted.

**Independent Test**: `pnpm vitest run lint-color/rules/no-spectral-color.test.ts` — the
violation and non-violation cases stay green; the rule module contains no `split("-")` scan.

- [X] T005 [US1] In `lint-color/rules/no-spectral-color.js`, replace the private `segs = base.split("-")` detection loop with a verdict gate: `if (classifyParts(parts, tokens) !== "spectral") return null;` (import `classifyParts` from `../classify.js`, mirroring `no-var-color.js`). Delete the loop.
- [X] T006 [US1] Verify `lint-color/rules/no-spectral-color.test.ts` violation + non-violation groups pass (bg-red-500, text-blue-200, border-slate-300, ring-offset-blue-200, divide-green-100; and bg-primary, text-red, text-sm, bg-cover). Do NOT edit the test file (spec SC-001).

**Checkpoint**: Detection delegated; duplicate scan gone. Hint wiring still pending (US2).

---

## Phase 4: User Story 2 - Replacement hints keep working (Priority: P1)

**Goal**: The violation message's replacement hint is derived from `findSpectralMatch`,
not from a rule-local scan.

**Independent Test**: With the sample replacement config, `text-green-400` / `bg-green-500`
carry their mapped token in the message; `bg-blue-500` (unmapped) carries no ` try ` hint.

**Depends on**: T003 (helper) + T005 (gate in place). Same file as US1 → sequential.

- [X] T007 [US2] In `lint-color/rules/no-spectral-color.js`, after the verdict gate, obtain `{ name, shade }` via `findSpectralMatch(parts.colorPart, tokens.spectralSet)` and pass them to the existing `findReplacement(replacement, colorPrefix, name, shade)`. Keep `findReplacement` and its range parsing unchanged (spec Assumption: hint logic stays in the rule).
- [X] T008 [US2] Confirm the message build is byte-for-byte unchanged: `` `${ansi.red(base)} — spectral color class; use a design token instead${hint}` ``; hint only when prefix + map entry match. Run the `replacing` test group in `lint-color/rules/no-spectral-color.test.ts` — all green, no edits.

**Checkpoint**: Rule fully refactored — verdict gate + helper-fed hint, zero private scan.

---

## Phase 5: User Story 3 - Detection & suppression preserved (Priority: P2)

**Goal**: Observable behavior identical to `main` — boundaries, compound prefixes,
suppression, and demo-app output unchanged.

**Independent Test**: e2e demo-app spectral-violation set is byte-identical to baseline.

**Depends on**: US1 + US2 complete.

- [X] T009 [US3] Verify the `escaping` group (`color-lint-ignore` suppresses `bg-red-500`) and the edge cases (`bg-green-700` shade-out-of-range, `border-green-500` prefix-absent → violation with no hint) pass in `lint-color/rules/no-spectral-color.test.ts`.
- [X] T010 [US3] Run `pnpm lint:demo` and diff against the T001 baseline — confirm zero delta in the `no-spectral-color` violation set (spec SC-003). Confirm `tests/e2e.test.ts` passes unchanged.

**Checkpoint**: Behavior-preserving refactor proven against the exact-output oracle.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T011 Run `pnpm typecheck` — zero errors (Constitution Quality Gate, spec SC-004).
- [X] T012 Run full `pnpm test` — all green, no `.only`/skipped (Constitution Quality Gate).
- [X] T013 Run quickstart.md steps 1–4 end to end; confirm the "Done when" bullets (no `split("-")` scan in the rule; `name`/`id`/`checkToken` signature + message wording unchanged).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: none — run first to fix the baseline.
- **Foundational (T002–T004)**: after Setup. BLOCKS all story work (helper must exist).
- **US1 (T005–T006)**: after Foundational.
- **US2 (T007–T008)**: after US1 — **same file** (`no-spectral-color.js`), sequential.
- **US3 (T009–T010)**: after US1 + US2 (verification of the combined result).
- **Polish (T011–T013)**: after US3.

### Within Foundational (TDD)

- T002 (failing helper test) → T003 (implement helper, green) → T004 (classifier delegates).

### Parallel Opportunities

Limited — the refactor touches two files, edited in sequence.

- T002 (edits `classify.test.ts`) is **[P]** with nothing here because T003 depends on it; no other concurrent lane exists.
- US1 and US2 are **not** parallel: both edit `no-spectral-color.js`'s `checkToken`.
- Verification tasks (T006, T008, T009) are cheap re-runs of the same suite; no benefit to parallelizing.

There is no meaningful multi-developer parallelization for this feature — it is one atomic refactor. Assign to a single implementer.

---

## Implementation Strategy

### MVP (US1)

1. T001 baseline.
2. T002–T004 helper extraction (Foundational).
3. T005–T006 rule gates on the verdict, private scan deleted.
4. **STOP & VALIDATE**: `no-spectral-color.test.ts` violation/non-violation groups green.

At this point detection is single-sourced (the headline win). Hints still work because the
old hint code path is untouched until US2 — but note the rule momentarily uses the deleted
scan's outputs, so **US1 and US2 land together in one commit** in practice; do not ship US1
alone. The MVP boundary is conceptual, not a deployable checkpoint here.

### Full delivery

US1 + US2 in one change → US3 verification → Polish gates. One commit, one review.

---

## Notes

- [P] = different file, no dependency. Almost none apply here (2-file refactor).
- Do NOT edit `lint-color/rules/no-spectral-color.test.ts` or `tests/e2e.test.ts` — they are
  the oracle (spec SC-001, SC-003).
- No config/CLI/output-contract change → no version bump (Constitution III).
- Commit after US2 (rule fully refactored) as one logical unit, not per micro-task.
