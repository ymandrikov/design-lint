# Contract: Module Export Surface (Before → After)

The "interface" this refactor touches is the internal module boundary within `lint-color/`.
There is **no external/public contract change** — CLI flags, config keys, rule names, exit
codes, suppression syntax, and `index.js`'s own exports are all unchanged. This document pins
the internal import contract so tasks and review can assert against it.

## Before

`shared.js` exports (own + re-exported):

```text
shared.js
  own:        isTTY, red, blue, dim, bold
              buildDisabledRules, lintSourceIfEnabled, checkTokenIfEnabled, checkValueIfEnabled
              getAllFiles, isStorybookFile
              runTokenRuleOnSource
  re-export:  buildLineStarts, offsetToLine            (from ast.js)
              TAILWIND_SPECTRAL_COLORS, TAILWIND_COLOR_PREFIXES  (from classify.js)
```

## After

```text
ansi.js        (new)   isTTY, red, blue, dim, bold
files.js       (new)   getAllFiles, isStorybookFile
linter.js      (mod)   buildDisabledRules, lintSourceIfEnabled, checkTokenIfEnabled,
                       checkValueIfEnabled   — module-local, not exported unless a test needs them
helpers.ts     (mod)   runTokenRuleOnSource  (added; joins existing test types/helpers)
ast.js         (owner) buildLineStarts, offsetToLine       — imported directly, shim gone
classify.js    (owner) TAILWIND_SPECTRAL_COLORS, TAILWIND_COLOR_PREFIXES — imported directly
shared.js      DELETED
```

## Import-path contract (what importers must say after)

| Importer | Old | New |
|---|---|---|
| index.js | `bold, dim, red, isTTY?` from `./shared.js` | from `./ansi.js` |
| index.js | `getAllFiles, isStorybookFile` from `./shared.js` | from `./files.js` |
| index.js | `TAILWIND_*` from `./shared.js` | from `./classify.js` |
| linter.js | `*IfEnabled, buildDisabledRules` from `./shared.js` | module-local (defined in linter.js) |
| rules/*.test.ts | `runTokenRuleOnSource` from `../shared.js` | from `../helpers.js` |
| *.test.ts | `TAILWIND_*` from `./shared.js` / `../shared.js` | from `./classify.js` / `../classify.js` |
| any | `offsetToLine, buildLineStarts` from `./shared.js` | from `./ast.js` |

## Dispatch-gate export decision

`linter.js` currently consumes the gates internally. If no test imports them today, they become
module-local (unexported) — the simplest single-concern outcome. If a test *does* import a gate
directly, keep that gate exported from `linter.js` (still single-concern) rather than resurrect
a shared module. Implementation confirms via grep before choosing export vs local.

## Contract assertions (verifiable)

- **C-1**: `shared.js` does not exist after the change.
- **C-2**: 0 references to `shared.js` anywhere under `lint-color/` and `tests/`.
- **C-3**: `ansi.js` and `files.js` each export only their listed concern's symbols.
- **C-4**: `index.js`'s own export list is unchanged (diff shows only import-line edits).
- **C-5**: Every previously re-exported symbol resolves to `ast.js` / `classify.js` at each
  import site.
