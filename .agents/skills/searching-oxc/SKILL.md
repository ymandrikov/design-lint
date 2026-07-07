---
name: searching-oxc
description: Find facts about oxc-parser's JS API, the oxc AST node shapes, and oxlint config/plugins by searching a local clone of the oxc repo. Use when you need to know a parse API signature, what fields an AST node has, how to walk the AST, or an oxlint config/rule key — instead of guessing or answering from memory.
---

# Searching oxc

oxc is a large monorepo. Answer oxc-parser / AST / oxlint questions from a **local clone**, not from memory — oxc's AST is ESTree-*ish* but not identical, and the API changes between releases. Always cite the file you read.

## Preflight

The clone lives at `.repos/oxc` (gitignored). Verify before searching:

```sh
ls .repos/oxc/napi/parser/src-js/index.d.ts
```

If missing, tell the user to clone it:

```sh
git clone --depth 1 https://github.com/oxc-project/oxc .repos/oxc
```

All paths below are relative to `.repos/oxc`. **Never run a bare `rg` from the repo root** — it's huge. Always scope to the files named here.

## WHERE things live

| You need | Read this |
|----------|-----------|
| Parser JS API — `parse` / `parseSync` signatures, `ParserOptions`, `ParseResult`, `Visitor`, `Comment`, module-record types | `napi/parser/src-js/index.d.ts` |
| Runnable parse example (dumps a real AST) | `napi/parser/example.js` |
| Parser package overview / usage prose | `napi/parser/README.md` |
| **AST node shapes, JS/TS-facing** — ~250 `interface`s: `Program`, `VariableDeclaration`, `JSXAttribute`, `CallExpression`, … | `npm/oxc-types/types.d.ts` (single file) |
| Visitor / walk implementation | `napi/parser/src-js/visit/visitor.js`, `napi/parser/src-js/visit/index.js` |
| AST ground truth (Rust source) — when the `.d.ts` is ambiguous | `crates/oxc_ast/src/ast/{js,jsx,ts,literal,comment}.rs` |
| oxlint config schema — rules, plugins, categories, overrides, settings, env, globals | `crates/oxc_linter/src/config/{oxlintrc,rules,plugins,categories,overrides,env,globals}.rs` |
| oxlint config example | `oxlintrc.json` (repo root) |
| oxlint JS plugin surface (eslint bridge) | `npm/oxlint-plugin-eslint/`, `npm/oxlint-plugins/` |

## Recipes

**Parse API signature + options**
```sh
rg -n 'export declare function parse|export interface ParserOptions|export declare class ParseResult' .repos/oxc/napi/parser/src-js/index.d.ts
```
Then read the `ParserOptions` and `ParseResult` blocks. Core shape: `parseSync(filename, sourceText, options?) => ParseResult`; async `parse(...) => Promise<ParseResult>`. `ParseResult` exposes `.program`, `.errors`, `.comments`, `.module`.

**What fields does node `X` have?**
```sh
rg -n "^export interface <NodeType> " .repos/oxc/npm/oxc-types/types.d.ts
```
Read the interface block. Every node extends `Span` (`start`, `end`). If the type is a union or unclear, fall back to the Rust source (`crates/oxc_ast/src/ast/*.rs`) for the authoritative definition.

**List all node kinds / find the right node name**
```sh
rg -n '^export interface ' .repos/oxc/npm/oxc-types/types.d.ts
```

**Dump the real AST for a snippet** (ground truth over any doc):
```sh
cd .repos/oxc && node napi/parser/example.js /path/to/test.tsx
# writes a fixture then run; or point it at a file. Uses --lang / --astType flags.
```
Prefer this whenever runtime shape matters — it's what the parser actually emits.

**How do I walk the tree?**
```sh
rg -n 'class Visitor|visit|enter|leave' .repos/oxc/napi/parser/src-js/visit/visitor.js
```

**oxlint config key / rule / plugin name**
```sh
rg -n '<key>' .repos/oxc/crates/oxc_linter/src/config/
rg -n '"rules"|"plugins"|"categories"' .repos/oxc/oxlintrc.json
```

## Notes / gotchas

- **oxc-types is the fast path** for AST shapes in JS/TS work; the Rust `.rs` files are the source of truth when types disagree or a field is generated.
- **ESTree-ish, not ESTree.** Don't assume a field exists because babel/acorn has it — verify in `oxc-types` or by dumping with `example.js`.
- **Scope every search.** Name the file. The oxc monorepo has thousands of Rust files; an unscoped `rg` wastes context.
- Out of scope for this skill (by design): oxc transformer, formatter, minifier, and Rust crate internals beyond `oxc_ast` / `oxc_linter` config. Search those directly if ever needed.
