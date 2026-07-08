# Feature Specification: Configurable Source Directories

**Feature Branch**: `013-configurable-source-dirs`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "I want the parser to be configurable so I can set directories with the source code. JS/TS dirs usually have src/ dir, but ruby on rails apps don't. They have instead app/ dir. Run grilling skill to tighten the requirements"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lint a project whose source lives outside `src/` (Priority: P1)

A team runs the linter against a Ruby on Rails app. Rails keeps its templates and
code under `app/`, not `src/`. Today the linter only ever looks in `src/`, so it
finds nothing and reports a clean run — a false pass. The team wants to declare which
directory holds their source so their templates are actually linted.

**Why this priority**: Without it, the linter is unusable for its primary new
audience (Rails apps), because their code is never scanned. This is the core of the
request and the minimum viable slice.

**Independent Test**: Point the linter at a target whose sources are under `app/`
(with no `src/`), set the source directory to `app`, and confirm violations in those
files are reported. Delivers value on its own: Rails apps become lintable.

**Acceptance Scenarios**:

1. **Given** a target with lintable files under `app/` and a configured source
   directory of `app`, **When** the linter runs, **Then** violations in those files
   are reported with the correct file path and line.
2. **Given** a target with lintable files under `app/` but no source directory
   configured, **When** the linter runs, **Then** the default (`src`) is used and the
   `app/` files are not scanned (unchanged legacy behavior).
3. **Given** a configured source directory, **When** the linter reports a violation,
   **Then** the reported file path is still relative to the target root (not to the
   source directory), matching today's output shape.

---

### User Story 2 - Lint multiple source directories in one run (Priority: P2)

A project keeps source in more than one top-level directory (a Rails app with both
`app/` and `lib/`, or a package with `src/` and a sibling). The team wants all of
them scanned in a single run, with violations attributed to the right files, so they
get one consolidated report.

**Why this priority**: Real projects rarely keep everything in one directory. Once a
single custom directory works (P1), supporting a list is a small, natural extension
that covers the common multi-root layout. Not required for the Rails MVP, so P2.

**Independent Test**: Configure two source directories, seed a violation in each, run
once, and confirm both violations appear in the same report, each attributed to its
file.

**Acceptance Scenarios**:

1. **Given** two configured source directories each containing a violation, **When**
   the linter runs once, **Then** both violations are reported in a single run with
   correct per-file attribution.
2. **Given** two configured directories where one is nested inside the other (e.g.
   `app` and `app/components`), **When** the linter runs, **Then** each lintable file
   is scanned exactly once and no violation is duplicated.

---

### Edge Cases

- **A configured directory does not exist**: the linter surfaces a clear message
  naming the missing directory. If at least one configured directory exists, it scans
  those, and the run still exits with an error (non-zero) status because a configured
  path could not be honored.
- **No configured directory exists** (every configured path is missing): the linter
  reports the misconfiguration and exits non-zero without scanning — never a silent
  clean pass.
- **Configuration omitted / key absent**: falls back to the default `["src"]` so
  existing targets keep working with no config change.
- **Empty list configured** (`[]`): treated as a misconfiguration (nothing to scan) —
  the linter errors rather than reporting a false clean pass.
- **Non-list value, or a list with non-text entries**: rejected as a configuration
  type error with a clear message.
- **A directory value that is absolute or escapes the target root** (e.g. starts with
  `/` or contains `..`): rejected — configured directories must resolve within the
  target root.
- **Overlapping / nested directories**: each lintable file is scanned once; violations
  are never double-counted.
- **A configured directory that exists but holds no lintable files**: the run
  completes cleanly for that directory — an empty directory is not an error.
- **Storybook / excluded files** inside a configured directory continue to be excluded
  exactly as they are under `src/` today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The linter MUST allow a user to configure, in the target's lint
  configuration, which directory or directories are scanned for lintable source files.
- **FR-002**: When no source directory is configured, the linter MUST default to
  scanning `src`, preserving today's behavior for existing targets with no config
  change.
- **FR-003**: When source directories are configured, the configured set MUST fully
  replace the default — only the listed directories are scanned, not `src` in addition.
- **FR-004**: The linter MUST support configuring more than one source directory and
  scan all of them in a single run.
- **FR-005**: Configured directory paths MUST be resolved relative to the target root,
  consistent with how existing configuration paths are resolved.
- **FR-006**: The linter MUST reject a configured directory path that is absolute or
  that escapes the target root (contains `..`), with a clear message, and MUST NOT
  scan outside the target root.
- **FR-007**: When a configured directory does not exist, the linter MUST surface a
  clear message naming it and MUST exit with a non-zero status; when at least one
  configured directory exists it MUST still lint those, and when none exist it MUST NOT
  scan and MUST exit non-zero — in no case reporting a clean pass.
- **FR-008**: The linter MUST reject a source-directory configuration that is present
  but empty, or whose value is not a list of directory paths, with a clear
  configuration-error message.
- **FR-009**: A lintable file reachable through more than one configured directory
  MUST be scanned exactly once, so violations are never duplicated.
- **FR-010**: Violations found in a configured directory MUST be reported in the
  existing output shape — file path relative to the target root, line, rule, and
  message — indistinguishable in format from violations found under `src/` today.
- **FR-011**: All existing file-type coverage (CSS, TS/TSX, ERB/HTML) and exclusions
  (e.g. Storybook files) MUST apply within every configured directory.

### Key Entities *(include if feature involves data)*

- **Source directory configuration**: the user-supplied list of target-root-relative
  directories the linter scans for lintable files. When absent, resolves to the single
  default `["src"]`. Must be a non-empty list of within-root relative paths.
- **Target**: the host project being linted (unchanged) — a root that carries the lint
  configuration and one or more source directories beneath it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Rails-style target with all source under `app/` and no `src/`
  directory is fully linted after setting a single configuration value — every seeded
  violation under `app/` is reported.
- **SC-002**: A target with no source-directory configuration produces output
  identical to today's — the demo fixture run is byte-for-byte unchanged (zero
  regression).
- **SC-003**: With two source directories configured, a single run reports the
  violations from both, each attributed to its correct file, with no duplication even
  when one directory is nested in the other.
- **SC-004**: A configuration naming a nonexistent directory, an empty list, an
  absolute/escaping path, or a wrong-typed value yields an actionable message
  (identifying the problem) and a non-zero exit — never a silent clean pass and never
  an unhandled crash.

## Assumptions

- The source-directory setting is an additive, optional key in the same per-target
  lint configuration that already holds color token files and rule settings, defaulting
  to `["src"]` — a backward-compatible change requiring no version bump for existing
  configs.
- When present, the setting fully determines which directories are scanned (replaces
  the implicit `src` default rather than adding to it).
- Directory values are simple target-root-relative paths, not glob patterns; file-type
  matching within a directory is unchanged (recursive by file extension).
- `colorTokenFiles` and `componentsDirectory` are out of scope — they remain
  target-root-relative and independent of the source-directory setting; a target points
  them wherever its tokens and components live.
- The set of linted file extensions and the Storybook exclusion rule are unchanged;
  only the roots that are walked become configurable.
- A missing or misconfigured source directory is treated as a loud error because a
  linter that silently passes on an unscanned path erodes trust more than an explicit
  failure does.
