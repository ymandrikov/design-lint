# Phase 0 Research: classify.js → TypeScript migration

No open `NEEDS CLARIFICATION` — the migration pattern is established by shipped specs
002 (`no-spectral-color`), 004 (`ansi`), and 005 (`ast`). Decisions below record the choices
this module inherits and the two points where it differs from the ast migration.

## Decision 1 — Run `.ts` directly, no build step

**Decision**: Rename `classify.js` → `classify.ts`; rely on Node v26.1.0 native type
stripping. No transpile, bundle, or loader.

**Rationale**: The repo already ships and runs `ast.ts`, `ansi.ts`, and `no-spectral-color.ts`
this way (`node lint-color/index.js`). Type stripping is erasure-only, so runtime and
performance are unchanged (constitution IV; SC-005).

**Alternatives considered**: A build/emit step — rejected: adds tooling the repo deliberately
avoids and would violate SC-005.

## Decision 2 — Import specifiers: `.ts` for runtime importers, `.ts` for tests too

**Decision**: Update all eight runtime importers to the `.ts` specifier. Also update the test
files' specifiers to `.ts` for consistency, changing no assertion or logic.

**Rationale**: Runtime entrypoints (`node index.js`) resolve the explicit `.ts` specifier —
the shipped convention (`import … from "./ansi.ts"`, `"./rules/no-spectral-color.ts"`).
The test runner (Vitest) additionally resolves a `.js` specifier to the sibling `.ts` file
(proven: `no-spectral-color.test.ts` imports `"./no-spectral-color.js"` against a `.ts`-only
module and its 19 tests pass), so tests would keep resolving untouched — but aligning them to
`.ts` removes the stale `.js` reference and matches the runtime convention. FR-011/SC-003 are
about assertion/logic parity, which a specifier edit does not touch.

**Alternatives considered**: Leave test specifiers as `.js` — rejected: leaves a dangling
`.js` reference to a file that no longer exists, readable only because the runner is lenient.

## Decision 3 — No tsconfig change needed

**Decision**: No `tsconfig.json` edit.

**Rationale**: The ast migration (005) already added `allowImportingTsExtensions: true`
(confirmed present in the current `tsconfig.json`), which is what lets a type-checked `.ts`
file (`helpers.ts`) statically import a `.ts` module by explicit extension. `classify.ts` is
imported by the same already-configured toolchain, so no further flag is required.

**Alternatives considered**: none — the flag is already in place.

## Decision 4 — Type the verdict as a named union; no `any` expected

**Decision**: Introduce `ColorVerdict = "semantic" | "spectral" | "static" | "raw" | "var" |
null` and named types for the token-split, composed-parts, spectral-match, arbitrary-property,
and token-set shapes. Reuse the exact string literals the JSDoc already documents.

**Rationale**: Unlike the ast layer, this module reads plain strings and `Set<string>`, not
reflective oxc AST nodes — there is no permissive-`walk` boundary. Every value has a concrete
static type, so the migration is expected to introduce **zero** `any` (SC-006). The verdict
strings are already the runtime return values (per the JSDoc `@returns`), so naming the union
changes no behavior.

**Alternatives considered**: Inline the union at each return site — rejected: a named type is
the contract five rule modules branch on; naming it once is the point of the migration.

## Decision 5 — Vendored helpers stay untyped-at-source, typed-at-call

**Decision**: Call `segment`, `isValidArbitrary`, `decodeArbitraryValue`, `isColor` from
`./vendor/*` exactly as today. Do not migrate or re-vendor them.

**Rationale**: They carry Tailwind parse-parity citations and are out of scope (FR-012). Their
current `.js`/`.ts` typings are sufficient for `classify.ts` to type-check its own calls; if a
vendor export is loosely typed, the call site still resolves under `strict` because the inputs
this module passes are concrete `string`s.

**Alternatives considered**: Migrate the vendor helpers in the same change — rejected: scope
creep; separate concern; would enlarge the behavior-parity surface unnecessarily.

## Baseline to preserve

- `pnpm typecheck` → 0 errors.
- `pnpm test` → all green; `classify.test.ts` = 115 cases.
- `pnpm lint:demo` → **23 violations, 1 suppressed**, exit non-zero.
