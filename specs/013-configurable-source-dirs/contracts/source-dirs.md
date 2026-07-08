# Contract: Source-Directory Configuration & Discovery

The linter's contract is its **config surface** (public, Constitution III) and its
**output + exit code**. No network/API surface — CLI over files.

## C1 — Config key (FR-001, FR-002, FR-003)

- `design-system/lint/colors.json` accepts an optional `sourceDirectories` key.
- Type: array of strings, each a target-root-relative directory path.
- Absent ⇒ defaults to `["src"]` (byte-identical legacy behavior).
- Present ⇒ **fully replaces** the default; only the listed directories are scanned.

```jsonc
{
  "colorTokenFiles": ["app/assets/tokens.css"],
  "sourceDirectories": ["app", "lib"],   // NEW — optional; default ["src"]
  "rules": { /* … unchanged … */ }
}
```

## C2 — Validation contract (FR-006, FR-008)

`validateSourceDirs(raw)` accepts the raw parsed value and either returns a non-empty
`string[]` of within-root relative paths or throws an `Error` with a user-facing
message. Rejected inputs:

| Input                          | Result                                             |
|--------------------------------|----------------------------------------------------|
| omitted / `null`               | returns default `["src"]`                           |
| `["app"]`, `["app","lib"]`     | returns as-is                                        |
| `[]`                           | **error** — empty; configure at least one directory |
| `"app"` (bare string)          | **error** — must be a list                           |
| `["app", 3]`                   | **error** — non-string entry                         |
| `["/etc"]` (absolute)          | **error** — must be root-relative                    |
| `["../secrets"]`, `["a/../.."]`| **error** — escapes the target root                  |

A validation error is fatal: printed to stderr, process exits non-zero, no scan runs.

## C3 — Discovery contract (FR-004, FR-009, FR-011)

- Each existing configured directory is walked for the same file types as today
  (`.css`, `.ts`/`.tsx`, `.erb`/`.html.erb`) with the same Storybook exclusion.
- Files are **deduplicated by resolved absolute path** across directories, so a file
  reachable through overlapping or nested configured dirs is linted exactly once.
- Discovery order does not change output ordering (violations are grouped by rule and
  sorted as today).

## C4 — Missing-directory contract (FR-007)

| Configured dirs state                | Behavior                                                        |
|--------------------------------------|----------------------------------------------------------------|
| all exist                            | scan all; exit code driven by violations only (as today)       |
| some exist, some missing             | print each missing dir; scan the existing ones; **exit non-zero** |
| none exist                           | print the missing dir(s); **do not scan**; **exit non-zero**   |

In no case does a missing configured directory produce a clean (exit 0) pass.

## C5 — Output contract (FR-010, unchanged)

Every violation is reported as `<file>:<line>  <message>` under its rule label, where
`<file>` is relative to the **target root** (not the source directory), counted in the
summary, exit non-zero if any violation. Indistinguishable in format from a `src/` run.

## C6 — Non-regression contract (SC-002)

With no `sourceDirectories` key, discovery, output, and exit codes are byte-identical to
pre-feature. `pnpm lint:demo` output is unchanged. The change is additive: a new
optional key, a validator, and a dedup over the existing discovery — no edit to rule
logic or any `lint*Source` method.
