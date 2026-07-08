# Phase 1 Data Model: Configurable Source Directories

No persistent storage. "Entities" are the in-memory config + discovery shapes on the
CLI startup path. Existing output shapes (`Violation`, `OutViolation`, `LintResult`)
are reused unchanged — this feature never touches the lint path, only which files
reach it.

## Changed — config seam (`index.ts` `Config` type)

- **Config** (parsed from `design-system/lint/colors.json`): gains one optional field.
  - `colorTokenFiles: string[]` — (unchanged) ROOT-relative token files.
  - `rules: Record<string, RuleConfig>` — (unchanged).
  - `sourceDirectories?: string[]` — **NEW, optional.** Target-root-relative directories
    to scan. Absent ⇒ default `["src"]`. Typed as `string[] | undefined` at the
    JSON.parse boundary; validated before use (raw `unknown` in the validator so a
    malformed JSON value is caught, not trusted).

## New — discovery inputs (`lint-color/files.ts`)

- **RawSourceDirs**: `unknown` — the value of `config.sourceDirectories` exactly as
  parsed. Fed to the validator, which is responsible for every type check (it does not
  assume the field is already `string[]`).
- **ValidatedSourceDirs**: `string[]` — normalized, within-root, relative directory
  paths returned by `validateSourceDirs`. Never empty (a validated result has ≥1 entry;
  the default injects `["src"]`).
- **ResolvedSourceDirs**: `{ existing: string[]; missing: string[] }` — absolute paths
  partitioned by `resolveExistingSourceDirs(validated, root)`:
  - `existing` — absolute dir paths that exist and are directories; the roots the
    discovery passes walk.
  - `missing` — absolute (or original relative, for the message) dir paths that do not
    exist; each surfaced as an error, and their presence forces a non-zero exit.

## Validation rules (from requirements / D6)

`validateSourceDirs(raw: unknown): string[]` applies, in order:

- `raw === undefined || raw === null` ⇒ return the default `["src"]` (FR-002).
- `!Array.isArray(raw)` ⇒ **error** — "sourceDirectories must be a list of directories".
- `raw.length === 0` ⇒ **error** — "sourceDirectories is empty; configure at least one
  directory" (FR-008).
- any entry not a `string` ⇒ **error** naming the offending value (FR-008).
- any entry that `isAbsolute(entry)` ⇒ **error** — must be relative to the target root
  (FR-006).
- any entry whose normalized path contains a `..` segment (escapes root) ⇒ **error**
  (FR-006).
- otherwise ⇒ return the entries (optionally normalized) as `ValidatedSourceDirs`.

Errors are thrown as a plain `Error` with a user-facing message; `index.ts` catches at
the config seam, prints to stderr, and exits non-zero (never proceeds to scan).

## Reused (unchanged)

- **getAllFiles(dir, ...exts)** (`files.ts`) — recursive `readdirSync` by extension.
  Called once per existing source dir per extension group; results deduped by absolute
  path before dispatch.
- **isStorybookFile** (`files.ts`) — exclusion applied within every source dir (FR-011).
- **Violation / OutViolation / LintResult** — output shapes unchanged; file paths stay
  `relative(ROOT, filePath)` regardless of which source dir a file came from (FR-010).

## Exit-code model (from D4)

The final process exit code becomes non-zero when **either** violations were found (as
today) **or** any configured directory was missing. Clean pass (exit 0) requires zero
violations **and** every configured directory present.
