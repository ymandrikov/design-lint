---
description: "Task list for Namespace-Aware Color Classification"
---

# Tasks: Namespace-Aware Color Classification

**Input**: Design documents from `specs/014-namespace-color-classify/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/classification.md, quickstart.md

**Tests**: REQUIRED — Constitution Principle II (Testing Standards, NON-NEGOTIABLE) and FR-009 / SC-005 mandate before/after fixtures and a failing→green test for every behavior change.

**Organization**: The fix is one shared mechanism (namespace-complete resolver + filter seam) that serves three testable properties. The mechanism lands in Foundational; each user story phase adds its own fixture rows and assertions so it stays independently verifiable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (Setup, Foundational, Polish carry no story label)

## Path Conventions

Single-project CLI linter. Source in `lint-color/`, fixtures in `fixtures/`, e2e in `tests/e2e.test.ts`.

---

## Phase 1: Setup (Shared Fixture Infrastructure)

**Purpose**: Stand up the mixed color + non-color fixture the tests assert against.

- [X] T001 [P] Create fixture config `fixtures/mixed-namespaces/design-system/lint/colors.json` — `colorTokenFiles`, `sourceDirectories`, and `rules["token-constraints"]` allow/deny mirroring the solaris shape (e.g. `text-` allows `*content*`/`*foreground*`/`primary`/`link*`, forbids `danger`/`base`).
- [X] T002 [P] Create color-token CSS `fixtures/mixed-namespaces/design-system/tokens.css` defining `--color-accent`, `--color-danger`, `--color-primary`, and deliberately `--color-base` (to exercise the `text-base` collision, research D3).

**Checkpoint**: Fixture skeleton exists; corpus rows are added per story.

---

## Phase 2: Foundational (Blocking Mechanism)

**Purpose**: The namespace-complete resolver, the color-property predicate, and the single filter seam. Every user story depends on this.

**⚠️ CRITICAL**: No user story phase can pass until this phase is complete.

- [X] T003 Write FAILING unit tests for the color-property predicate in `lint-color/classify.test.ts` — assert `isColorProperty` is true for `color`, `background-color`, `border-color`, `border-*-color`, `outline-color`, `text-decoration-color`, `fill`, `stroke`, `caret-color`, `accent-color`, `--tw-shadow-color`, `--tw-gradient-*`, `--tw-ring-color`, and any `--*`; false for `font-size`, `box-shadow`, `border-width`, `border-*-width`, `outline-width`, `background-image`, `text-decoration-thickness`.
- [X] T004 Extend `CSS_COLOR_PROPERTIES` and implement `isColorProperty(property)` per data-model.md in `lint-color/classify.ts` (turn T003 green). Keep it a pure name-only predicate.
- [X] T005 Write FAILING unit tests for `resolveNamespaceKind(base)` in `lint-color/classify.test.ts` — `text-sm`/`shadow-lg`/`border-2`/`ring-2`/`outline-2` → `"non-color"`; `bg-accent`/`text-red-500`/`bg-black`/`shadow-accent` → `"color"`; `text-accnt` → `"unresolved"`. Drive it with a stub design system so the unit test carries no Tailwind dependency.
- [X] T006 Implement the non-color classifier in `lint-color/classify.ts`: given a candidate's compiled declarations, return `"non-color"` iff declarations are non-empty AND `isColorProperty` is false for all; else `"color"`/`"unresolved"` (turn T005 green). Pure function over declarations — no Tailwind import here.
- [X] T007 Add the namespace-complete design-system loader in `lint-color/index.ts`: build a second `__unstable__loadDesignSystem` whose entry CSS pulls Tailwind default namespaces **merged** with the target's color tokens; expose `resolveNamespaceKind(base)` that runs `candidatesToCss([base])`, extracts properties, and calls the T006 classifier. Leave the existing color-token-only `isValidTailwindCandidate` untouched (research D2).
- [X] T008 Thread the resolver into the linter context (`lint-color/linter.ts` ctx / `tokens`), null-safe: when the resolver is absent (unit tests without the Tailwind API), the filter is a no-op — mirrors the `isValidTailwindCandidate` null pattern in `no-undefined-token.ts`.
- [X] T009 Write FAILING dispatch test in `lint-color/linter.test.ts` — a `non-color` candidate (`text-sm`) yields zero findings from every color rule; a `color`/`unresolved` candidate still fans out.
- [X] T010 Wire the filter seam in `lint-color/linter.ts`: at the per-candidate dispatch (where `composeColorParts` output feeds rules), when `colorPrefix !== null` and `resolveNamespaceKind(base) === "non-color"`, skip the color-rule fan-out (turn T009 green). One seam, all rules (FR-002, FR-003).

**Checkpoint**: Mechanism complete and unit-tested. User stories can now be verified independently.

---

## Phase 3: User Story 1 - Non-color utilities not flagged (Priority: P1) 🎯 MVP

**Goal**: `text-sm`, `text-base`(size intent), `shadow-lg`, `border-2` etc. produce zero color violations.

**Independent Test**: Lint the fixture's non-color rows; assert zero violations mentioning any non-color scale value.

- [X] T011 [P] [US1] Add non-color corpus rows to `fixtures/mixed-namespaces/src/non_color.html` — `text-sm text-xs text-lg text-xl shadow-lg border-2 ring-2 outline-2 divide-y-2`.
- [X] T012 [US1] Add e2e assertion in `tests/e2e.test.ts` — running the linter over `fixtures/mixed-namespaces` reports **no** violation for any T011 class (exact-count assertion, Constitution II).
- [X] T013 [US1] Add regression case to `lint-color/rules/no-undefined-token.test.ts` — `text-sm` with a namespace-complete resolver present produces no finding (the bucket-3 root cause).

**Checkpoint**: US1 green — the ~1268-finding false-positive class is gone (SC-001).

---

## Phase 4: User Story 2 - Genuine color findings preserved (Priority: P1)

**Goal**: spectral, opacity, token-constraint, undefined-color, typo, and the `text-base` collision all still reported, byte-for-byte.

**Independent Test**: Lint the fixture's color rows; assert the exact prior violation set, messages, and counts.

- [X] T014 [P] [US2] Add true-positive corpus rows to `fixtures/mixed-namespaces/src/color.html` — `text-red-500` (spectral), `bg-accent/50` (opacity), `bg-black` (non-token color), `text-danger` (constraint break), `text-accnt` (typo), `text-base` (collision → color via `--color-base`).
- [X] T015 [US2] Add e2e assertions in `tests/e2e.test.ts` — each T014 row produces its expected violation with unchanged message/count: spectral for `text-red-500`, opacity for `bg-accent/50`, undefined-token for `bg-black` and `text-accnt`, token-constraints for `text-danger` **and** `text-base` (research D3).
- [X] T016 [US2] Add preservation regression tests in `lint-color/rules/token-constraints.test.ts` and `lint-color/rules/no-undefined-token.test.ts` — assert INV-2 (kept candidates judged identically) for `text-base`, `bg-black`, and a typo.

**Checkpoint**: US2 green — zero true positives lost (SC-002), `text-base`/`bg-black`/typos preserved.

---

## Phase 5: User Story 3 - Future scale values need no code change (Priority: P2)

**Goal**: a novel size value behind an overloaded prefix is classified `non-color` automatically.

**Independent Test**: Add an unseen size to the fixture design system; assert zero color violations with no `lint-color/` edit.

- [X] T017 [P] [US3] Add a novel size to the fixture design system (`--text-4xl` and/or `--shadow-3xl` in `fixtures/mixed-namespaces/design-system/tokens.css`) and a class using it in `fixtures/mixed-namespaces/src/future_scale.html`.
- [X] T018 [US3] Add e2e assertion in `tests/e2e.test.ts` — the novel-size class yields zero color violations, and confirm no file under `lint-color/` was modified for it (FR-006 / C-4).

**Checkpoint**: US3 green — forward-compat proven (SC-003).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T019 [P] Update `CONTEXT.md` — refine the **Color prefix** and **Candidate** entries so classification is defined by namespace resolution ("a class is a color reference only if its value resolves under a color namespace or under none"), not by prefix presence (Constitution III vocabulary).
- [X] T020 [P] Add ADR `docs/adr/0003-namespace-aware-color-classification.md` — record the decision, the two-design-system split (D2), and the `text-base` collision finding (D3); cite `.repos/tailwindcss` parity per Constitution I.
- [X] T021 Run `quickstart.md` Scenarios 1–4 plus the real-world check `node lint-color/index.ts ../solaris` — confirm the ~1268 non-color `is not defined` lines are gone and `text-base` (678) remains.
- [X] T022 Run gates: `pnpm typecheck` (zero errors), `pnpm test` (all green, no `.only`), `pnpm lint:demo` (expected output), and confirm no per-file runtime regression on the demo fixture (SC-004).

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Foundational (Phase 2)**: depends on Setup — **blocks all user stories**.
- **User Stories (Phase 3–5)**: each depends only on Foundational; independently testable once the mechanism exists.
- **Polish (Phase 6)**: after the desired stories are green.

### Within Foundational (strict TDD order)

- T003 → T004 (predicate test before impl)
- T005 → T006 (classifier test before impl)
- T006 → T007 (classifier feeds the loader)
- T007 → T008 (resolver threaded to ctx)
- T009 → T010 (dispatch test before seam)

### User-story independence

- US1, US2, US3 do not depend on each other. Each adds its own fixture source file (`non_color.html`, `color.html`, `future_scale.html`) and its own `tests/e2e.test.ts` assertions.
- Shared files: `fixtures/mixed-namespaces/design-system/tokens.css` is edited by Setup (T002) and US3 (T017), and `tests/e2e.test.ts` is appended by all three stories — serialize those edits (not [P] across stories).

### Parallel opportunities

- Setup: T001 ∥ T002 (different files).
- Foundational: T003 ∥ T005 draft (both in classify.test.ts — same file, so sequential in practice); impl tasks are sequential per the TDD chain.
- Within a story: the fixture-row task ([P]) can precede its assertion task.
- Polish: T019 ∥ T020 (different docs).

---

## Parallel Example: Setup

```bash
Task: "Create fixture config fixtures/mixed-namespaces/design-system/lint/colors.json"
Task: "Create color-token CSS fixtures/mixed-namespaces/design-system/tokens.css"
```

---

## Implementation Strategy

### MVP (User Story 1)

1. Phase 1 Setup → Phase 2 Foundational (the mechanism) → Phase 3 US1.
2. **STOP and VALIDATE**: non-color utilities silent; run T012/T013 and the solaris check.
3. This alone removes the ~43% noise — shippable MVP.

### Incremental delivery

1. Foundation ready (Phases 1–2).
2. US1 → false positives gone (MVP, SC-001).
3. US2 → prove nothing was lost (SC-002).
4. US3 → prove forward-compat (SC-003).
5. Polish → docs, ADR, gates.

---

## Notes

- [P] = different files, no incomplete dependency.
- Constitution II: every impl task is preceded by a failing test; verify red before green.
- The `text-base` behavior is Tailwind-correct (research D3) — do NOT "fix" it to disappear; US2 asserts it stays flagged.
- Keep the two design systems separate (research D2) — enriching `isValidTailwindCandidate` would regress `bg-black`.
- Commit after each task or logical group; branch off `main` per Constitution workflow.
