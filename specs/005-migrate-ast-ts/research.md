# Phase 0 Research: Migrate the AST layer to TypeScript

All Technical Context items were resolvable from the installed toolchain and the two shipped
sibling migrations (`no-spectral-color.ts`, `ansi.ts`). No `NEEDS CLARIFICATION` remain.

## R1 — Where do oxc AST node types come from?

**Decision**: Import AST node types from `oxc-parser` directly (or `@oxc-project/types`;
they are the same symbols). `oxc-parser`'s type entry does `export * from "@oxc-project/types"`
and also exports `parseSync`, `ParseResult`, `Comment`, `Span`.

**Rationale**: The runtime already depends on `oxc-parser@0.138.0`, which pins
`@oxc-project/types@0.138.0`. Importing node types from the same package the parser comes from
guarantees the types match the runtime AST version. `import type { Program, Node, StringLiteral,
… } from "oxc-parser"` is erased by type stripping — no runtime import added.

**Alternatives considered**: Hand-writing local interfaces for each node shape (rejected —
duplicates the published contract and drifts on parser upgrade); pulling from a third-party
`@types/estree` (rejected — not guaranteed to match oxc's exact discriminants/fields).

## R2 — Do the type discriminants match the `.type` strings the code checks?

**Decision**: Yes — narrow the exported `Node` union on `.type` using the **existing** string
literals; no `.type` check is rewritten.

**Evidence** (from `@oxc-project/types@0.138.0/types.d.ts`):

| Interface | `type` discriminant | Code currently checks |
|-----------|--------------------|-----------------------|
| `StringLiteral` | `"Literal"` | `node.type === "Literal"` ✅ |
| `ObjectProperty` | `"Property"` | `p.type !== "Property"` ✅ |
| `TemplateLiteral` | `"TemplateLiteral"` | ✅ |
| `TemplateElement` | `"TemplateElement"` | ✅ |
| `JSXExpressionContainer` | `"JSXExpressionContainer"` | ✅ |
| `JSXIdentifier` / `JSXNamespacedName` / `JSXMemberExpression` | matching | ✅ |
| `ObjectExpression` | `"ObjectExpression"` | ✅ |
| `TSAsExpression` / `TSSatisfiesExpression` / `ParenthesizedExpression` | matching | ✅ |

**Rationale**: `@oxc-project/types` is ESTree-compatible — the *interface name* (`StringLiteral`,
`ObjectProperty`) differs from the *runtime `type` value* (`"Literal"`, `"Property"`), but the
value is what the code and the discriminated union both key on. This is why the current untyped
JS works at runtime, and why the migration is type-only.

**Alternatives considered**: Renaming checks to interface names (rejected — would break runtime;
the `.type` value, not the TS name, is authoritative).

## R3 — How to type the reflective `walk`?

**Decision**: `walk(node: unknown, enter: (node: Node) => void)`. Inside, guard `typeof node ===
"object"`, handle arrays, and when iterating keys treat the node as an indexable record
(`node as Record<string, unknown>`). Call `enter(node as Node)` only after confirming
`typeof node.type === "string"`.

**Rationale**: `walk` deliberately traverses arbitrary sub-trees of unknown shape and is also
called with narrow sub-nodes (e.g. `classNameStaticsDeep(value)`). `unknown` at the parameter is
honest and forces the internal guards that already exist; no `any` needed. The single unavoidable
cast is the `Record<string, unknown>` key-iteration bridge, which is inline-justified per
constitution I (reflective walk over a heterogeneous tree).

**Alternatives considered**: Typing the param as `Node` (rejected — call sites pass whole
programs and raw sub-values; over-narrow); `any` throughout (rejected — constitution disallows
unjustified `any`, and `unknown` + guards is strictly safer here).

## R4 — Does Node run the `.ts` module without a build step?

**Decision**: Yes. Keep zero build/bundle/loader. Import the migrated module by its `.ts`
specifier, matching the repo convention.

**Evidence**: `no-spectral-color.ts` and `ansi.ts` already ship as `.ts` and are imported as
`"./rules/no-spectral-color.ts"`; `pnpm lint:demo` and `pnpm typecheck` are green today
(baseline: 23 violations, 1 suppressed). Node engine `^26.1.0` strips types natively and runs
the `.ts` module with no build step.

> **Correction (found during implementation)**: the parenthetical claim that no
> `allowImportingTsExtensions` was needed was WRONG. It held for the shipped `.ts` rules only
> because they are imported exclusively from *untyped* `.js` files (`checkJs: false`), which
> `tsc` never checks. `helpers.ts` — a *type-checked* `.ts` file — statically imports `./ast.ts`
> by explicit extension, and `tsc` errors `TS5097` without the flag. Fix: add
> `allowImportingTsExtensions: true` to tsconfig (typecheck-only; requires `noEmit`, already
> set). Runtime resolution was always fine — the `.ts` specifier is in fact *required* for Node
> since no `ast.js` exists — so no build/loader step was added and SC-005 holds.

**Alternatives considered**: Adding a bundler/ts-node/loader (rejected — SC-005 forbids;
unnecessary given native stripping).

## R5 — Do the still-JS importers keep working?

**Decision**: Yes. Update only the import *specifier* extension in the three `.js` rule modules,
`linter.js`, and `helpers.ts`. Their call sites are unchanged and, under `checkJs: false`, are
not type-checked — the migrated module's unchanged export signatures keep their runtime calls
valid.

**Rationale**: FR-002 fixes the export names/signatures; FR-003 lists the exact five importers.
Type stripping means the `.ts` module's runtime exports are identical to the old `.js` ones.

**Alternatives considered**: Migrating the importers too (rejected — out of scope FR-012;
would balloon the change).
