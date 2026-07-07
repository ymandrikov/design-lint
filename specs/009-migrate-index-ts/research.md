# Phase 0 Research: Migrate `index.js` → `index.ts`

The Technical Context carries no open `NEEDS CLARIFICATION` markers — this is a JS→TS migration
along a path this repo has walked five times (`ansi.ts`, `ast.ts`, `classify.ts`, `files.ts`,
`linter.ts`). What is *new* here: the file being migrated is the **invoked entrypoint**, not an
imported module, and it carries CLI concerns (`process.argv`/`process.exit`, top-level `await`,
a shebang) and two untyped seams (the ten `.js` rule namespaces and Tailwind's
`__unstable__loadDesignSystem`). The decisions below record where this migration differs.

## Decision 1: Run the `.ts` entrypoint directly, no build step

- **Decision**: Author `index.ts` and let Node v26.1.0 run it via native type stripping; add no compiler/bundler/loader.
- **Rationale**: `package.json` engine is `node ^26.1.0`; five sibling modules already ship as `.ts` and run under `pnpm lint:demo` / `pnpm test` with no build. `tsconfig` has `noEmit: true` — TypeScript is the type gate, not a JS producer. Top-level `await` (already used by `buildIsValidTailwindCandidate`) is native ESM and needs no config change under `type: module` + `nodenext`. Adding a build step would violate SC-005.
- **Alternatives considered**: Precompile to JS (rejected — build artifact + bundle stage the repo avoids); a loader/register hook (rejected — native stripping already covers it).

## Decision 2: Update the invocation *path*, not an import specifier — the `package.json` `lint:demo` script

- **Decision**: Change the `lint:demo` script `node lint-color/index.js fixtures/demo-app` → `node lint-color/index.ts fixtures/demo-app`. That is the **only** external edit.
- **Rationale**: This is the pivotal difference from 004/005/006/007/008. Those migrations edited *import specifiers* in the files that imported the migrated module. `index.js` is imported by **nothing** in-repo (`grep -rn "index\.js"` finds only the `lint:demo` script and prose in past specs). It is invoked by path. So renaming the file breaks exactly one thing — the script that names it — and fixing that one path is the whole external surface. Node resolves and type-strips `index.ts` the same way it already runs `node`-invoked `.ts` siblings transitively.
- **Alternatives considered**: Keep `index.js` and add a thin `.ts` alongside (rejected — leaves the JS source the migration exists to remove); add a `bin` entry (rejected — out of scope; no bin exists today and adding one is new public surface, FR-008).

## Decision 3: Import the ten `.js` rule namespaces unchanged — no rule migration

- **Decision**: Keep the ten `import * as ruleX from "./rules/..."` namespaces exactly as today (nine `.js`, one `.ts`); do not migrate or edit any rule module.
- **Rationale**: `tsconfig` sets `allowJs: true, checkJs: false`. TypeScript *resolves* the `.js` namespaces (so the `ruleLabel` builder can read `r.id` and `r.name`) but does not type-check their bodies; their exports surface permissively. The `ruleLabel` reducer maps over the ten namespaces reading `.id`/`.name` — at that seam the element type is effectively `any`; a single inline-justified annotation (or a small local `{ id: number; name: string }` view type) keeps `strict` happy without pulling the rules/ layer into scope (FR-008).
- **Alternatives considered**: Migrate all rule modules first (rejected — each rule is its own migration; massively widens scope); add `.d.ts` shims (rejected — redundant with `allowJs`, and with the eventual per-rule migrations).

## Decision 4: Treat `__unstable__loadDesignSystem` as a third-party seam; type only the callbacks we own

- **Decision**: Import `__unstable__loadDesignSystem` from `tailwindcss` as-is. Type the resolver callbacks' *parameters* (`loadStylesheet(id, base)`, `loadModule(id, base)` — strings) and the returned predicate (`(tok: string) => boolean`), but do not fabricate a type for the `ds` handle beyond what the package provides.
- **Rationale**: It is an `__unstable__` internal; its shape is not a contract the linter owns. The migration types what it controls — the callback signatures, the `entryCSS`/`local`/`pkgDir` locals, the returned `candidatesToCss([tok]).some(...)` predicate — and accepts whatever type (possibly `any`) the package exports for `ds`. Any `any` at this seam carries an inline justification (constitution I, SC-006). The `.catch(() => null)` fallback that yields `isValidTailwindCandidate: null` is preserved, so the tokens bundle's predicate field is `((tok: string) => boolean) | null`.
- **Alternatives considered**: Hand-write a `.d.ts` for the Tailwind internal (rejected — brittle against an `__unstable__` API; out of scope); cast the whole loader to `any` (rejected — over-broad; type the callbacks we own and localize `any` to the genuine seam).

## Decision 5: Consume the siblings' exported types; give the config + tokens bundle a declared shape

- **Decision**: Import values from the migrated siblings by their `.ts` specifiers (already done: `./ansi.ts`, `./files.ts`, `./classify.ts`, `./linter.ts`). Give the `colors.json` parse a declared config shape (`colorTokenFiles: string[]`, `rules: Record<string, { description?: string }>`, the `no-component-color-override.componentsDirectory` sub-field) and type the `tokens` bundle so it satisfies `createLinter`'s declared `tokens` parameter with **no cast**.
- **Rationale**: The whole point (US1) is that the wiring is type-checked against the contracts the siblings already export. `createLinter(config, tokens, ansi)` from `linter.ts` declares its parameter types; the migration's job is to build `config.rules ?? {}`, the `tokens` object, and the `ansi` object so they satisfy those declarations natively. `JSON.parse` returns `any`, so the config gets an explicit annotation at the parse boundary (inline-justified as the one external-data seam) rather than propagating `any` through every read.
- **Consequence**: If the `tokens` bundle and `createLinter`'s parameter disagree, that is a real contract mismatch surfaced by this migration — resolved by shaping the bundle, not by casting. `spectralSet`/`colorPrefixes` come typed from `classify.ts`; `semanticSet`/`uiComponents` are `Set<string>` built locally; `isValidTailwindCandidate` is `((tok: string) => boolean) | null`.
- **Alternatives considered**: Cast the tokens bundle to `createLinter`'s parameter type (rejected — hides mismatches the migration should surface); leave `config` as `any` from `JSON.parse` (rejected — defeats US1; the parse boundary is exactly where a declared shape earns its keep).

## Decision 6: No new unit test added by this migration

- **Decision**: Verify behavior parity via `pnpm typecheck` + unchanged `pnpm lint:demo` output (23 / 1, exit 1) + the full `pnpm test` suite staying green; add no new test.
- **Rationale**: A behavior-preserving migration owes no new test (constitution II — new *behavior* owes a test; there is none). This module is top-level wiring with no unit suite today; its behavior is fully exercised end-to-end by `pnpm lint:demo` (which runs the real entrypoint over the demo fixture and asserts the exact violation set) and transitively by the sibling suites under `pnpm test`. Adding a test would be new scope (FR-008).
- **Alternatives considered**: Add an entrypoint integration test (rejected — conflates a language migration with test authoring; `lint:demo` already is the end-to-end oracle).

## Decision 7: Preserve the shebang and CLI mechanics verbatim

- **Decision**: Keep `#!/usr/bin/env node`, `process.argv[2]`, `process.exit(0|1)`, `import.meta.url`/`fileURLToPath`, and `createRequire(import.meta.url)` exactly as today.
- **Rationale**: There is no `bin` entry, so the shebang is cosmetic (the file runs as `node lint-color/index.ts`, an argument to `node`), and it neither helps nor harms `.ts` execution — preserve it rather than churn. `process.argv`/`process.exit`/`import.meta` are typed by `@types/node` (already in `tsconfig` `types`), so they type-check with no added declaration.
- **Alternatives considered**: Drop the shebang (rejected — cosmetic-but-harmless; removing it is unrelated churn); add a `bin` entry to make the shebang load-bearing (rejected — new public surface, out of scope, FR-008).

## Baseline captured (must hold after migration)

- `pnpm typecheck` → zero errors.
- `pnpm lint:demo` → **23 violations found, 1 line suppressed** (exit 1 by design on violations).
- `pnpm test` → green.
