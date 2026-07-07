# Phase 0 Research: Migrate `lint-color/rules/**` JS → TS

No open `NEEDS CLARIFICATION` remained after the spec. This file records the decisions that
shape the migration, each grounded in an established repo precedent (specs 004–009).

## Decision 1 — Rename in place, `.js` → `.ts`, one file per rule

- **Decision**: Each of the nine rules is rewritten at the same path with a `.ts` extension; the `.js` file is deleted. No rule is split, merged, or renamed.
- **Rationale**: Matches every prior migration (`ansi`, `ast`, `classify`, `files`, `linter`, `index`, `no-spectral-color`). One rule = one module = one concern (constitution I). Keeping the basename keeps the registry diff to an extension flip.
- **Alternatives considered**: A single batch codemod that also re-homes helpers — rejected: out of scope, risks behavior drift, violates "delete over add / behavior-preserving."

## Decision 2 — Reuse the classifier's runtime contracts; declare `ctx`/`Ansi` locally per rule

- **Decision**: Rules import the classifier's exported runtime types from `classify.ts` (`ColorParts`, `Tokens`, `ColorVerdict`) for their `parts`/`tokens` surfaces, and declare a small self-contained local `ctx`/`Ansi`/`report` type carrying exactly the fields each rule reads. This mirrors the two established precedents in the codebase: the already-migrated `no-spectral-color.ts` (local `Ansi`/`Ctx`/`ClassifierTokens`) and the linter factory `linter.ts` (local `Ansi`/`Tokens`/ctx shapes).
- **Rationale**: `linter.ts` is the runtime dispatcher and it deliberately declares its rule/ctx types **locally** and does not import `helpers.ts` — whose own header scopes it to rule *tests* ("Shared types and test helpers for lint-color rule tests"). Coupling runtime rules to that test module would invert the dependency direction. Crucially, `helpers.ts`'s `TokenCtx.tokens` is `Record<string, unknown>`, which cannot express `tokens.semanticSet.has(...)` or `tokens.isValidTailwindCandidate(...)` without casts — so typing entrypoints as the `helpers.ts` `…Fn` aliases would *force* `any`/casts, the opposite of the goal. Reusing `classify.ts`'s `Tokens`/`ColorParts` (the real shapes the classifier and linter pass) plus a narrow local `ctx` gives honest types with zero casts. `linter.ts` types its dispatch `ctx` without `ruleConfig` and matches rule methods bivariantly, so a rule's narrow local `ctx` (with `ruleConfig?` optional) stays assignable.
- **Alternatives considered**: Type entrypoints as `helpers.ts`'s `CheckTokenFn`/`LintSourceFn` etc. — rejected: `TokenCtx.tokens: Record<string, unknown>` forces casts to read token fields, and it couples runtime code to the test-harness module against the `linter.ts`/`no-spectral-color.ts` precedent. Editing `helpers.ts` to tighten `tokens` — out of scope (`helpers.ts` is not modified) and would ripple into the test harness.

## Decision 3 — `.ts` import specifiers at every runtime importer

- **Decision**: Flip `"./rules/<name>.js"` → `".ts"` for the nine migrated rules in both `linter.ts` and `index.ts`, and flip `no-component-color-override`'s `"./no-raw-css-color.js"` → `".ts"`.
- **Rationale**: Repo convention for migrated modules is explicit `.ts` specifiers (`no-spectral-color.ts` is imported as `"./rules/no-spectral-color.ts"`; `classify.ts` as `"../classify.ts"`). Although `allowJs: true, checkJs: false` would let a stale `.js` specifier resolve permissively, the convention is `.ts`-explicit for migrated files, and a specifier pointing at a deleted `.js` must change regardless.
- **Alternatives considered**: Leave `.js` specifiers relying on loader fallback — rejected: inconsistent with the established convention and points at deleted files.

## Decision 4 — Test files: assertions frozen, specifiers optional

- **Decision**: No test assertion or logic changes. A test's own `import … from "./<name>.js"` may be flipped to `.ts` for consistency, but this is optional and mechanical.
- **Rationale**: The runner already resolves a `.js` specifier to the sibling `.ts` (proven: `no-spectral-color.test.ts` imports `"./no-spectral-color.js"` against a `.ts`-only module and passes). The suites are the parity oracle; touching assertions would defeat the point.
- **Alternatives considered**: Rewrite tests to `.ts` specifiers wholesale — unnecessary; keep the diff minimal.

## Decision 5 — Vendored / untyped seams get a justified `any`

- **Decision**: In `no-raw-css-color`, the `postcss-value-parser` import and the vendored `./vendor/is-color.js` call are typed as narrowly as practical; where no type exists, an explicit `any` (or `unknown` narrowed at the call site) carries a one-line inline justification citing the untyped upstream.
- **Rationale**: Constitution I permits `any` with an inline justification; the vendored parity helpers are explicitly out of scope to re-vendor or re-type. `postcss-value-parser` walks a loosely-typed node tree.
- **Alternatives considered**: Author full `.d.ts` for the vendored helper — out of scope; would expand the change beyond the rule bodies.

## Decision 6 — Migration order & cross-rule pair

- **Decision**: Migrate `no-raw-css-color` before or together with `no-component-color-override`, since the latter imports `findRawColor` from the former. Because each rule is an independent file plus a specifier flip, order is otherwise free; the eight non-dependent rules can be migrated in any order (parallelizable).
- **Rationale**: The one intra-`rules/` dependency is the only ordering constraint. `pnpm typecheck` + the full suite are run once at the end to confirm the whole set resolves.
- **Alternatives considered**: Strict sequential one-rule-at-a-time with a typecheck between each — safe but slower; the end-state gate (typecheck + tests + demo parity) is authoritative, so a single final verification suffices.

## Runtime-loading confirmation

Node v26.1.0 native type stripping runs `.ts` sources directly with no build step — proven in
this repo by `ansi.ts`, `ast.ts`, `classify.ts`, `files.ts`, `helpers.ts`, `linter.ts`,
`index.ts`, and `no-spectral-color.ts`. `tsconfig` already carries
`allowImportingTsExtensions`, `nodenext`, `strict`. No loader, bundler, or tsconfig change is
required by this migration.
