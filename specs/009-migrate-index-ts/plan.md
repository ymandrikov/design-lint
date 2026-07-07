# Implementation Plan: Refactor and migrate the CLI entrypoint (`index.js`) from JavaScript to TypeScript

**Branch**: `ym/explore` (feature dir `009-migrate-index-ts`) | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-migrate-index-ts/spec.md`

## Summary

Rewrite `lint-color/index.js` as `lint-color/index.ts`, typing the linter's entrypoint — the
top of the call tree that assembles every already-migrated sibling into a run. The migration
types: the target-root resolution off `process.argv`, the `buildIsValidTailwindCandidate`
design-system loader (its `loadStylesheet`/`loadModule` resolver callbacks and the returned
predicate), the `colors.json` config parse, the derived semantic-token set, `loadUiComponents`
+ `kebabToPascal`, the `{ semanticSet, spectralSet, colorPrefixes, uiComponents,
isValidTailwindCandidate }` **tokens bundle** passed to `createLinter`, the `accumulate` helper
with its `{ violations, ignores }` records, and the grouped report-formatting locals.

Unlike the five sibling migrations (004/005/006/007/008), `index.js` is **not imported by any
in-repo module** — it is invoked *by path*. So the one non-source edit is the `package.json`
`lint:demo` script: `node lint-color/index.js` → `node lint-color/index.ts`. The ten
`import * as rule... from "./rules/*.js"` namespaces stay exactly as today (under `allowJs:
true, checkJs: false` they resolve permissively); no rule module is migrated. The Tailwind
internal `__unstable__loadDesignSystem` remains a third-party seam. Node v26.1.0 runs `.ts`
directly via native type stripping (proven by `ast.ts`, `classify.ts`, `linter.ts`, …), so no
build/bundler/loader step is added. Baseline to hold: `pnpm typecheck` clean, demo-app **23
violations, 1 suppressed** (exit 1), `pnpm test` green.

This is the **terminal** migration of the series: with `index.ts` done, every non-`rules/`
module in `lint-color/` is TypeScript.

## Technical Context

**Language/Version**: TypeScript source, run on Node v26.1.0 (native `.ts` type stripping; `type: module`, ESM); `tsconfig` `module`/`moduleResolution` `nodenext`, `strict`, `noEmit`, `allowImportingTsExtensions`, `allowJs: true`, `checkJs: false` all already set. Uses top-level `await` (ESM), `process.argv`, `process.exit`, `import.meta.url`.

**Primary Dependencies**: `tailwindcss` (`__unstable__loadDesignSystem` — internal/untyped seam); Node builtins (`node:fs`, `node:path`, `node:module` `createRequire`, `node:url` `fileURLToPath`/`pathToFileURL`); the already-migrated siblings `./ansi.ts` (`bold`,`dim`,`red`), `./files.ts` (`getAllFiles`,`isStorybookFile`), `./classify.ts` (`TAILWIND_COLOR_PREFIXES`,`TAILWIND_SPECTRAL_COLORS`), `./linter.ts` (`createLinter`); the ten `./rules/*` namespaces (nine `.js`, one `.ts`). No new dependency.

**Storage**: Reads from disk — `design-system/lint/colors.json`, the `colorTokenFiles` CSS, the components directory, and the walked `src/` tree. The entrypoint owns the file I/O; siblings operate on the strings it reads.

**Testing**: No dedicated unit suite for this module (it is the top-level wiring). Behavior is verified end-to-end by `pnpm lint:demo` over `fixtures/demo-app` (exact violation set + suppression summary + exit code) and by `pnpm typecheck`. The full `pnpm test` suite MUST stay green (it exercises the siblings this file drives).

**Target Platform**: Node CLI, invoked by path — `node lint-color/index.ts [target-root]` and via `pnpm lint:demo`.

**Project Type**: Single project — CLI linter. No frontend/backend split.

**Performance Goals**: No change. Type stripping is erasure-only; the two-pass file walk (CSS pass, then TS/TSX pass), the compose-once-per-file rule dispatch, and the `Map.groupBy` report build are preserved exactly, so runtime cost is identical.

**Constraints**: No build/bundle/loader step (SC-005). No `any` without inline justification (constitution I) — expected only at the ten `.js`-rule-namespace seam and the Tailwind `__unstable__loadDesignSystem` internal. Observable behavior — files scanned, violations, messages, counts, suppression summary, exit codes — unchanged (FR-002, FR-007). No new configuration surface (FR-008).

**Scale/Scope**: One module (187 lines: three helper functions + top-level config/tokens assembly + two-pass run loop + report formatter) swapped `.js`→`.ts`, plus **one** `package.json` `lint:demo` script-path edit. No rule modules, no sibling modules, no vendored helpers, no tsconfig edit.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Verdict |
|-----------|------------|---------|
| I. Code Quality & Simplicity | Types the entrypoint that wires the whole linter — directly serves "types are the primary contract" and completes the layer (last non-`rules/` `.js`). Single-concern preserved (orchestration + CLI I/O + report format); no new abstraction; behavior-preserving refactor only. The `tokens` bundle now type-satisfies `createLinter`'s declared parameter with no cast. `any` is expected only at the `.js`-rule-namespace and Tailwind-internal seams, each inline-justified. | PASS |
| II. Testing Standards | Behavior-preserving migration — no new behavior, so no new test owed (constitution II). This module has no unit suite (it is top-level wiring); parity is held by the unchanged `pnpm lint:demo` output (23 / 1, exit 1 — SC-003) and `pnpm typecheck`, plus the full `pnpm test` suite (exercising the driven siblings) staying green. Deterministic: no wall-clock/network/order reliance introduced. | PASS |
| III. UX Consistency | No output change: same files scanned, same violations, messages, rule grouping/labels, suppression counts + `>10` hint, and exit codes 0/1 (FR-002, FR-007). No public-contract change to rule names/ids/config keys/suppression syntax. The `lint:demo` script path changes (`index.js`→`index.ts`) — an internal invocation path, not a documented CLI flag/config key, so no version bump owed. | PASS |
| IV. Performance | Type stripping is erasure; zero runtime delta. The two-pass walk, the per-file dispatch, and the grouped-report build are preserved (FR-005, FR-006, FR-007) — no extra pass, no new allocation, no re-parse. | PASS |

**Result**: PASS, no violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/009-migrate-index-ts/
├── plan.md               # This file
├── research.md           # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── cli-entrypoint.md # Phase 1 output — invocation + I/O contract
└── tasks.md              # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
lint-color/
├── index.js                # DELETE (replaced)
├── index.ts                # NEW (migrated entrypoint)
├── ansi.ts                 # UNCHANGED — imported as "./ansi.ts"
├── files.ts                # UNCHANGED — imported as "./files.ts"
├── classify.ts             # UNCHANGED — imported as "./classify.ts"
├── linter.ts               # UNCHANGED — imported as "./linter.ts"
└── rules/*.js|.ts          # UNCHANGED — ten namespaces imported as today (not migrated)

package.json                # EDIT: lint:demo script "node lint-color/index.js" → "…/index.ts"

# No other file imports index; it is invoked by path, so package.json is the only external edit.
```

**Structure Decision**: Single-project CLI linter. The change is confined to one module
swapped `.js`→`.ts` plus one `package.json` script-path edit. No new directories, no tsconfig
edit (`allowJs`/`allowImportingTsExtensions`/`checkJs` already present), no dependency change.

## Complexity Tracking

No constitution violations — section intentionally empty.
