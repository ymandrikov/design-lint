# Phase 0 Research: `no-spectral-color` JS → TS migration

All Technical Context unknowns resolved. No open `NEEDS CLARIFICATION`.

## R1 — How does a `.ts` rule run with no build step?

**Decision**: Rely on Node's native TypeScript type stripping. Rename the module to
`no-spectral-color.ts` and update importers to the `.ts` specifier. No bundler, `tsx`,
`ts-node`, or loader flag.

**Rationale**: Runtime is bare `node lint-color/index.js` (no build script in
`package.json`; `type: module`). Engine is pinned `^26.1.0`; measured `node --version` =
v26.1.0. Node ≥ 23.6 strips types from `.ts` on import by default. Probe confirmed:
a `.mjs` importing `export const n: number = 41` from a sibling `.ts` printed `loaded 42`.
Type stripping is erasure-only, so runtime behavior and cost are unchanged (Constitution IV,
SC-005).

**Alternatives considered**:
- *Add a build step (tsc emit / bundler)* — rejected: violates SC-005 ("no new build step")
  and adds a stage the project deliberately avoids.
- *`tsx`/`ts-node` loader* — rejected: unnecessary given native support; adds a dependency.

## R2 — Import specifier: does `.js` auto-resolve to `.ts`?

**Decision**: Update both importers to the explicit `.ts` specifier:
`./rules/no-spectral-color.js` → `./rules/no-spectral-color.ts` in `lint-color/index.js`
(line ~26) and `lint-color/linter.js` (line ~26).

**Rationale**: Node ESM resolves the literal specifier; it does not rewrite `.js`→`.ts`.
The probe imported with the `.ts` extension and succeeded. Leaving `.js` would fail module
resolution at runtime once the file is renamed.

**Alternatives considered**:
- *Extensionless import* — rejected: `nodenext` resolution requires explicit extensions in ESM.
- *Keep a `.js` re-export shim* — rejected: pointless indirection for a single consumer pair.

## R3 — Will `tsc --noEmit` accept a `.ts` file imported by `.js` files?

**Decision**: Expect `pnpm typecheck` to pass **without** touching `tsconfig.json`. If tsc
reports a `.ts`-extension import error, add `"allowImportingTsExtensions": true` to
`compilerOptions` (permitted because `noEmit: true`).

**Rationale**: `tsconfig.json` has `allowJs: true`, `checkJs: false`, and includes
`lint-color/**/*`. Because `checkJs` is off, the `.js` importers are not type-checked, so
their `.ts`-extension specifiers raise no error. The migrated `.ts` file imports real `.js`
files (`../classify.js`, `../shared.js`) by their true `.js` extension — no TS-extension
import inside a checked file. So the extension flag is likely unnecessary; the fallback is
cheap and self-evident if the gate fails.

**Alternatives considered**:
- *Set `allowImportingTsExtensions` preemptively* — deferred: add only if the gate demands
  it (YAGNI, Constitution I). The task list makes this conditional on the typecheck result.

## R4 — Typing the boundary to JSDoc-annotated JS (no `any`)

**Decision**: Derive types from the existing JSDoc-annotated modules rather than
hand-declaring parallel shapes.
- `parts`: `NonNullable<ReturnType<typeof composeColorParts>>` (import `composeColorParts`
  as a type from `../classify.js`). Non-null is correct — the linter guards `parts === null`
  and `!parts.base` before the spectral rule runs (`linter.js:42,54`).
- `ctx`: a local interface `{ tokens: ClassifierTokens; ansi: Ansi; ruleConfig?: RuleConfig }`.
  - `ClassifierTokens` — `{ semanticSet?: Set<string>; spectralSet?: Set<string> }` (the
    fields `classifyParts` / `findSpectralMatch` read; matches the JSDoc `tokens` param).
  - `Ansi` — `{ red(s: string): string; blue(s: string): string }` (the two helpers this
    rule calls; `ansi` also carries `dim`, not used here).
  - `RuleConfig` — `{ replacement?: ReplacementMap }`.
- `ReplacementMap` — `Record<string, Array<Record<string, string>>>`: a color-prefix key →
  list of single-entry `{ "name-shadeOrRange": semanticToken }` objects.
- Return type of `checkToken`: `string | null`.

**Rationale**: `allowJs: true` lets tsc read JSDoc types from `classify.js` even with
`checkJs: false` (checkJs gates *error reporting* in `.js`, not *type reading*). Deriving
`parts` from the source of truth prevents drift. The remaining shapes (`ctx`, replacement
map) are small and rule-local; declaring them inline is clearer than exporting new shared
types no one else consumes (YAGNI). No `any` is required.

**Alternatives considered**:
- *Hand-write a `parts` interface* — rejected: duplicates `composeColorParts`'s return shape
  and drifts when the classifier changes.
- *Export shared `Ctx`/`Tokens` types from `shared.js`* — rejected/out of scope: would pull
  sibling modules into the migration; only this one rule is in scope (FR-009).
- *`any` on the `replacement` map* — rejected: it has a precise, expressible shape; `any`
  would need an inline justification and none is warranted.

## R5 — Preserving exact behavior

**Decision**: Port the logic verbatim — the classifier-delegated `spectral` check, the
`findReplacement` range/single-shade parsing, the hint composition, and the message string
(`${ansi.red(base)} — spectral color class; use a design token instead${hint}`). Types are
added around the existing control flow; no branch is added, removed, or reordered.

**Rationale**: This is a language migration, not a refactor (spec Assumptions). The rule
already delegates the spectral decision to the classifier (prior shipped refactor); that is
retained as-is. Behavior parity is proven by the unchanged `.test.ts` suite (SC-003) and the
demo-app diff (SC-004).
