# Phase 0 Research: Migrate `files.js` → `files.ts`

The Technical Context carries no open `NEEDS CLARIFICATION` markers — this is a mechanical
JS→TS migration of a 20-line, two-function module along a path this repo has walked four
times (`ast.ts`, `ansi.ts`, `classify.ts`, `no-spectral-color.ts`). Research below records
the decisions the migration rests on.

## Decision 1: Run the `.ts` module directly, no build step

- **Decision**: Author `files.ts` and let Node v26.1.0 run it via native type stripping; add no compiler/bundler/loader.
- **Rationale**: `package.json` engine is `node ^26.1.0` and four sibling modules already ship as `.ts` and run under `pnpm lint:demo` with no build. `tsconfig` has `noEmit: true` — TypeScript is the type gate, not a producer of JS. Adding a build step would violate SC-004.
- **Alternatives considered**: Precompile to JS (rejected — introduces a build artifact and a bundle stage the repo deliberately avoids); a loader/register hook (rejected — native stripping already covers it).

## Decision 2: Import the migrated module by its `.ts` specifier

- **Decision**: Change the sole importer `lint-color/index.js` from `import { ... } from "./files.js"` to `"./files.ts"`.
- **Rationale**: Repo convention for migrated modules is to import by the real `.ts` specifier (`index.js` already imports `./ansi.ts`, `./classify.ts`). `tsconfig` has `allowImportingTsExtensions: true`, so the typecheck accepts it, and Node resolves the real file at runtime.
- **Alternatives considered**: Keep the `./files.js` specifier and rely on runner extension resolution (rejected for the runtime entrypoint — `node index.js` must resolve a real path; the `.js`→`.ts` runner trick is a test-runner behavior, and there is no test importing this module anyway).

## Decision 3: Read `e.parentPath` alone — the `?? path` fallback is dead and its type is gone

- **Decision**: Let the walk's entries infer as `Dirent<string>` from `readdirSync`; read `e.parentPath` (no cast, no `any`), dropping the JS `?? e.path` fallback.
- **Finding (corrected during implementation)**: The initial assumption was that `Dirent.path` is merely *deprecated* and still typed. It is not — under `@types/node ^26.1.0` the `path` alias has been **removed from the `Dirent` type**, so `e.parentPath ?? e.path` fails typecheck with `TS2339: Property 'path' does not exist on type 'Dirent<string>'`.
- **Rationale for dropping it**: `Dirent.parentPath` has been populated on every entry since Node 20, so `parentPath` is never nullish and the `?? e.path` branch was never reached at runtime. Removing it is therefore output-identical, verified by the unchanged demo-app violation set (23 / 1). `.isFile()`, `.name`, `extname`, and `join` are all typed by the standard-library declarations; `e` infers as `Dirent<string>` with no explicit annotation, so no `Dirent` import is needed.
- **Alternatives considered**: Cast to reach the removed alias, e.g. `(e as Dirent & { path?: string })` (rejected — an unjustified cast to resurrect dead code; constitution I forbids it); keep `?? e.path` and suppress the error (rejected — silencing a real "this field is gone" signal). A one-line comment on the `.map` records *why* the fallback vanished versus the JS.

## Decision 4: No unit test added by this migration

- **Decision**: Verify behavior parity via `pnpm typecheck` + unchanged `pnpm lint:demo` output; do not add `files.test.ts`.
- **Rationale**: The module has no unit suite today, and a behavior-preserving migration owes no new test (constitution II — new *behavior* owes a test; there is none here). `pnpm lint:demo` exercises `getAllFiles` and `isStorybookFile` end-to-end through the CLI and pins the 23-violation / 1-suppressed baseline. Adding a test would be new scope, not migration scope (FR-008).
- **Alternatives considered**: Add a focused `files.test.ts` (permitted but not required; deferred to keep the change minimal and reviewable, consistent with the sibling migration specs).

## Baseline captured (must hold after migration)

- `pnpm typecheck` → zero errors.
- `pnpm lint:demo` → **23 violations found, 1 line suppressed** (exit 1 by design on violations).
- `pnpm test` → green (no test imports this module; suite unaffected).
