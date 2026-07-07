# Phase 0 Research: Refactor lint-color/shared.js

All unknowns here are destination-and-move-type choices for the five concerns. No external
technology research needed — the stack is fixed and the change is pure code motion.

## Consumer facts (verified against the tree)

- `checkTokenIfEnabled` appears in `rules/no-spectral-color.ts` **only as a comment** (line 31:
  "Built by checkTokenIfEnabled in shared.js."). The sole executable consumer of all four
  dispatch gates is `linter.js`.
- `ansi` object is constructed in `index.js:72` (`const ansi = { red, blue: …, dim }`); terminal
  helpers are CLI-presentation, consumed only by `index.js`.
- `helpers.ts` ("Shared types and test helpers for lint-color rule tests") is imported by
  **zero** runtime files — confirmed test-only, so it is a safe home for a test-only harness.
- `runTokenRuleOnSource` depends on `composeColorParts` (classify.js) and the AST helpers
  (`parseSource`, `walk`, `jsxName`, `classNameStatics`, `ignoredLines`, `offsetToLine`) — all
  already importable from `helpers.ts`'s neighbours; no dependency cycle introduced.

## Decision 1 — Terminal styling → new `lint-color/ansi.js`

- **Decision**: Extract `isTTY`, `red`, `blue`, `dim`, `bold` to a new single-concern
  `ansi.js`. `index.js` imports from it.
- **Rationale**: Sole consumer is `index.js`, but ANSI formatting is **not** the orchestrator's
  concern (Principle I: single-concern). Inlining would make `index.js` multi-concern. A named
  `ansi.js` is discoverable by concern (SC-005).
- **Alternatives rejected**: Inline into `index.js` — muddies the orchestrator. Fold into a
  generic `cli.js` — recreates a smaller junk drawer with file discovery.

## Decision 2 — File discovery → new `lint-color/files.js`

- **Decision**: Extract `getAllFiles`, `isStorybookFile` to a new `files.js`.
- **Rationale**: Filesystem walking/classification is a distinct concern from orchestration and
  from ANSI styling. Sole consumer `index.js`, but same single-concern reasoning as Decision 1.
- **Alternatives rejected**: Inline into `index.js` (multi-concern); co-locate with `ansi.js`
  (two unrelated concerns → the exact smell being removed).

## Decision 3 — Rule-dispatch gates → inline into `linter.js`

- **Decision**: Move `buildDisabledRules`, `lintSourceIfEnabled`, `checkTokenIfEnabled`,
  `checkValueIfEnabled` into `linter.js` (their sole consumer). Update the stale comment in
  `no-spectral-color.ts` to drop the `shared.js` reference.
- **Rationale**: These gates *are* core-linting concern ("run this rule if enabled") and
  `linter.js` is "core linting logic." One caller, no separate tests → YAGNI says do not spin up
  a module for a single consumer (Principle I). Inlining removes a hop and a file.
- **Alternatives rejected**: New `dispatch.js` — an abstraction with one caller, contra YAGNI;
  adds a module instead of deleting one. Revisit only if a second consumer appears.
- **Asymmetry note (vs Decisions 1–2)**: gates inline because they belong to the consumer's
  concern; ANSI/files extract because they do **not** belong to their consumer's concern. The
  invariant is "each utility lives where it is single-concern," not "always inline sole-consumer
  code."

## Decision 4 — Test harness → existing `helpers.ts`

- **Decision**: Move `runTokenRuleOnSource` into `helpers.ts`. The seven rule tests import it
  from `../helpers.js`.
- **Rationale**: `helpers.ts` is the established test-support module and is not reachable from
  runtime code — satisfies FR-005 (test-support not importable as production). No new module.
- **Alternatives rejected**: Leave in a runtime module — test-only code shipped as runtime.
  New `test-support.ts` — duplicates the role `helpers.ts` already fills.

## Decision 5 — Legacy re-exports → owning modules, shims deleted

- **Decision**: Delete the pass-through re-exports. Repoint importers of `buildLineStarts` /
  `offsetToLine` to `ast.js`, and of `TAILWIND_SPECTRAL_COLORS` / `TAILWIND_COLOR_PREFIXES` to
  `classify.js`.
- **Rationale**: FR-004 + "prefer deleting indirection." The shims exist only for back-compat of
  an internal module; there is no external consumer to protect.
- **Alternatives rejected**: Keep `shared.js` as a thin facade — retains the indirection the
  refactor exists to remove (spec Assumption: full retirement over facade).

## Decision 6 — Delete `shared.js`

- **Decision**: After Decisions 1–5, `shared.js` exports nothing → delete the file (FR-006).
- **Rationale**: "Prefer deleting code"; no empty stub left behind.

## Cross-cutting: behavior-freeze method

- **Decision**: Treat `pnpm test` + `pnpm lint:demo` output as the oracle; capture demo output
  before the change and diff after (0 differences required, SC-002).
- **Rationale**: Constitution II — exact-output e2e is the source of truth; refactor safety is
  proven by unchanged output, not by inspection.
