# Implementation Plan: Refactor and migrate the color-rule modules (`lint-color/rules/**`) from JavaScript to TypeScript

**Branch**: `ym/explore` (feature dir `010-migrate-rules-ts`) | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-migrate-rules-ts/spec.md`

## Summary

Rewrite the nine still-JavaScript rule modules under `lint-color/rules/` as TypeScript,
typing each rule's `parts`/`tokens` against the classifier's runtime contracts (`classify.ts`)
plus a small self-contained local `ctx`/`Ansi` type, mirroring `no-spectral-color.ts`/`linter.ts`. In scope
(by `id`): `no-style-color` (1), `no-raw-css-color` (2), `no-opacity-modifier` (3),
`token-constraints` (5), `no-var-color` (6), `no-dark-variant` (9), `no-useless-hover` (10),
`no-component-color-override` (11), `no-undefined-token` (12). `no-spectral-color` (4) is
already `.ts` and is out of scope.

Each rule exports `id`, `name`, and one or more check entrypoints — `checkToken(rawTok,
parts, ctx)`, `lintSource(source, filePath, ctx)`, and for `no-raw-css-color` also
`findRawColor(value)` / `checkValue(value, ctx)`. The migration types `parts` as `ColorParts`
and `tokens` as `Tokens` (both from `classify.ts`), declares a narrow local `ctx`/`Ansi` per
rule (carrying only the fields it reads), and types each rule's internal helpers (`isColorToken`,
`matchPattern`, `attrStringValue`, `elementIsInteractive`, the `no-useless-hover` `Set` tables,
the JSX-walk locals via oxc node types, etc.). `helpers.ts` (the test-harness module) is not
imported by the rules — matching `linter.ts`, which declares its own local dispatch/ctx types.

Two classes of import edit, both required by the `.ts`-specifier convention (proven by
`no-spectral-color.ts`):
1. **Registry** — `linter.ts` and `index.ts` each import all ten rules via `import * as
   rule… from "./rules/<name>.js"`. The nine migrated specifiers flip `.js`→`.ts`
   (`no-spectral-color.ts` already `.ts`).
2. **Cross-rule** — `no-component-color-override` imports `findRawColor` from
   `"./no-raw-css-color.js"`; that specifier flips to `.ts`.

Rules that consume the classifier already import `../classify.ts` (correct `.ts` already).
The vendored seams (`postcss-value-parser`, `vendor/is-color.js`) stay as-is. Node v26.1.0
runs `.ts` directly via native type stripping (proven by every migrated sibling), so no
build/bundle/loader step is added. Baseline to hold: `pnpm typecheck` clean, demo-app **23
violations, 1 suppressed** (exit 1), `pnpm test` **393 passing / 20 files**.

This is the **final** migration of the series: with `rules/**` done, every `.js` source in
`lint-color/` is gone — the whole linter is TypeScript.

## Technical Context

**Language/Version**: TypeScript source, run on Node v26.1.0 (native `.ts` type stripping; `type: module`, ESM); `tsconfig` `nodenext` module/resolution, `strict`, `noEmit`, `allowImportingTsExtensions`, `allowJs: true`, `checkJs: false` all already set. Rules use JSX-AST walking (via the `ast.ts` helpers `parseSource`/`walk`/`jsxName`/`styleObjectProps`/`classNameStatics(Deep)`, backed by an oxc parse), `Set` lookups, and string parsing.

**Primary Dependencies**: `postcss-value-parser` (ships a bundled `.d.ts` — typed, so its node walk needs no `any`; used only by `no-raw-css-color`); the vendored `./vendor/is-color.js` (its `isColor` export is inferred under `allowJs`); the already-migrated `../classify.ts` (`classifyParts`, `classifyColorPart`, `composeColorParts`, and the `ColorParts`/`Tokens`/`ColorVerdict` types); `../ast.ts` (JSX-walk helpers + oxc node types). `helpers.ts` is the test-harness module and is **not** imported by the rules. No new dependency.

**Storage**: None directly — rules operate on the source strings and parsed candidates the linter hands them. File I/O is owned by `index.ts`, out of scope.

**Testing**: Each rule has a dedicated `*.test.ts` (already TypeScript) — `no-style-color.test.ts`, `no-raw-css-color.test.ts` + `no-raw-css-color.checkValue.test.ts`, `no-opacity-modifier.test.ts`, `token-constraints.test.ts`, `no-var-color.test.ts`, `no-dark-variant.test.ts`, `no-useless-hover.test.ts`, `no-component-color-override.test.ts`, `no-undefined-token.test.ts` — plus `linter.test.ts`, `linter.lintCss.test.ts`, and `tests/e2e.test.ts`. All must stay green with zero assertion edits. End-to-end parity via `pnpm lint:demo`.

**Target Platform**: Node CLI linter. Rules are loaded as ESM namespaces by the registry (`linter.ts`, `index.ts`).

**Project Type**: Single project — CLI linter. No frontend/backend split.

**Performance Goals**: No change. Type stripping is erasure-only; each rule's detection walk, `Set` lookups, and per-candidate dispatch are preserved exactly (constitution IV: parse-once, short-circuit out-of-scope). No extra pass, no re-parse.

**Constraints**: No build/bundle/loader step (SC-005). No `any` without inline justification (constitution I) — and as built, **zero** `any` was needed (`postcss-value-parser` is typed; `isColor` infers). Observable behavior — tokens/elements flagged, messages, lines, counts — unchanged (FR-005…FR-012). No new configuration surface. Reuse `classify.ts`'s `ColorParts`/`Tokens` for `parts`/`tokens`; declare `ctx`/`Ansi` locally per rule (SC-006).

**Scale/Scope**: Nine rule modules swapped `.js`→`.ts` (≈ 25–130 lines each), plus import-specifier edits at three sites: `linter.ts` (9 lines), `index.ts` (9 lines), and `no-component-color-override`'s cross-rule import (1 line). No sibling module, no vendored helper, no tsconfig edit, no `helpers.ts` edit.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Verdict |
|-----------|------------|---------|
| I. Code Quality & Simplicity | Types the last untyped layer of the linter — the rule bodies — directly serving "types are the primary contract" and completing the migration series (last `.js` under `lint-color/`). Single-concern preserved: each rule stays one check, kebab-named, matching `CONTEXT.md`. No new abstraction; behavior-preserving refactor only. Rules reuse `classify.ts`'s `ColorParts`/`Tokens` for `parts`/`tokens` and declare `ctx`/`Ansi` locally, mirroring `no-spectral-color.ts`/`linter.ts` (SC-006). As built, zero `any` (the `postcss-value-parser` seam is typed). | PASS |
| II. Testing Standards | Behavior-preserving migration — no new behavior, so no new test owed. Every rule already has an exact-output `*.test.ts`; parity is held by those suites plus `linter.test.ts`, `linter.lintCss.test.ts`, and `tests/e2e.test.ts` staying green with zero assertion edits (SC-003), and by `pnpm lint:demo` holding 23 / 1 (SC-004). No `.only`/skip introduced; deterministic (no clock/network/order reliance added). | PASS |
| III. UX Consistency | No output change: same tokens/elements flagged, same file/line/rule-name/message shape, same rule ids and names, same exit codes, same suppression counts (FR-005…FR-012). No CLI flag, config key, rule name, or suppression-directive change — no public-contract change, so no version bump owed. | PASS |
| IV. Performance | Type stripping is erasure; zero runtime delta. Each rule's short-circuit on out-of-scope input, `Set`-based lookups, and single-pass candidate dispatch are preserved (FR-005…FR-011) — no extra pass, no new allocation, no re-parse. Parse-once/shared-structure invariant untouched (rules still receive `parts` from the shared compose). | PASS |

**Result**: PASS, no violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/010-migrate-rules-ts/
├── plan.md               # This file
├── research.md           # Phase 0 output
├── data-model.md         # Phase 1 output — rule-module + ctx type shapes
├── quickstart.md         # Phase 1 output — parity validation guide
├── contracts/
│   └── rule-module.md    # Phase 1 output — the rule-module public contract
├── checklists/
│   └── requirements.md   # Spec quality checklist (/speckit-specify)
└── tasks.md              # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
lint-color/rules/
├── no-style-color.js               → no-style-color.ts               (id 1, lintSource)
├── no-raw-css-color.js             → no-raw-css-color.ts             (id 2, checkToken/findRawColor/checkValue)
├── no-opacity-modifier.js          → no-opacity-modifier.ts          (id 3, checkToken)
├── token-constraints.js            → token-constraints.ts            (id 5, checkToken/matchPattern)
├── no-var-color.js                 → no-var-color.ts                 (id 6, checkToken)
├── no-dark-variant.js              → no-dark-variant.ts              (id 9, checkToken)
├── no-useless-hover.js             → no-useless-hover.ts             (id 10, lintSource + Set tables)
├── no-component-color-override.js  → no-component-color-override.ts  (id 11, lintSource/isColorToken; imports findRawColor)
├── no-undefined-token.js           → no-undefined-token.ts           (id 12, checkToken)
├── no-spectral-color.ts            # UNCHANGED — already migrated (id 4)
├── *.test.ts                       # UNCHANGED assertions (specifiers may flip .js→.ts, mechanical)
└── vendor/, ../classify.ts, ../helpers.ts   # UNCHANGED — imported as today

lint-color/linter.ts   # EDIT: 9 rule-import specifiers "./rules/<name>.js" → ".ts"
lint-color/index.ts    # EDIT: 9 rule-import specifiers "./rules/<name>.js" → ".ts"

# no-component-color-override imports findRawColor from "./no-raw-css-color.js" → ".ts" (in the migrated file).
# No package.json / tsconfig edit.
```

**Structure Decision**: Single-project CLI linter. The change is confined to nine rule
modules swapped `.js`→`.ts`, their registry specifiers in `linter.ts`/`index.ts`, and one
cross-rule specifier. No new directory, no tsconfig edit (`allowImportingTsExtensions`/
`checkJs`/`allowJs` already present), no dependency change, no `helpers.ts` edit.

## Complexity Tracking

No constitution violations — section intentionally empty.
