# Phase 1 Data Model: Migrate vendored primitives (`lint-color/vendor/**`) JS → TS

**Feature**: 011-migrate-vendor-ts | **Date**: 2026-07-07

This migration introduces no new runtime data — it types existing pure functions. The
"entities" below are the type shapes each migrated module carries. All are either primitive
(`string`/`boolean`/`string[]`) or reused from `postcss-value-parser`; none is a new domain
type.

## Entity: Vendored primitive module

A self-contained port of a Tailwind CSS source file, exporting pure functions with no
cross-vendor imports. Four are in scope.

| Module (`lint-color/vendor/`) | Exports | Signature | Internal helpers |
|---|---|---|---|
| `is-color.ts` | `isColor`, `isNamedColor` | `(value: string) => boolean` | `NAMED_COLORS: Set<string>`, `IS_COLOR_FN: RegExp`, `HASH` const |
| `segment.ts` | `segment` | `(input: string, separator: string) => string[]` | module-level `closingBracketStack: Uint8Array`, char-code consts |
| `is-valid-arbitrary.ts` | `isValidArbitrary` | `(input: string) => boolean` | module-level `closingBracketStack: Uint8Array`, char-code consts |
| `decode-arbitrary-value.ts` | `decodeArbitraryValue` | `(input: string) => string` | `convertUnderscoresToWhitespace`, `recursivelyDecodeArbitraryValues` |

**Invariants** (all preserved by the migration):

- Each export keeps its name, arity, and return type exactly (FR-002).
- No cross-vendor import is introduced; the modules stay independent.
- Only `decode-arbitrary-value` has a runtime import (`postcss-value-parser`); it is unchanged.

## Entity: Exported-function signatures (the caller contract)

The classifier (`classify.ts`) and `no-raw-css-color.ts` bind to these exact signatures; they
must not drift.

```ts
// is-color.ts
export function isColor(value: string): boolean
export function isNamedColor(value: string): boolean

// segment.ts
export function segment(input: string, separator: string): string[]

// is-valid-arbitrary.ts
export function isValidArbitrary(input: string): boolean

// decode-arbitrary-value.ts
export function decodeArbitraryValue(input: string): string
```

## Entity: Internal helper signatures (`decode-arbitrary-value.ts`)

```ts
// Second param is defaulted; both one-arg and two-arg call sites must keep type-checking.
function convertUnderscoresToWhitespace(input: string, skipUnderscoreToSpace?: boolean): string

// Walks and MUTATES parser nodes in place (node.value reassigned; recurses into node.nodes
// for function nodes). Returns void.
function recursivelyDecodeArbitraryValues(nodes: Node[]): void
```

## Entity: Parser node (reused from `postcss-value-parser`)

Not defined by this feature — imported from the already-installed dependency's bundled `.d.ts`.
The walk reads `type`/`value` on any node and `nodes` on function nodes.

```ts
import valueParser, { type Node } from "postcss-value-parser";
// Node = FunctionNode | WordNode | DivNode | SpaceNode | StringNode | CommentNode | UnicodeRangeNode
//   BaseNode      → { value: string; sourceIndex; sourceEndIndex }
//   FunctionNode  → { type: "function"; nodes: Node[]; ... }  (only member with `nodes`)
//   Word/Div/Space/String/... → { type: "..."; value: string; ... }
```

**Typing note**: `valueParser(input).nodes` is `Node[]`; the `switch (node.type)` narrows to
the member that carries `nodes` (`"function"`) before `node.nodes` is read, so the walk needs
**no cast and no `any`** (SC-006, research Decision 2).

## State transitions

None. Every primitive is a pure function: same input → same output, no mutable module state
except the shared `Uint8Array` bracket stack in `segment`/`is-valid-arbitrary`, which is reset
per call (its `stackPos` starts at 0 each invocation) and is unchanged by the migration.

## Out of scope (unchanged shapes)

- `classify.ts`'s own types (`ColorParts`, `Tokens`, `ColorVerdict`) — consumers, not modified.
- `no-raw-css-color.ts`'s rule types — only its one `isColor` import specifier changes.
- `postcss-value-parser`'s declarations — reused as-is; no new dependency, no local re-declaration.
