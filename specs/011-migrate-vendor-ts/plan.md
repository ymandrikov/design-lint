# Implementation Plan: Refactor and migrate the vendored Tailwind parsing primitives (`lint-color/vendor/**`) from JavaScript to TypeScript

**Branch**: `ym/explore` (feature dir `011-migrate-vendor-ts`) | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-migrate-vendor-ts/spec.md`

## Summary

Rewrite the four still-JavaScript vendored primitives under `lint-color/vendor/` as
TypeScript, restoring the type annotations the vendoring step deliberately dropped. In scope:
`is-color` (`isColor`, `isNamedColor`), `segment` (`segment`), `is-valid-arbitrary`
(`isValidArbitrary`), and `decode-arbitrary-value` (`decodeArbitraryValue` +
`convertUnderscoresToWhitespace` / `recursivelyDecodeArbitraryValues`). These four are the
**last** JavaScript source under `lint-color/` — every rule module, the classifier, the linter
factory, and the CLI entrypoint are already TypeScript (specs 002, 004–010).

The primitives are pure, self-contained ports of Tailwind CSS source files (ADR 0002). Their
signatures are simple and fully determined: `isColor(value: string): boolean`,
`isNamedColor(value: string): boolean`, `segment(input: string, separator: string): string[]`,
`isValidArbitrary(input: string): boolean`, `decodeArbitraryValue(input: string): string`. The
only non-trivial typing is `decode-arbitrary-value`'s node walk, which reads and mutates
`postcss-value-parser` AST nodes — that package ships a bundled `.d.ts` exporting a `Node`
union (`FunctionNode` with `nodes: Node[]`, `WordNode`/`DivNode`/`SpaceNode`/`StringNode`, each
with `value: string`), so the walk types against the parser's own `Node[]` with **zero** `any`.

One class of import edit, required by the `.ts`-specifier convention (proven by every migrated
sibling):

1. **Classifier** — `classify.ts` imports all four primitives via
   `from "./vendor/<name>.js"`; the four specifiers flip `.js`→`.ts`.
2. **Rule** — `no-raw-css-color.ts` imports `isColor` from `"../vendor/is-color.js"`; that one
   specifier flips to `.ts`.

The four vendor `*.test.ts` files import `"./<name>.js"`; the runner resolves a `.js`
specifier to the sibling `.ts` (proven across the migrated codebase), so they keep passing —
specifiers may flip to `.ts` mechanically, with no assertion edit. Each file's vendoring header
is updated so its "converted to plain JS (type annotations dropped)" note no longer misdescribes
the file, while the upstream source/commit/ADR-0002 citation (constitution I: vendored logic
MUST cite its upstream source) and the `decode-arbitrary-value` divergence note are preserved.

Node v26.1.0 runs `.ts` directly via native type stripping (proven by every migrated sibling),
so no build/bundle/loader step is added, and `tsconfig`'s `allowJs` is simply left in place
(toggling it is out of scope). Baseline to hold: `pnpm typecheck` clean, demo-app **23
violations, 1 suppressed** (exit 1), `pnpm test` **393 passing / 20 files**.

With `vendor/**` done, every `.js` source under `lint-color/` is gone — the whole linter,
vendored primitives included, is TypeScript.

## Technical Context

**Language/Version**: TypeScript source, run on Node v26.1.0 (native `.ts` type stripping; `type: module`, ESM); `tsconfig` `nodenext` module/resolution, `strict`, `noEmit`, `allowImportingTsExtensions`, `allowJs: true`, `checkJs: false` all already set. The primitives use character-code branching, a module-level `Uint8Array` bracket stack (`segment`, `is-valid-arbitrary`), a `Set`/regex color check (`is-color`), and a `postcss-value-parser` node walk (`decode-arbitrary-value`).

**Primary Dependencies**: `postcss-value-parser` (v4.2.0, an existing dependency) — ships a bundled `.d.ts` exporting `ValueParser`, `Node`, `FunctionNode`, etc.; `decode-arbitrary-value` types its node walk against that `Node` union, so **no** `any` and **no new dependency**. The other three primitives have no runtime imports. Consumers: `../classify.ts` (imports all four) and `../rules/no-raw-css-color.ts` (imports `isColor`).

**Storage**: None — the primitives are pure string/AST functions.

**Testing**: Each primitive has a dedicated `*.test.ts` (already TypeScript) — `is-color.test.ts`, `segment.test.ts`, `is-valid-arbitrary.test.ts`, `decode-arbitrary-value.test.ts`. All must stay green with zero assertion edits. Classifier-level and end-to-end parity via `classify`'s tests (which exercise the primitives transitively) and `pnpm lint:demo`.

**Target Platform**: Node CLI linter. The primitives are loaded as ESM namespaces by `classify.ts` and `no-raw-css-color.ts`.

**Project Type**: Single project — CLI linter. No frontend/backend split.

**Performance Goals**: No change. Type stripping is erasure-only; each primitive's character-code loop, shared-buffer stack, `Set`/regex lookup, and node walk are preserved exactly (constitution IV: parse-once, short-circuit). No extra pass, no re-parse, no new allocation.

**Constraints**: No build/bundle/loader step (SC-005). No `any` without inline justification (constitution I) — and as designed, **zero** `any` is needed (`postcss-value-parser` is typed; the other three are plain string functions). Observable behavior — color verdicts, segmentation, validity, decoded output — unchanged (FR-005…FR-010). Vendored-parity citation preserved; only the "plain JS" wording is corrected (FR-009, constitution I).

**Scale/Scope**: Four vendor modules swapped `.js`→`.ts` (70–110 lines each), plus import-specifier edits at two sites: `classify.ts` (4 lines) and `no-raw-css-color.ts` (1 line), plus four mechanical test-specifier flips. No sibling module logic, no tsconfig edit, no dependency change.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Verdict |
|-----------|------------|---------|
| I. Code Quality & Simplicity | Types the last untyped layer of the linter — the vendored primitives — directly serving "types are the primary contract" and completing the migration series (last `.js` under `lint-color/`). Vendored-parity rule honored: each file keeps its upstream source/commit/ADR-0002 citation; only the now-false "plain JS" note is corrected (FR-009). No new abstraction; behavior-preserving. As designed, zero `any` (`postcss-value-parser` ships types; the other three are plain string functions). | PASS |
| II. Testing Standards | Behavior-preserving migration — no new behavior, so no new test owed. Each primitive already has an exact-output `*.test.ts`; parity is held by those four suites staying green with zero assertion edits (SC-003), by `classify.ts`'s tests exercising the primitives transitively, and by `pnpm lint:demo` holding 23 / 1 (SC-004). No `.only`/skip introduced; the primitives are pure (no clock/network/order reliance). | PASS |
| III. UX Consistency | No output change: same color verdicts, same segmentation, same arbitrary-value decoding feed the classifier, so the same violations, messages, lines, and counts are produced (FR-010). No CLI flag, config key, rule name, exit code, or suppression change — no public-contract change, no version bump owed. | PASS |
| IV. Performance | Type stripping is erasure; zero runtime delta. Each primitive's character-code loop, shared `Uint8Array` stack, `Set`/regex color check, and `postcss-value-parser` node walk are preserved (FR-005…FR-008) — no extra pass, no new allocation, no re-parse. Parse-once/shared-structure invariant untouched (the classifier still calls each primitive exactly as today). | PASS |

**Result**: PASS, no violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/011-migrate-vendor-ts/
├── plan.md               # This file
├── research.md           # Phase 0 output
├── data-model.md         # Phase 1 output — primitive signatures + parser-node type
├── quickstart.md         # Phase 1 output — parity validation guide
├── contracts/
│   └── vendor-primitive.md   # Phase 1 output — the vendored-primitive public contract
├── checklists/
│   └── requirements.md   # Spec quality checklist (/speckit-specify)
└── tasks.md              # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
lint-color/vendor/
├── is-color.js                 → is-color.ts                 (isColor, isNamedColor; string → boolean)
├── segment.js                  → segment.ts                  (segment; string, string → string[])
├── is-valid-arbitrary.js       → is-valid-arbitrary.ts       (isValidArbitrary; string → boolean)
├── decode-arbitrary-value.js   → decode-arbitrary-value.ts   (decodeArbitraryValue; string → string; postcss-value-parser node walk)
└── *.test.ts                   # UNCHANGED assertions (specifiers may flip .js→.ts, mechanical)

lint-color/classify.ts                # EDIT: 4 import specifiers "./vendor/<name>.js" → ".ts"
lint-color/rules/no-raw-css-color.ts  # EDIT: 1 import specifier "../vendor/is-color.js" → ".ts"

# No package.json / tsconfig edit. No new dependency.
```

**Structure Decision**: Single-project CLI linter. The change is confined to four vendored
primitives swapped `.js`→`.ts`, their import specifiers in `classify.ts` and
`no-raw-css-color.ts`, and four mechanical test-specifier flips. No new directory, no tsconfig
edit (`allowImportingTsExtensions`/`checkJs`/`allowJs` already present), no dependency change.

## Complexity Tracking

No constitution violations — this section is intentionally empty.
