# Contract: `lint-color/ansi.ts` public surface

The module exposes terminal-styling primitives, gated on TTY. This contract MUST be identical
before and after the JS→TS migration (FR-002, SC-006). It is the interface consumers bind to.

## Module path

- **Before**: `lint-color/ansi.js`
- **After**: `lint-color/ansi.ts`
- Importers reference it by the explicit `.ts` specifier (Node ESM, `nodenext`). One in-repo
  importer: `lint-color/index.js:12`.

## Exports

```ts
export const isTTY: boolean | undefined;        // process.stdout.isTTY, read once at load
export const red:  (s: string) => string;       // wrap in SGR 31 when isTTY, else passthrough
export const blue: (s: string) => string;       // wrap in SGR 34 when isTTY, else passthrough
export const dim:  (s: string) => string;       // wrap in SGR 2  when isTTY, else passthrough
export const bold: (s: string) => string;       // wrap in SGR 1  when isTTY, else passthrough
```

## Behavioral guarantees

| Input context | Call | Output |
|---------------|------|--------|
| TTY (`isTTY` truthy) | `red("x")` | `` `\x1b[31mx\x1b[0m` `` |
| TTY | `blue("x")` | `` `\x1b[34mx\x1b[0m` `` |
| TTY | `dim("x")` | `` `\x1b[2mx\x1b[0m` `` |
| TTY | `bold("x")` | `` `\x1b[1mx\x1b[0m` `` |
| non-TTY (`isTTY` falsy) | any helper on `"x"` | `"x"` (verbatim, no escapes) |

## Compatibility

- **No breaking change**: exported names, arity, call signatures, escape codes, and TTY-gating
  semantics are unchanged. Not a public-contract change under Constitution III — no version bump.
- **Current consumers**: `index.js` imports `{ bold, dim, red }`. `blue` and `isTTY` are part of
  the surface but unused in-repo today; both remain exported.
