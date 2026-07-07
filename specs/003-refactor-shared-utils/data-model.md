# Phase 1 Data Model: Symbol → Home Mapping

No runtime data entities — a refactor. The "model" is the symbol-relocation graph: every export
currently in `shared.js`, its new owner, and every importer to repoint.

## Relocation table

| Symbol | Kind | Current home | New home | Importers to update |
|---|---|---|---|---|
| `isTTY` | const | shared.js | `ansi.js` (new) | index.js |
| `red` | fn | shared.js | `ansi.js` | index.js |
| `blue` | fn | shared.js | `ansi.js` | index.js |
| `dim` | fn | shared.js | `ansi.js` | index.js |
| `bold` | fn | shared.js | `ansi.js` | index.js, rules/no-style-color.test.ts |
| `getAllFiles` | fn | shared.js | `files.js` (new) | index.js |
| `isStorybookFile` | fn | shared.js | `files.js` | index.js |
| `buildDisabledRules` | fn | shared.js | inline in `linter.js` | linter.js |
| `lintSourceIfEnabled` | fn | shared.js | inline in `linter.js` | linter.js |
| `checkTokenIfEnabled` | fn | shared.js | inline in `linter.js` | linter.js (+ comment in rules/no-spectral-color.ts) |
| `checkValueIfEnabled` | fn | shared.js | inline in `linter.js` | linter.js |
| `runTokenRuleOnSource` | fn | shared.js | `helpers.ts` | 7 rule tests (see below) |
| `buildLineStarts` | re-export | shared.js → ast.js | `ast.js` (drop shim) | (verify no external importer via shared) |
| `offsetToLine` | re-export | shared.js → ast.js | `ast.js` (drop shim) | any importer using shared path → ast.js |
| `TAILWIND_SPECTRAL_COLORS` | re-export | shared.js → classify.js | `classify.js` (drop shim) | index.js, linter.test.ts, linter.lintCss.test.ts, rule tests |
| `TAILWIND_COLOR_PREFIXES` | re-export | shared.js → classify.js | `classify.js` (drop shim) | index.js, linter.test.ts, linter.lintCss.test.ts, rule tests |

## `runTokenRuleOnSource` test importers (repoint `../shared.js` → `../helpers.js`)

- rules/no-opacity-modifier.test.ts
- rules/no-raw-css-color.test.ts
- rules/no-undefined-token.test.ts
- rules/no-var-color.test.ts
- rules/no-dark-variant.test.ts
- rules/no-spectral-color.test.ts
- rules/token-constraints.test.ts

## `TAILWIND_*` importers (repoint `shared.js` → `classify.js`)

- lint-color/index.js
- lint-color/linter.test.ts
- lint-color/linter.lintCss.test.ts
- lint-color/rules/token-constraints.test.ts, no-var-color.test.ts, no-spectral-color.test.ts,
  no-raw-css-color.test.ts (any that import the constants from `../shared.js`)

> During implementation, confirm each importer's exact current source path by grep before
> repointing; the table lists the destination, the grep confirms the origin.

## Dependency-edge checks (no cycles introduced)

- `ansi.js` — leaf module, imports nothing from lint-color. Safe.
- `files.js` — imports only `node:fs`, `node:path`. Safe.
- `linter.js` — already imports from ast.js, classify.js; gates add no new imports.
- `helpers.ts` gains `runTokenRuleOnSource`, which needs `composeColorParts` (classify.js) and
  AST helpers (ast.js). `helpers.ts` already imports from classify.js; adding ast.js is a new
  but acyclic edge (ast.js imports only `oxc-parser`).

## Validation rules (invariants the move must preserve)

- **INV-1**: Post-refactor, `grep -rn "shared.js"` over `lint-color/` and `tests/` returns **0**.
- **INV-2**: `index.js` public export surface unchanged (nothing re-exported *through* index.js
  changes name or presence).
- **INV-3**: No `*.test.ts` assertion body changes — only its import lines.
- **INV-4**: Each new/modified module is single-concern (ansi.js = styling only; files.js = fs
  only; helpers.ts = test-support only; linter.js = core linting incl. its dispatch gates).
