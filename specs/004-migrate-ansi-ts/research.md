# Phase 0 Research: `ansi` JS → TS migration

All Technical Context unknowns resolved. No open `NEEDS CLARIFICATION`. This module reuses
the runtime/resolution decisions proven in feature 002 (`no-spectral-color` migration);
the entries below record the deltas that matter for a dependency-free leaf module.

## R1 — How does a `.ts` module run with no build step?

**Decision**: Rely on Node's native TypeScript type stripping. Rename to `ansi.ts` and
update the one importer to the `.ts` specifier. No bundler, `tsx`, `ts-node`, or loader flag.

**Rationale**: Same runtime as 002 — bare `node lint-color/index.js`, `type: module`, engine
pinned `^26.1.0` (measured v26.1.0). Node ≥ 23.6 strips types from `.ts` on import by default;
002's probe already confirmed a sibling `.ts` imported and executed. Stripping is erasure-only,
so escape output and cost are unchanged (SC-003, SC-004, Constitution IV).

**Alternatives considered**:
- *Add a build step* — rejected: violates SC-004; a stage the project deliberately avoids.
- *`tsx`/`ts-node` loader* — rejected: unnecessary given native support; adds a dependency.

## R2 — Import specifier: does `.js` auto-resolve to `.ts`?

**Decision**: Update the single importer to the explicit `.ts` specifier — in
`lint-color/index.js` (line 12): `import { bold, dim, red } from "./ansi.js"` →
`from "./ansi.ts"`.

**Rationale**: Node ESM resolves the literal specifier and does not rewrite `.js`→`.ts`;
leaving `.js` after the rename fails module resolution at runtime. Only one importer exists
in-repo (confirmed by grep across `lint-color/`); `linter.js` receives `ansi` as a parameter
and does not import the module.

**Alternatives considered**:
- *Extensionless import* — rejected: `nodenext` resolution requires explicit extensions in ESM.
- *`.js` re-export shim* — rejected: pointless indirection for a single consumer.

## R3 — Will `tsc --noEmit` accept the `.ts` module imported by a `.js` file?

**Decision**: Expect `pnpm typecheck` to pass **without** touching `tsconfig.json`. If tsc
reports a `.ts`-extension import error, add `"allowImportingTsExtensions": true` to
`compilerOptions` (permitted because `noEmit: true`). Same conditional fallback as 002.

**Rationale**: `tsconfig.json` has `checkJs: false`, so the `.js` importer (`index.js`) is
not type-checked and its `.ts`-extension specifier raises no error. `ansi.ts` itself imports
nothing, so it contains no cross-extension import to flag. The flag is very likely unnecessary;
the fallback is cheap and self-evident if the gate fails.

**Alternatives considered**:
- *Set `allowImportingTsExtensions` preemptively* — deferred: add only if the gate demands it
  (YAGNI, Constitution I).

## R4 — Typing `process.stdout.isTTY` without changing the exported value

**Decision**: Keep `export const isTTY = process.stdout.isTTY;` and let it carry Node's
declared type `boolean | undefined`. Do **not** coerce with `Boolean(...)`.

**Rationale**: At runtime `process.stdout.isTTY` is `true` in a terminal and `undefined`
otherwise; the helpers gate on it with a truthy check, so both the un-typed JS and the typed
TS behave identically. Coercing to `boolean` would change the exported value (`undefined`→`false`)
— an observable change to a public member (FR-002). Preserving the union is the faithful
migration; every consumer uses it in a truthy context, so the union type costs them nothing.
No `any` is needed anywhere in the module (SC-005).

**Alternatives considered**:
- *`export const isTTY: boolean = Boolean(process.stdout.isTTY)`* — rejected: changes the
  exported value for non-TTY from `undefined` to `false`, a public-surface change the spec
  forbids.
- *Widen the helpers' input beyond `string`* — rejected: callers pass strings; `(s: string) => string`
  is the honest contract and matches every call site.
