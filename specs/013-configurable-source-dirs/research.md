# Phase 0 Research: Configurable Source Directories

All unknowns were resolved up front via the grilling skill (seven design branches).
No open NEEDS CLARIFICATION remain. This file records each decision, its rationale,
and the alternatives rejected.

## D1 — Where the configuration lives

- **Decision**: A new optional key in the per-target lint config
  (`design-system/lint/colors.json`), alongside `colorTokenFiles` and `rules`. No CLI
  flag.
- **Rationale**: `ROOT`, `colorTokenFiles`, and `componentsDirectory` already come from
  that file. Source roots are a stable per-target property a team commits once; a CLI
  flag would force every run/CI invocation to re-specify them and could drift from the
  committed config.
- **Alternatives**: CLI flag (rejected — per-invocation, drift-prone); both (rejected —
  two sources of truth for one fact, YAGNI).

## D2 — Key name and value shape

- **Decision**: `sourceDirectories: string[]`, values are target-root-relative
  directory paths; default `["src"]`.
- **Rationale**: An array supports the multi-root layout (Rails `app/` + `lib/`) with
  no future breaking change; the plural name signals a list; root-relative paths match
  how `colorTokenFiles`/`componentsDirectory` already resolve.
- **Alternatives**: scalar `sourceDir` (rejected — blocks multi-dir later); vague names
  `include`/`roots` (rejected — less discoverable); accept a bare string too (rejected —
  one shape is simpler to validate and document).

## D3 — Default vs replace

- **Decision**: When present, `sourceDirectories` fully replaces the `src` default;
  only the listed dirs are scanned.
- **Rationale**: Rails apps have no `src/`. Augmenting would force every custom config
  to also list `src` or accept scanning a nonexistent dir.
- **Alternatives**: always also scan `src` (rejected — nonsensical for non-`src` layouts).

## D4 — Behavior on a missing configured directory

- **Decision**: Fail loud, per-directory. Print a message naming the missing dir; scan
  the dirs that do exist; exit non-zero because a configured path could not be honored.
  If none of the configured dirs exist, error and exit non-zero without scanning.
- **Rationale**: `readdirSync(dir, {recursive:true})` throws on a missing dir today, so
  this must be handled or the run crashes. A linter that silently skips an unscanned
  path is worse than a loud error — a false clean pass erodes trust (Constitution III:
  output/suppressions never silent).
- **Alternatives**: warn-and-continue with exit 0 (rejected — hides path typos as green
  runs); hard-crash on first missing (rejected — one typo shouldn't drop sibling dirs).

## D5 — Overlapping / nested directories

- **Decision**: Deduplicate lintable files by resolved absolute path; each file is
  scanned once regardless of overlap or nesting.
- **Rationale**: `getAllFiles` per dir + concatenation would scan a nested dir's files
  twice, doubling violation counts and breaking exact-count tests. A nested config is
  an easy honest mistake.
- **Alternatives**: document "don't overlap" and skip dedup (rejected — silently
  double-counts).

## D6 — Validation strictness / path sandboxing

- **Decision**: Reject, with a clear message: a present-but-empty list, a non-array
  value, a non-string entry, an **absolute path**, and any path containing `..`.
  Configured dirs must resolve within the target root. Omitted key ⇒ default `["src"]`.
- **Rationale**: A linter shouldn't walk outside its target; absolute/escaping paths are
  either mistakes or unsafe. An explicit empty list means "nothing to scan" — a
  false-green risk, so it errors (consistent with D4). Type errors are caught loudly at
  the one JSON.parse seam rather than producing confusing downstream failures.
- **Alternatives**: permissive join like `colorTokenFiles` does today (rejected by the
  user in grilling — v1 wants sandboxing); silently coerce a bare string to `[string]`
  (rejected — one shape, validate strictly).

## D7 — Scope boundary for other config paths

- **Decision**: `colorTokenFiles` and `componentsDirectory` are out of scope — they
  stay target-root-relative and independent of `sourceDirectories`.
- **Rationale**: Token derivation reads `colorTokenFiles` directly and the CSS exemption
  set is built from it; protected components read `componentsDirectory` directly. None
  depend on which roots are walked. A Rails team points them wherever its tokens and
  components live, still root-relative.
- **Alternatives**: resolve them relative to source dirs (rejected — needless coupling,
  breaks targets whose tokens live outside the source roots).
