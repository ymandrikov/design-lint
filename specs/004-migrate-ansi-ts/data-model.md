# Phase 1 Data Model: `ansi` module

This is a stateless styling module — no persisted data, no records. The "entities" are the
module's typed exports. Types below are the contract `pnpm typecheck` enforces after migration.

## Entity: TTY flag — `isTTY`

- **Shape**: `boolean | undefined` (Node's declared type for `process.stdout.isTTY`).
- **Value**: read **once at module load** from `process.stdout.isTTY` — `true` in an interactive
  terminal, `undefined` otherwise.
- **Rule**: value and read-timing preserved exactly (FR-002, FR-005). Not coerced to `boolean`
  (see research R4) — coercion would change the non-TTY value from `undefined` to `false`.
- **Consumers**: the four helpers below (truthy gate). Exported but not imported by any in-repo
  consumer today; export retained regardless (spec Edge Case: full surface, not current usage).

## Entity: Styling helper — `red`, `blue`, `dim`, `bold`

- **Signature**: `(s: string) => string`.
- **Behavior**: when `isTTY` is truthy, return `s` wrapped in the helper's escape sequence;
  otherwise return `s` unchanged.
- **Escape sequences** (literal, unchanged — FR-006):

  | Helper | Wrap | Sequence |
  |--------|------|----------|
  | `red`  | SGR 31 | `` `\x1b[31m${s}\x1b[0m` `` |
  | `blue` | SGR 34 | `` `\x1b[34m${s}\x1b[0m` `` |
  | `dim`  | SGR 2  | `` `\x1b[2m${s}\x1b[0m` `` |
  | `bold` | SGR 1  | `` `\x1b[1m${s}\x1b[0m` `` |

- **Rule**: no `any`; input and return typed as `string`. Names, arity, and escape output
  identical before and after migration.

## Invariants

- Public surface is exactly these 5 members: `isTTY`, `red`, `blue`, `dim`, `bold` (SC-006).
- No new export, no removed export, no renamed export.
- Module remains dependency-free (imports nothing) and side-effect-free beyond the one-time
  `isTTY` read at load.
