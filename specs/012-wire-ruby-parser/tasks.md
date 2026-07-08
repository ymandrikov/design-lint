---
description: "Task list for Wire Ruby/ERB Parser"
---

# Tasks: Wire Ruby/ERB Parser

**Input**: Design documents from `specs/012-wire-ruby-parser/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/erb-linting.md, quickstart.md

**Tests**: REQUIRED — Constitution II (Testing Standards, NON-NEGOTIABLE) mandates a failing test for
every new behavior and exact-output e2e over fixtures. Test tasks are written FIRST and must fail
before implementation.

**Organization**: Grouped by user story. US1 (P1) is the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2
- Exact file paths included.

## Path Conventions

Single project. Linter source in `lint-color/`, fixtures in `fixtures/`, cross-cutting tests in `tests/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependency + fixture scaffolding.

- [X] T001 Add `@herb-tools/node-wasm` to `dependencies` in `package.json` pinned to an exact version (pre-1.0), then `pnpm install` and confirm the lockfile updates.
- [X] T002 [P] Scaffold `fixtures/erb-app/` as a runnable target for `node lint-color/index.ts fixtures/erb-app`: create `fixtures/erb-app/design-system/lint/colors.json` (mirror the demo config: `colorTokenFiles`, `rules`) and `fixtures/erb-app/src/` with a color-token CSS entry so the Tailwind candidate loader resolves.

**Checkpoint**: `@herb-tools/node-wasm` importable; fixture app has a config.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The herb parse boundary both stories build on.

**⚠️ CRITICAL**: Blocks US1 and US2.

- [X] T003 Create `lint-color/ast-erb.ts` with the herb load/parse boundary: an async, memoized `loadHerb()` that calls `await Herb.load()` exactly once (import `{ Herb }` from `@herb-tools/node-wasm`), and a synchronous `parseErb(source: string)` returning herb's `ParseResult`. Cite herb upstream (`@herb-tools/core`) per Constitution I. No AST walking yet.

**Checkpoint**: ERB source can be parsed to a `ParseResult` from TS; foundation ready.

---

## Phase 3: User Story 1 - Lint color tokens in ERB templates (Priority: P1) 🎯 MVP

**Goal**: Discover `.erb`/`.html.erb`, extract static class tokens from fully-static `class`
attributes, run the existing color-token pipeline, report violations in the standard shape.

**Independent Test**: Lint a fixture with `class="text-red-500"` (reported) and `class="text-primary"`
(not reported); a mixed `.tsx`+`.erb` run attributes each violation to its own file.

### Tests for User Story 1 (write first, must FAIL) ⚠️

- [X] T004 [P] [US1] Unit test `lint-color/linter.lintErb.test.ts`: `await` the herb load in setup, build `createLinter` with minimal tokens (mirror `linter.test.ts`), assert `lintErbSource` reports exactly one violation for `class="text-red-500"` and none for `class="text-primary"`, each with the correct line.
- [X] T005 [P] [US1] Parity test in `lint-color/linter.lintErb.test.ts`: the same offending class fed via `lintTailwindSource` (`.tsx`) and `lintErbSource` (`.erb`) yields the same `ruleId` + `message` (SC-002).
- [X] T006 [P] [US1] E2E in `tests/e2e.test.ts`: run the linter over a mixed `fixtures/erb-app` tree and assert the exact ERB violations (file, line, rule, message, count) appear alongside existing file types in one result.
- [X] T007 [P] [US1] Non-regression assertion in `tests/e2e.test.ts` (or `tests/findings.test.ts`): existing demo-fixture output is unchanged by the presence of the ERB path (SC-004, FR-009).

### Implementation for User Story 1

- [X] T008 [US1] In `lint-color/ast-erb.ts`, add a `Visitor` subclass (from `@herb-tools/core`) overriding `visitHTMLAttributeNode`; filter `getStaticAttributeName(node.name) === "class"`; for fully-static values (all `node.value.children` are `LiteralNode`), emit `ClassToken { text, line }` where `text = children.map(c => c.content).join("")` and `line = node.location.start.line`; call `this.visitChildNodes(node)` to recurse. Export a `collectErbClassTokens(parseResult): ClassToken[]`.
- [X] T009 [US1] In `lint-color/linter.ts`, add `lintErbSource(source, filePath?)` as a method on the `createLinter` return object: `parseErb` → `collectErbClassTokens` → `checkTailwindClasses(token.text, token.line)` per token; return `{ violations, ignores: [] }` (ignores wired in US2).
- [X] T010 [US1] In `lint-color/index.ts`, add `await loadHerb()` once before the file loops, then a `getAllFiles(SRC, ".erb")` loop (excludes storybook) dispatching `accumulate(linter.lintErbSource(source, f), f)`. Confirm `.html.erb` is matched (extname `.erb`).

**Checkpoint**: MVP — fully-static ERB `class` color linting works end-to-end and is independently testable.

---

## Phase 4: User Story 2 - Static-only linting with dynamic ERB untouched (Priority: P2)

**Goal**: Values containing ERB interpolation are handled as boundaries (no false positives),
suppression works, malformed templates don't abort the run.

**Independent Test**: `class="text-red-500 <%= x %>"` reports only `text-red-500`;
`class="text-<%= s %>-500"` reports nothing; a `<%# color-lint-ignore %>` line is suppressed; a
malformed template does not stop sibling files linting.

**Note**: US2 edits the same files as US1 (`ast-erb.ts`, `linter.ts`) — sequential after US1, not parallel with it.

### Tests for User Story 2 (write first, must FAIL) ⚠️

- [X] T011 [P] [US2] Interpolation tests in `lint-color/linter.lintErb.test.ts`: `class="text-red-500 <%= dyn %>"` → only `text-red-500`; `class="text-<%= shade %>-500"` → zero violations; a silent `<% if %>…<% end %>` around a class → zero (SC-003).
- [X] T012 [P] [US2] Suppression test in `lint-color/linter.lintErb.test.ts`: a violation on a line carrying `<%# color-lint-ignore %>` is suppressed and appears in `ignores`.
- [X] T013 [P] [US2] Malformed-template test in `lint-color/linter.lintErb.test.ts` (or `tests/e2e.test.ts`): an unparseable `.erb` does not throw; a sibling valid file still lints; `ParseResult.errors` is surfaced (SC-005, FR-006).

### Implementation for User Story 2

- [X] T014 [US2] Generalize `collectErbClassTokens` in `lint-color/ast-erb.ts` to multi-child values: run `splitLiteralsAtWhitespace(node.value.children)` → `groupNodesByClass`, and emit a `ClassToken` only for groups where `group.every(isLiteralNode)` (skip any group containing an `ERBContentNode`/ERB control-flow node) — FR-005, D3.
- [X] T015 [US2] In `lint-color/ast-erb.ts`, add `collectErbIgnoredLines(parseResult): Set<number>` collecting `location.start.line` of every `ERBContentNode` with `tag_opening === "<%#"` whose `content` trims to `color-lint-ignore`; in `lintErbSource` (`linter.ts`), drop tokens on ignored lines and return the sorted `ignores` (D5).
- [X] T016 [US2] In `lintErbSource` (`linter.ts`), handle `ParseResult.errors`: always lint `result.value`; if `errors` is non-empty, surface a parse note (do not throw) so the run continues (FR-006, D4).

**Checkpoint**: US1 + US2 both work; no false positives on dynamic ERB; run is crash-resistant.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T017 [P] Add an ADR under `docs/adr/` recording the herb/`@herb-tools/node-wasm` dependency decision and the static-only ERB scope (cite `.scratch/wire-ruby-parser/research.md`).
- [X] T018 [P] Update `CONTEXT.md` if ERB/`class`-attribute terms need entries, keeping output vocabulary consistent (Constitution III).
- [X] T019 Run quickstart validation: `pnpm typecheck`, `pnpm test`, `node lint-color/index.ts fixtures/erb-app`, `pnpm lint:demo` — all gates green, demo output byte-identical.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: no dependencies.
- **Foundational (P2)**: depends on Setup (needs the installed dep). Blocks US1 + US2.
- **US1 (P3)**: depends on Foundational. The MVP.
- **US2 (P4)**: depends on US1 (extends the same `ast-erb.ts` extractor + `lintErbSource`).
- **Polish (P5)**: depends on US1 (+US2 for full scope).

### Within Each User Story

- Tests written first and FAIL before implementation (Constitution II).
- `ast-erb.ts` extractor before `lintErbSource` (linter.ts) before index.ts dispatch.

### Parallel Opportunities

- T002 [P] parallel with T001’s install step where independent.
- US1 tests T004–T007 all [P] (T006/T007 share `tests/e2e.test.ts` — coordinate or land in one edit).
- US2 tests T011–T013 all [P].
- Implementation tasks within a story are sequential (same files: `ast-erb.ts`, `linter.ts`).
- US1 and US2 are NOT parallel — US2 edits US1’s files.

---

## Parallel Example: User Story 1 tests

```bash
# Write these together, ensure they FAIL first:
Task: "Unit test lintErbSource static tokens in lint-color/linter.lintErb.test.ts"   # T004
Task: "Parity test tsx vs erb same verdict in lint-color/linter.lintErb.test.ts"      # T005
Task: "E2E combined ERB run in tests/e2e.test.ts"                                      # T006
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP & VALIDATE** (fully-static ERB
   color linting works, no regression) → demo.

### Incremental Delivery

1. Setup + Foundational → herb parse boundary ready.
2. US1 → static ERB `class` linting (MVP) → validate → demo.
3. US2 → interpolation boundary + suppression + crash-resistance → validate → demo.
4. Polish → ADR, docs, full quickstart gate.

---

## Notes

- [P] = different files, no dependency. Same-file tasks are sequential.
- Every new behavior lands with a failing-first test (Constitution II); no `.only`/skip.
- Reuse the inner pipeline verbatim — no edits to `classify.ts` or `rules/*`.
- Commit after each task or logical group; branch `ym/wire-ruby-parser`.
