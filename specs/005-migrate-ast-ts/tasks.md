# Tasks: Refactor and migrate the AST layer (`ast.js`) → TypeScript

**Feature**: `specs/005-migrate-ast-ts` | **Branch**: `ym/explore`
**Input**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ast-module.md](./contracts/ast-module.md), [quickstart.md](./quickstart.md)

**Tests**: No new test tasks. This is a behavior-preserving language migration; the existing
suites (`linter.test.ts`, `linter.lintCss.test.ts`, `classify.test.ts`, rule tests) and
`pnpm lint:demo` are the behavior contract and MUST pass unchanged (spec: SC-003/SC-004).

**Baseline to preserve**: `pnpm typecheck` = 0 errors; `pnpm lint:demo` = **23 violations,
1 suppressed**; `pnpm test` = all green.

---

## Phase 1: Setup

- [X] T001 Capture the green baseline before any edit: run `pnpm typecheck` (expect 0 errors), `node lint-color/index.js fixtures/demo-app | tail -3` (expect `23 violations found.` + `(1 line suppressed with color-lint-ignore)`), and `pnpm test` (all green). Record the demo counts for the SC-004 comparison.

## Phase 2: Foundational

_No foundational tasks. The migration is confined to one module; its creation is the first user-story task and blocks nothing else beforehand._

---

## Phase 3: User Story 1 — AST boundary type-checked at its own contract (Priority: P1) 🎯 MVP

**Goal**: `lint-color/ast.ts` exists with every export and helper typed; `pnpm typecheck` covers
its body with zero errors and zero unjustified `any`.

**Independent Test**: `test -f lint-color/ast.ts`; `pnpm typecheck` → 0 errors; no implicit `any`
on params/returns; any explicit `any` carries an inline justification.

- [X] T002 [US1] Create `lint-color/ast.ts` as a full typed rewrite of `lint-color/ast.js`, preserving every line comment and the exact runtime logic. Add `import type { Program, Comment, Node, StringLiteral, TemplateElement, ObjectExpression, ObjectProperty, JSXIdentifier, JSXNamespacedName, JSXMemberExpression, Expression } from "oxc-parser"` and keep the runtime `import { parseSync } from "oxc-parser"`. Do NOT change any `.type` string check (discriminants are ESTree names per research.md R2). Keep `lint-color/ast.js` in place for now (deleted in US2).
- [X] T003 [US1] In `lint-color/ast.ts`, define the module's own types per [data-model.md](./data-model.md): `Lang = "tsx" | "ts"`, `ParsedAst` (`program`, `comments`, `lineStarts`, `ignored: Set<number> | null`), the `ParseCache` shape (all-nullable init), `ClassStatic = { text: string; node: Node }`, and `StyleProp = { keyName: string; valueNode: Expression; node: ObjectProperty }`. Type `parseSource` → `ParsedAst`, the extractors → `ClassStatic[]`, `styleObjectProps` → `StyleProp[]`, `ignoredLines(ast: ParsedAst)`, `jsxName` over the JSX-name union, and the internal helpers (`langForFile`, `collectClassStatics`, `objectExpressionOf`, `propKeyName`).
- [X] T004 [US1] Type the reflective `walk(node: unknown, enter: (node: Node) => void)` in `lint-color/ast.ts`: guard object/array, iterate keys via a single `node as Record<string, unknown>` bridge, and call `enter(node as Node)` only after `typeof node.type === "string"`. Add an inline `//` justification on the one unavoidable cast (per constitution I / research.md R3). Confirm zero other `any`.
- [X] T005 [US1] Run `pnpm typecheck` and resolve any errors originating in `lint-color/ast.ts` until it reports 0 errors (SC-002). Do not weaken types to silence errors; fix the shapes.

**Checkpoint**: `ast.ts` typechecks clean and standalone (old `ast.js` still present; importers unchanged).

---

## Phase 4: User Story 2 — Linter still loads and runs every rule (Priority: P1)

**Goal**: Every importer resolves to `ast.ts`, the old `ast.js` is gone, and the linter runs
end-to-end with the identical demo violation set.

**Independent Test**: `grep -rn 'ast\.js' lint-color` → no matches; `pnpm lint:demo` → 23
violations, 1 suppressed, identical to baseline.

- [X] T006 [P] [US2] Update import specifier `./ast.js` → `./ast.ts` in `lint-color/linter.js`.
- [X] T007 [P] [US2] Update import specifier `./ast.js` → `./ast.ts` in `lint-color/helpers.ts`.
- [X] T008 [P] [US2] Update import specifier `../ast.js` → `../ast.ts` in `lint-color/rules/no-component-color-override.js`.
- [X] T009 [P] [US2] Update import specifier `../ast.js` → `../ast.ts` in `lint-color/rules/no-useless-hover.js`.
- [X] T010 [P] [US2] Update import specifier `../ast.js` → `../ast.ts` in `lint-color/rules/no-style-color.js`.
- [X] T011 [US2] Delete `lint-color/ast.js` (replaced by `ast.ts`, SC-001). Then run `grep -rn 'ast\.js' lint-color` and confirm no remaining references (FR-003).
- [X] T012 [US2] Run `pnpm lint:demo | tail -3` and confirm **23 violations, 1 suppressed** — byte-for-byte identical to the T001 baseline (SC-004). Any delta is a regression to fix before proceeding.

**Checkpoint**: Linter loads the TypeScript module and produces identical output; no `.js` AST module remains.

---

## Phase 5: User Story 3 — Parsing, caching, and extraction behavior preserved (Priority: P2)

**Goal**: The parse/cache/extraction boundary behaviors are confirmed unchanged by the existing
test suites.

**Independent Test**: `pnpm test` all green with zero test-file edits.

- [X] T013 [US3] Run `pnpm test` and confirm every suite is green with no assertion changes; confirm `git diff --name-only -- '*.test.ts'` is empty (SC-003).
- [X] T014 [US3] Verify the User Story 3 spot-checks in [quickstart.md](./quickstart.md) are covered green: LRU-1 single-parse, lang-by-extension (`.ts` generic arrow / angle-cast not dropped), standalone-marker line-scoped suppression (superstring className suppresses nothing), and style-object no-brace-desync (bug #2). Rely on existing tests; if any behavior is not already asserted, note it (do not add scope).

**Checkpoint**: All three user stories independently verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T015 Confirm no new build/bundle/loader step was introduced (SC-005): `package.json` unchanged. **Deviation**: `tsconfig.json` gained one typecheck-only flag — `allowImportingTsExtensions: true` — because `helpers.ts` (a type-checked `.ts` file) now statically imports `./ast.ts`, and the `.ts` specifier is mandatory for Node's runtime resolution (no `ast.js` exists). This is a compiler-check setting, not a build/bundle/loader step, so SC-005 (and FR-003's "no build configuration required to *run* the linter" — Node runs `.ts` natively regardless) still hold. See Implementation Notes.
- [X] T016 Confirm SC-006: `grep -n 'any' lint-color/ast.ts` — every occurrence (if any) is inline-justified; zero unjustified `any`.
- [X] T017 Final gate: re-run `pnpm typecheck && pnpm test && pnpm lint:demo` together; all green, 23 violations / 1 suppressed. Feature complete.

---

## Dependencies & Execution Order

- **Setup (T001)** → first; captures the comparison baseline.
- **US1 (T002–T005)** → depends on T001. All same-file (`ast.ts`), so sequential (no [P]).
- **US2 (T006–T012)** → depends on US1 (the `.ts` module must exist and typecheck before imports point to it and the `.js` is deleted). T006–T010 are **parallel** (five distinct files). T011 (delete + grep) and T012 (demo) after them.
- **US3 (T013–T014)** → depends on US2 (linter must load the migrated module). Independently testable via `pnpm test`.
- **Polish (T015–T017)** → last.

## Parallel Opportunities

- T006, T007, T008, T009, T010 — five import-specifier edits in five different files, no shared
  state; run together. Example:
  ```
  Edit lint-color/linter.js  &  helpers.ts  &  rules/no-component-color-override.js
     &  rules/no-useless-hover.js  &  rules/no-style-color.js  (all "./ast.js"→"./ast.ts")
  ```

## Implementation Strategy

- **MVP = User Story 1**: a typed `ast.ts` that `pnpm typecheck` covers with zero errors is the
  core value (types are the primary contract). US2 wires it in; US3 confirms behavior.
- **Incremental delivery**: US1 (module typed, standalone) → US2 (loaded + old deleted, demo
  identical) → US3 (full suite green). Each checkpoint is independently verifiable.

## Implementation Notes (actual outcome)

- **All 17 tasks complete.** Final gate green: `pnpm typecheck` 0 errors · `pnpm test` 393
  passed (20 files) · `pnpm lint:demo` 23 violations, 1 suppressed — identical to baseline.
- **Files**: `lint-color/ast.ts` created (replaces `ast.js`, deleted); 5 import specifiers
  switched to `./ast.ts` / `../ast.ts`; `tsconfig.json` gained `allowImportingTsExtensions: true`.
- **Unplanned tsconfig change** (see T015): plan.md/research.md R4 predicted "tsconfig
  unchanged", reasoning from the shipped `.ts` rules. That held only because those rules are
  imported solely from *untyped* `.js` files (`checkJs: false`). `helpers.ts` is the first
  *type-checked* `.ts`→`.ts` import with an explicit `.ts` extension, which `tsc` rejects
  without `allowImportingTsExtensions`. The flag is the minimal, standard fix and is
  typecheck-only (no runtime/build impact). This is now the repo-wide pattern for any future
  `.ts`-importing-`.ts` module.
- **Types**: node types imported from `oxc-parser` (re-exports `@oxc-project/types`); zero `any`
  types; one inline-justified `node as Record<string, unknown>` bridge in the reflective `walk`.
