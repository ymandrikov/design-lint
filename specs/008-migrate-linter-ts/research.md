# Phase 0 Research: Migrate `linter.js` → `linter.ts`

The Technical Context carries no open `NEEDS CLARIFICATION` markers — this is a JS→TS
migration of a 209-line orchestration module along a path this repo has walked five times
(`ast.ts`, `ansi.ts`, `classify.ts`, `files.ts`, `no-spectral-color.ts`). It is larger and
more connected than 007 (a factory with five methods and a rule-dispatch layer, three
importers, and ten rule namespaces), so the decisions below record where this migration
differs.

## Decision 1: Run the `.ts` module directly, no build step

- **Decision**: Author `linter.ts` and let Node v26.1.0 run it via native type stripping; add no compiler/bundler/loader.
- **Rationale**: `package.json` engine is `node ^26.1.0` and five sibling modules already ship as `.ts` and run under `pnpm lint:demo` / `pnpm test` with no build. `tsconfig` has `noEmit: true` — TypeScript is the type gate, not a producer of JS. Adding a build step would violate SC-005.
- **Alternatives considered**: Precompile to JS (rejected — build artifact + bundle stage the repo avoids); a loader/register hook (rejected — native stripping already covers it).

## Decision 2: Update all three import specifiers to `.ts`

- **Decision**: Change `./linter.js` → `./linter.ts` in the three importers: `lint-color/index.js`, `lint-color/linter.test.ts`, `lint-color/linter.lintCss.test.ts`.
- **Rationale**: Repo convention for migrated modules is to import by the real `.ts` specifier (`index.js` already imports `./ast.ts`, `./classify.ts`; the test files already import `./classify.ts`). `tsconfig` has `allowImportingTsExtensions: true`, so the typecheck accepts it, Node resolves the real file at runtime, and Vitest resolves it for the suites.
- **Difference from 007**: 007 had a single importer; this engine has three (one runtime, two test). All three must change in lockstep — a missed one either fails to resolve (runtime) or leaves a suite importing the deleted `.js` (tests). The two suites are the behavior oracle, so they must resolve the new module and pass unchanged.
- **Alternatives considered**: Keep `./linter.js` and rely on runner extension resolution (rejected for `index.js` — `node index.js` must resolve a real path; and leaving the tests on `.js` after deleting the file breaks resolution).

## Decision 3: Import the `.js` rule modules unchanged — no rule migration

- **Decision**: Keep the ten `import * as ruleX from "./rules/..."` namespaces exactly as today (nine `.js`, one `.ts`); do not migrate or edit any rule module.
- **Rationale**: `tsconfig` sets `allowJs: true, checkJs: false`. TypeScript therefore *resolves* the `.js` rule namespaces (so `ruleX.name`, `ruleX.id`, `ruleX.lintSource`/`checkToken`/`checkValue` are visible) but does not type-check their bodies; their exported functions surface as permissive `any`-param signatures. That is enough for the engine's dispatch helpers to call them without error, and it keeps the ten rules — and the whole rules/ layer — out of scope (FR-008). `no-spectral-color.ts` (already `.ts`) is imported the same way and needs no special handling.
- **Alternatives considered**: Migrate all rule modules first (rejected — massively widens scope beyond this feature; each rule is its own migration, as `no-spectral-color.ts` was); add `.d.ts` shims for the `.js` rules (rejected — unnecessary given `allowJs`, and redundant with the eventual per-rule migrations).

## Decision 4: Source the shared types from `classify.ts` and local definitions, not `helpers.ts`

- **Decision**: Derive `ColorParts` (and, where useful, `Tokens`) from `./classify.ts` — the classifier is the source of truth for a token's decomposed shape — and define the engine-local types (`Violation`, the `tokens`/`config`/`ansi` shapes, the rule-module dispatch types) inline in `linter.ts`. Do **not** import types from `helpers.ts`.
- **Rationale**: `helpers.ts` is the *test* helpers module ("Shared types and test helpers for lint-color rule tests"); production code must not depend on it, even for types. The already-migrated production rule `no-spectral-color.ts` sets the precedent: it derives `Parts` from `composeColorParts` and defines its `Ansi`/`Ctx` locally rather than reaching into `helpers.ts`. `linter.ts` follows the same convention, so the two files' type vocabularies stay parallel without a test→production coupling.
- **Consequence for the ctx types**: the dispatch helpers pass `{ tokens, ansi, ruleConfig }` / `{ report, tokens, ansi, ruleConfig }` to rules. Because nine rules are `.js` (permissive) and `no-spectral-color.ts` defines its own `Ctx`, the engine's ctx types are shaped to satisfy the typed rule while accepting the runtime token object — using widened member types (e.g. `Record<string, unknown>`-style tokens, matching the proven shape in `helpers.ts`) where a tighter type would trip `strictFunctionTypes` variance. Verified empirically by `pnpm typecheck`.
- **Alternatives considered**: Import the types from `helpers.ts` (rejected — production-depends-on-test-file smell); introduce a new shared `types.ts` (rejected — out of scope for this migration; a future refactor could hoist the vocabulary if the duplication grows).

## Decision 5: No new unit test added by this migration

- **Decision**: Verify behavior parity via `pnpm typecheck` + the two existing suites (`linter.test.ts`, `linter.lintCss.test.ts`) staying green + unchanged `pnpm lint:demo` output; add no new test.
- **Rationale**: A behavior-preserving migration owes no new test (constitution II — new *behavior* owes a test; there is none here). Unlike 007, this module is already well covered: the two suites assert per-rule enable/disable gating, split integrity, and the CSS path. They pin behavior; the migration must leave their assertions untouched (only the import specifier changes). Adding tests would be new scope (FR-008).
- **Alternatives considered**: Extend the suites while migrating (rejected — conflates a language migration with test authoring; defer any coverage gaps to a dedicated change).

## Baseline captured (must hold after migration)

- `pnpm typecheck` → zero errors.
- `pnpm lint:demo` → **23 violations found, 1 line suppressed** (exit 1 by design on violations).
- `pnpm test` → green, including `linter.test.ts` and `linter.lintCss.test.ts`.
