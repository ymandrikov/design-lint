# Phase 1 Data Model: `files.ts`

This module has no persistent data. The "entities" are the in-memory value shapes the two
exported functions produce and consume — the types the migration makes explicit.

## Discovered file list — `string[]`

The value `getAllFiles` returns: the full set of source paths under `dir` whose extension is
in the caller's set, each joined to its parent directory.

- **Shape**: `string[]`
- **Produced by**: `getAllFiles(dir, ...exts)` — filter (`isFile()` and `extSet.has(extname(name))`) then map (`join(parentPath ?? path, name)`).
- **Invariants** (preserved from JS):
  - Only regular files (`Dirent.isFile()`), never directories.
  - Only entries whose `extname(name)` is in the rest-arg set; **zero extensions ⇒ empty result**.
  - Each path is `parentPath`-joined, so nested files carry their full path.
  - Order follows `readdirSync(..., { recursive: true })` traversal order — unchanged.

## Directory entry — `Dirent` (from `node:fs`)

The `withFileTypes` record the walk inspects. Not exported; typed internally.

| Field / method | Type | Use in module |
|----------------|------|---------------|
| `isFile()` | `() => boolean` | filter to regular files |
| `name` | `string` | `extname(name)` for the extension filter; second arg to `join` |
| `parentPath` | `string` | base for `join` |

- **Source**: `readdirSync(dir, { recursive: true, withFileTypes: true }): Dirent<string>[]`; `e` infers as `Dirent<string>` with no explicit annotation, so no `Dirent` import is needed. No `any`.
- **Removed field**: the JS read `parentPath ?? path`, but the deprecated `Dirent.path` alias no longer exists on the type under `@types/node ^26.1.0` (`TS2339`). Since `parentPath` is always populated (Node ≥ 20), the fallback was dead; the module reads `parentPath` alone — output-identical, verified by the unchanged demo-app run. See research Decision 3.

## Extension set — `Set<string>`

Built once per call from the rest-arg extensions, matched against each entry's `extname`.

- **Shape**: `Set<string>` (`new Set(exts)`).
- **Invariant**: membership test is exact-string against `extname(name)` output (which includes the leading dot, e.g. `".ts"`), so callers pass dotted extensions (`".css"`, `".ts"`, `".tsx"`) exactly as today.

## Storybook classification — `boolean`

The verdict `isStorybookFile` returns for one path.

- **Shape**: `boolean`
- **Produced by**: `isStorybookFile(filePath)` — `true` iff the path contains `/stories/`, or ends with `.stories.tsx`, or ends with `.stories.ts`.
- **Invariant**: the three OR-ed conditions and their literals are preserved exactly (FR-006).

## Public surface (unchanged)

```text
getAllFiles(dir: string, ...exts: string[]): string[]
isStorybookFile(filePath: string): boolean
```

Names and call signatures are identical to the JavaScript module (FR-002); only the type
annotations are added. See `contracts/files-module.md`.
