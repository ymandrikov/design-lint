# Contract: Vendored primitive module (`lint-color/vendor/*.ts`)

**Feature**: 011-migrate-vendor-ts | **Date**: 2026-07-07

The interface this feature exposes is a set of ESM module contracts consumed by `classify.ts`
and `no-raw-css-color.ts`. Each migrated primitive MUST satisfy the contract below. "Unchanged"
means identical to the pre-migration JavaScript.

## Module: `is-color.ts`

```ts
export function isColor(value: string): boolean
export function isNamedColor(value: string): boolean
```

- `isColor(v)` returns `true` iff `v.charCodeAt(0) === 0x23` (leading `#`), OR `v` matches
  `IS_COLOR_FN` (`/^(rgba?|hsla?|hwb|color|(ok)?(lab|lch)|light-dark|color-mix|--alpha)\(/i`),
  OR `NAMED_COLORS.has(v.toLowerCase())`.
- `isNamedColor(v)` returns `NAMED_COLORS.has(v.toLowerCase())`.
- `NAMED_COLORS` set and `IS_COLOR_FN` regex are byte-identical to today's.
- **Consumers**: `classify.ts` (`isColor`), `no-raw-css-color.ts` (`isColor`).

## Module: `segment.ts`

```ts
export function segment(input: string, separator: string): string[]
```

- Splits `input` on top-level occurrences of `separator`'s first char code, honoring nesting
  of `()`/`[]`/`{}` via the shared `closingBracketStack: Uint8Array`, skipping escaped chars
  (`\`) and quoted spans (`'`/`"`). Returns the list of segments (always at least one element).
- Behavior, including the shared-buffer optimization and per-call `stackPos = 0` reset, is
  unchanged.
- **Consumer**: `classify.ts`.

## Module: `is-valid-arbitrary.ts`

```ts
export function isValidArbitrary(input: string): boolean
```

- Returns `false` on an unbalanced closing `)`/`]`/`}` or a top-level `;`; `{` intentionally
  does **not** move the stack pointer; quotes and backslashes are handled as in `segment`.
  Returns `true` otherwise.
- Behavior, including the shared-buffer optimization, is unchanged.
- **Consumer**: `classify.ts`.

## Module: `decode-arbitrary-value.ts`

```ts
import valueParser, { type Node } from "postcss-value-parser";
export function decodeArbitraryValue(input: string): string
```

- Early-bails to `convertUnderscoresToWhitespace(input)` when `input` has no `(`.
- Otherwise parses with `postcss-value-parser`, runs `recursivelyDecodeArbitraryValues` over
  the nodes, and returns `valueParser.stringify(parsed.nodes)`.
- Underscore decoding: `_` → ` `, `\_` → `_`; the first `word` argument of `var()`/`theme()`
  and the contents of `url()` are exempted exactly as today; the upstream
  `addWhitespaceAroundMathOperators` pass remains intentionally omitted.
- Internal helpers `convertUnderscoresToWhitespace(input: string, skipUnderscoreToSpace?:
  boolean): string` and `recursivelyDecodeArbitraryValues(nodes: Node[]): void` are typed; the
  node walk uses `postcss-value-parser`'s `Node` union with no `any`.
- **Consumer**: `classify.ts`.

## Cross-cutting contract requirements

- **Types**: Every parameter, return, and internal helper is typed; any explicit `any` carries
  an inline justification (FR-004). As designed, zero `any` is required (SC-006).
- **Provenance header**: Each file keeps its upstream source path, commit `9b0e8af…`, ADR-0002
  citation, and (for `decode-arbitrary-value`) the divergence note; only the "converted to
  plain JS (type annotations dropped)" wording is corrected (FR-009).
- **Import specifiers**: Consumers reference each module by its `.ts` specifier (FR-003). No
  loader/bundler/tsconfig change; no new dependency.
- **Parity**: `pnpm typecheck` clean; the four `*.test.ts` pass with zero assertion edits;
  `pnpm lint:demo` holds 23 violations / 1 suppressed (exit 1); `pnpm test` holds 393 / 20.
