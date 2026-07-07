# Contract: `lint-color/files.ts` exported surface

The migrated module MUST export exactly these two functions, with these names and call
signatures. This is the contract the sole importer (`lint-color/index.js`) depends on; it is
unchanged from the JavaScript module (FR-002).

## `getAllFiles(dir: string, ...exts: string[]): string[]`

Recursively walk `dir` and return every regular file whose extension is in `exts`.

- **Parameters**:
  - `dir: string` — the source root to walk.
  - `...exts: string[]` — dotted extensions to keep (e.g. `".css"`, `".ts"`, `".tsx"`), matched exactly against `extname(entry.name)`.
- **Returns**: `string[]` — each matching file's `parentPath`-joined full path, in `readdirSync` recursive traversal order.
- **Behavior** (preserved):
  - Uses `readdirSync(dir, { recursive: true, withFileTypes: true })`.
  - Keeps entries where `entry.isFile()` **and** `extSet.has(extname(entry.name))`.
  - Passing no extensions returns `[]` (empty set matches nothing).
- **Callers**: `lint-color/index.js` —
  `getAllFiles(SRC, ".css")` and `getAllFiles(SRC, ".tsx", ".ts")`, each `.filter((f) => !isStorybookFile(f))`.

## `isStorybookFile(filePath: string): boolean`

Report whether a path is a Storybook file (to be excluded from linting).

- **Parameters**: `filePath: string` — a file path.
- **Returns**: `boolean` — `true` iff **any** of:
  - `filePath.includes("/stories/")`, or
  - `filePath.endsWith(".stories.tsx")`, or
  - `filePath.endsWith(".stories.ts")`.
- **Callers**: `lint-color/index.js` — used as the negated filter predicate on both `getAllFiles` results.

## Contract tests

No dedicated unit suite exists or is added by this migration. The contract is verified
end-to-end:

- **`pnpm typecheck`** — proves both signatures type-check and the `Dirent`/`??` handling
  carries no implicit or unjustified `any`.
- **`pnpm lint:demo`** — drives both functions through `index.js` over `fixtures/demo-app`;
  the discovered file set and resulting violations (**23 violations, 1 suppressed**) must be
  byte-for-byte identical to the pre-migration run.
